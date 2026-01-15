use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::IntoResponse,
    routing::get,
    Router,
};
use futures::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
};
use tokio::sync::broadcast;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
struct AppState {
    rooms: Arc<RwLock<HashMap<String, Room>>>,
}

struct Room {
    tx: broadcast::Sender<String>, // Broadcast channel for the room
    players: HashMap<String, Player>, // userId -> Player state
    host_id: String,
    state: String, // "waiting", "playing"
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Player {
    username: String,
    class: String,
    position: (f32, f32),
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "game_server=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = AppState {
        rooms: Arc::new(RwLock::new(HashMap::new())),
    };

    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/ws", get(ws_handler))
        .with_state(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr_str = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr_str).await.unwrap();
    tracing::info!("🚀 Aether Strike Dedicated Server listening on {}", addr_str);
    
    axum::serve(listener, app).await.unwrap();
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    tracing::info!("WS Connection requested");
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();

    // User session state
    let mut user_id = String::new();
    let _username = String::new(); // Placeholder
    let mut current_room_id = String::new();
    let mut rx_room: Option<broadcast::Receiver<String>> = None;

    loop {
        tokio::select! {
            // 1. Handle incoming messages from Client
            val = receiver.next() => {
                match val {
                    Some(Ok(msg)) => {
                        if let Message::Text(text) = msg {
                           if let Ok(parsed) = serde_json::from_str::<Value>(&text) {
                                let msg_type = parsed["type"].as_str().unwrap_or("");
                                let data = &parsed["data"];
                                
                                match msg_type {
                                    "auth" => {
                                         if let Some(_token) = data["token"].as_str() {
                                            tracing::info!("Auth requested (Logic pending)");
                                         }
                                    }
                                    "aether-strike:create-game" => {
                                        let game_id = data["gameId"].as_str().unwrap_or("default").to_string();
                                        // Use userId from payload if available, else default
                                        user_id = data["userId"].as_str().unwrap_or("Host").to_string();
                                        let username_val = data["username"].as_str().unwrap_or("Host").to_string();
                                        
                                        let (tx, _rx) = broadcast::channel(100);
                                        
                                        {
                                            let mut rooms = state.rooms.write().unwrap();
                                            let mut players_map = HashMap::new();
                                            // Add Host to players immediately
                                            players_map.insert(user_id.clone(), Player {
                                                username: username_val.clone(),
                                                class: data["playerClass"].as_str().unwrap_or("warrior").to_string(), // Capture class too
                                                position: (0.0, 0.0),
                                            });
                                            
                                            rooms.insert(game_id.clone(), Room {
                                                tx: tx.clone(),
                                                players: players_map,
                                                host_id: user_id.clone(),
                                                state: "waiting".to_string(),
                                            });
                                        } // DROP LOCK HERE
                                        
                                        current_room_id = game_id.clone();
                                        rx_room = Some(tx.subscribe());
                                        
                                        let response = serde_json::json!({
                                            "type": "aether-strike:game-created",
                                            "data": { "gameId": game_id, "hostId": user_id }
                                        }).to_string();
                                        let _ = sender.send(Message::Text(response)).await;
                                        
                                        tracing::info!("Game Created: {} by {}", game_id, username_val);
                                    }
                                    "aether-strike:join-game" => {
                                        let game_id = data["gameId"].as_str().unwrap_or("").to_string();
                                        // Read Identity from Payload
                                        if let Some(uid) = data["userId"].as_str() { user_id = uid.to_string(); }
                                        let username_val = data["username"].as_str().unwrap_or("Unknown").to_string();
                                        let player_class = data["playerClass"].as_str().unwrap_or("warrior").to_string();

                                        let (room_tx, room_state, room_host, current_players) = {
                                            let mut rooms = state.rooms.write().unwrap();
                                            if let Some(room) = rooms.get_mut(&game_id) {
                                                // Add Player to Room State
                                                room.players.insert(user_id.clone(), Player {
                                                    username: username_val.clone(),
                                                    class: player_class.clone(),
                                                    position: (0.0, 0.0),
                                                });
                                                
                                                // Clone players list for Initial State Sync
                                                let players_list: Vec<Value> = room.players.iter().map(|(id, p)| {
                                                    serde_json::json!({
                                                        "userId": id,
                                                        "username": p.username,
                                                        "class": p.class,
                                                        "position": {"x": p.position.0, "y": p.position.1}
                                                    })
                                                }).collect();

                                                (Some(room.tx.clone()), Some(room.state.clone()), Some(room.host_id.clone()), Some(players_list))
                                            } else {
                                                (None, None, None, None)
                                            }
                                        }; // DROP LOCK
                                        
                                        if let Some(tx) = room_tx {
                                            current_room_id = game_id.clone();
                                            rx_room = Some(tx.subscribe());
                                            
                                            // Send Game State (Snapshot) to Joiner
                                            let response = serde_json::json!({
                                                "type": "aether-strike:game-state",
                                                "data": { 
                                                    "players": current_players.unwrap_or_default(), 
                                                    "state": room_state.unwrap_or_default(),
                                                    "hostId": room_host.unwrap_or_default()
                                                }
                                            }).to_string();
                                            let _ = sender.send(Message::Text(response)).await;

                                            // BROADCAST "Player Joined" to others
                                            let broadcast_msg = serde_json::json!({
                                                "type": "aether-strike:player-joined",
                                                "data": {
                                                    "playerId": user_id,
                                                    "username": username_val,
                                                    "class": player_class
                                                }
                                            }).to_string();
                                            let _ = tx.send(broadcast_msg);
                                            
                                            tracing::info!("Player joined: {} ({})", game_id, user_id);
                                        }
                                    }
                                    "aether-strike:change-class" => {
                                        let new_class = data["class"].as_str().unwrap_or("warrior").to_string();
                                        
                                        // Update Room State
                                        let room_tx = {
                                            let mut rooms = state.rooms.write().unwrap();
                                            if let Some(room) = rooms.get_mut(&current_room_id) {
                                                if let Some(player) = room.players.get_mut(&user_id) {
                                                    player.class = new_class.clone();
                                                }
                                                Some(room.tx.clone())
                                            } else {
                                                None
                                            }
                                        }; // DROP LOCK

                                        // Broadcast Update
                                        if let Some(tx) = room_tx {
                                            let update_msg = serde_json::json!({
                                                "type": "aether-strike:player-updated",
                                                "data": {
                                                    "playerId": user_id,
                                                    "class": new_class
                                                }
                                            }).to_string();
                                            let _ = tx.send(update_msg);
                                            tracing::info!("Player {} changed class to {}", user_id, new_class);
                                        }
                                    }
                                    "aether-strike:start-game" => {
                                        let room_tx = {
                                            let mut rooms = state.rooms.write().unwrap();
                                            if let Some(room) = rooms.get_mut(&current_room_id) {
                                                room.state = "playing".to_string();
                                                Some(room.tx.clone())
                                            } else {
                                                None
                                            }
                                        };

                                        if let Some(tx) = room_tx {
                                            let enemies_val = &data["enemies"];
                                            let start_msg = serde_json::json!({
                                                "type": "aether-strike:game-started",
                                                "data": {
                                                    "enemies": enemies_val
                                                }
                                            }).to_string();
                                            
                                            let _ = tx.send(start_msg);
                                            tracing::info!("Game {} started", current_room_id);
                                        }
                                    }
                                    "aether-strike:use-attack" => {
                                        if let Some(room) = state.rooms.read().unwrap().get(&current_room_id) {
                                            let broadcast = serde_json::json!({
                                                "type": "aether-strike:combat-action",
                                                "data": {
                                                    "actorId": user_id,
                                                    "targetId": data["targetId"],
                                                    "actionName": data["attackName"],
                                                    "damage": data["damage"].as_f64().unwrap_or(0.0),
                                                    "manaCost": data["manaCost"].as_u64().unwrap_or(0),
                                                    "isArea": data["isArea"].as_bool().unwrap_or(false)
                                                }
                                            }).to_string();
                                            let _ = room.tx.send(broadcast);
                                        }
                                    }
                                    "aether-strike:admin-attack" => {
                                        if let Some(room) = state.rooms.read().unwrap().get(&current_room_id) {
                                            let broadcast = serde_json::json!({
                                                "type": "aether-strike:combat-action",
                                                "data": {
                                                    "actorId": data["actorId"],
                                                    "targetId": data["targetId"],
                                                    "actionName": data["attackName"],
                                                    "damage": data["damage"].as_f64().unwrap_or(0.0),
                                                    "manaCost": 0,
                                                    "isArea": false
                                                }
                                            }).to_string();
                                            let _ = room.tx.send(broadcast);
                                        }
                                    }
                                    "aether-strike:end-turn" => {
                                        if let Some(room) = state.rooms.read().unwrap().get(&current_room_id) {
                                             let next_id = data["nextTurnId"].as_str().unwrap_or("");
                                             let broadcast = serde_json::json!({
                                                 "type": "aether-strike:turn-changed",
                                                 "data": { "currentTurnId": next_id }
                                             }).to_string();
                                             let _ = room.tx.send(broadcast);
                                        }
                                    }
                                    _ => {
                                        // Relay Logic
                                        if !current_room_id.is_empty() {
                                            let tx = {
                                                let rooms = state.rooms.read().unwrap();
                                                rooms.get(&current_room_id).map(|r| r.tx.clone())
                                            }; // DROP LOCK
                                            
                                            if let Some(tx) = tx {
                                                // Avoid echoing back to sender? 
                                                // Ideally strictly relay. But if we broadcast, we receive it in our RX loop too?
                                                // Usually we want to echo to others.
                                                // broadcast::channel sends to ALL receivers.
                                                let _ = tx.send(text);
                                            }
                                        }
                                    }
                                }
                           }
                        }
                    }
                    Some(Err(_)) | None => break, // Disconnect
                }
            }
            
            // 2. Handle outgoing messages from Room (Broadcast)
            recv_result = async {
                if let Some(rx) = &mut rx_room {
                    rx.recv().await
                } else {
                    // If no room, wait forever (pending) so we don't busy loop
                    std::future::pending::<Result<String, broadcast::error::RecvError>>().await
                }
            } => {
                match recv_result {
                    Ok(msg) => {
                         // Relay to our WebSocket
                         let _ = sender.send(Message::Text(msg)).await;
                    }
                    Err(_e) => {
                        // Lagged or closed
                    }
                }
            }
        }
    }
    
    // Cleanup
    if !current_room_id.is_empty() {
         let mut rooms = state.rooms.write().unwrap();
         if let Some(room) = rooms.get_mut(&current_room_id) {
             room.players.remove(&user_id);
         }
    }
}
