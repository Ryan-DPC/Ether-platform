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
    tx: broadcast::Sender<Vec<u8>>, // Broadcast channel for the room
    players: HashMap<String, Player>, // userId -> Player state
    host_id: String,
    state: String, // "waiting", "playing"
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Player {
    username: String,
    class: String,
    hp: f32,
    max_hp: f32,
    speed: f32, // Added
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
    let mut current_room_id = String::new();
    let mut rx_room: Option<broadcast::Receiver<Vec<u8>>> = None; // Changed to Vec<u8>

    loop {
        tokio::select! {
            // 1. Handle incoming messages from Client
            val = receiver.next() => {
                match val {
                    Some(Ok(msg)) => {
                        if let Message::Binary(bin) = msg {
                           match rmp_serde::from_slice::<ClientMessage>(&bin) {
                                Ok(client_msg) => {
                                match client_msg {
                                    ClientMessage::CreateGame { game_id, user_id: uid, username, player_class, hp, max_hp } => {
                                        // ... (keep existing logic)
                                        user_id = uid.clone();
                                        
                                        let (tx, _rx) = broadcast::channel(100);
                                        
                                        {
                                            let mut rooms = state.rooms.write().unwrap();
                                            let mut players_map = HashMap::new();
                                            players_map.insert(user_id.clone(), Player {
                                                username: username.clone(),
                                                class: player_class.clone(),
                                                hp,
                                                max_hp,
                                                speed: 100.0, // Default speed
                                                position: (0.0, 0.0),
                                            });
                                            
                                            rooms.insert(game_id.clone(), Room {
                                                tx: tx.clone(),
                                                players: players_map,
                                                host_id: user_id.clone(),
                                                state: "waiting".to_string(),
                                            });
                                        }
                                        
                                        current_room_id = game_id.clone();
                                        rx_room = Some(tx.subscribe());
                                        
                                        let response = ServerMessage::NewHost { game_id: game_id.clone(), host_id: user_id.clone() };
                                        if let Ok(data) = rmp_serde::to_vec(&response) {
                                            let _ = sender.send(Message::Binary(data)).await;
                                        }
                                        tracing::info!("Game Created: {} by {}", game_id, username);
                                    }
                                    ClientMessage::JoinGame { game_id, user_id: uid, username, player_class, hp, max_hp } => {
                                        // ... (keep existing logic)
                                        user_id = uid.clone();

                                        let (room_tx, room_state, room_host, current_players) = {
                                            let mut rooms = state.rooms.write().unwrap();
                                            if let Some(room) = rooms.get_mut(&game_id) {
                                                room.players.insert(user_id.clone(), Player {
                                                    username: username.clone(),
                                                    class: player_class.clone(),
                                                    hp,
                                                    max_hp,
                                                    speed: 100.0, // Default speed
                                                    position: (0.0, 0.0),
                                                });
                                                
                                                let players_list: Vec<PlayerData> = room.players.iter().map(|(id, p)| {
                                                     PlayerData {
                                                         user_id: id.clone(),
                                                         username: p.username.clone(),
                                                         class: p.class.clone(),
                                                         hp: p.hp,
                                                         max_hp: p.max_hp,
                                                         speed: p.speed,
                                                         position: p.position
                                                     }
                                                }).collect();

                                                (Some(room.tx.clone()), Some(room.state.clone()), Some(room.host_id.clone()), Some(players_list))
                                            } else {
                                                (None, None, None, None)
                                            }
                                        };
                                        
                                        if let Some(tx) = room_tx {
                                            current_room_id = game_id.clone();
                                            rx_room = Some(tx.subscribe());
                                            
                                            // Send Snapshot
                                            let response = ServerMessage::GameState { 
                                                players: current_players.unwrap_or_default(), 
                                                state: room_state.unwrap_or_default(),
                                                host_id: room_host.unwrap_or_default()
                                            };
                                            if let Ok(data) = rmp_serde::to_vec(&response) {
                                                let _ = sender.send(Message::Binary(data)).await;
                                            }

                                            // Broadcast Join
                                            let broadcast_msg = ServerMessage::PlayerJoined {
                                                player_id: user_id.clone(),
                                                username,
                                                class: player_class,
                                                hp,
                                                max_hp,
                                                speed: 100.0 // Default
                                            };
                                            if let Ok(data) = rmp_serde::to_vec(&broadcast_msg) {
                                                let _ = tx.send(data);
                                            }
                                            tracing::info!("Player joined: {} ({})", game_id, user_id);
                                        }
                                    }
                                    ClientMessage::StartGame { enemies } => {
                                         let room_tx = {
                                            let mut rooms = state.rooms.write().unwrap();
                                            if let Some(room) = rooms.get_mut(&current_room_id) {
                                                room.state = "playing".to_string();
                                                Some(room.tx.clone())
                                            } else { None }
                                        };

                                        if let Some(tx) = room_tx {
                                            let start_msg = ServerMessage::GameStarted { enemies };
                                            if let Ok(data) = rmp_serde::to_vec(&start_msg) {
                                                let _ = tx.send(data);
                                            }
                                            tracing::info!("Game {} started", current_room_id);
                                        }
                                    }
                                    ClientMessage::UseAttack { target_id, attack_name, damage, mana_cost, is_area } => {
                                        let room_tx = {
                                            let mut rooms = state.rooms.write().unwrap();
                                            if let Some(room) = rooms.get_mut(&current_room_id) {
                                                let mut new_hp = None;
                                                if let Some(target_id_str) = &target_id {
                                                    if let Some(target) = room.players.get_mut(target_id_str) {
                                                        target.hp = (target.hp - damage).max(0.0);
                                                        new_hp = Some(target.hp);
                                                    }
                                                }
                                                
                                                let broadcast = ServerMessage::CombatAction {
                                                    actor_id: user_id.clone(),
                                                    target_id,
                                                    action_name: attack_name,
                                                    damage,
                                                    mana_cost,
                                                    is_area,
                                                    target_new_hp: new_hp
                                                };
                                                if let Ok(data) = rmp_serde::to_vec(&broadcast) {
                                                    Some((room.tx.clone(), data))
                                                } else { None }
                                            } else { None }
                                        };
                                        
                                        if let Some((tx, msg)) = room_tx {
                                            let _ = tx.send(msg);
                                        }
                                    }
                                    ClientMessage::EndTurn { next_turn_id } => {
                                        if let Some(room) = state.rooms.read().unwrap().get(&current_room_id) {
                                             let broadcast = ServerMessage::TurnChanged { current_turn_id: next_turn_id };
                                             if let Ok(data) = rmp_serde::to_vec(&broadcast) {
                                                 let _ = room.tx.send(data);
                                             }
                                        }
                                    }
                                    ClientMessage::NextWave { enemies, gold, exp } => {
                                        if let Some(room) = state.rooms.read().unwrap().get(&current_room_id) {
                                            let broadcast = ServerMessage::WaveStarted { enemies, gold, exp };
                                            if let Ok(data) = rmp_serde::to_vec(&broadcast) {
                                                let _ = room.tx.send(data);
                                            }
                                        }
                                    }
                                    ClientMessage::GameOver { victory } => {
                                        if let Some(room) = state.rooms.read().unwrap().get(&current_room_id) {
                                            let broadcast = ServerMessage::GameEnded { victory };
                                            if let Ok(data) = rmp_serde::to_vec(&broadcast) {
                                                let _ = room.tx.send(data);
                                            }
                                        }
                                    }
                                    ClientMessage::ChangeClass { class } => {
                                        let room_tx = {
                                            let mut rooms = state.rooms.write().unwrap();
                                            if let Some(room) = rooms.get_mut(&current_room_id) {
                                                // Update player class in room state
                                                if let Some(player) = room.players.get_mut(&user_id) {
                                                    player.class = class.clone();
                                                    tracing::info!("Player {} changed class to {}", user_id, class);
                                                }
                                                
                                                let broadcast = ServerMessage::PlayerUpdated {
                                                    player_id: user_id.clone(),
                                                    class: class.clone()
                                                };
                                                if let Ok(data) = rmp_serde::to_vec(&broadcast) {
                                                    Some((room.tx.clone(), data))
                                                } else { None }
                                            } else { None }
                                        };
                                        
                                        if let Some((tx, msg)) = room_tx {
                                            let _ = tx.send(msg);
                                        }
                                    }
                                    ClientMessage::AdminAttack { actor_id, attack_name, target_id, damage } => {
                                        // Host sends enemy attack - broadcast to all players
                                        let room_tx = {
                                            let rooms = state.rooms.read().unwrap();
                                            if let Some(room) = rooms.get(&current_room_id) {
                                                // Only allow host to send AdminAttack
                                                if room.host_id == user_id {
                                                    let broadcast = ServerMessage::CombatAction {
                                                        actor_id,
                                                        target_id: Some(target_id),
                                                        action_name: attack_name,
                                                        damage,
                                                        mana_cost: 0,
                                                        is_area: false,
                                                        target_new_hp: None // Client calculates locally
                                                    };
                                                    if let Ok(data) = rmp_serde::to_vec(&broadcast) {
                                                        Some((room.tx.clone(), data))
                                                    } else { None }
                                                } else {
                                                    tracing::warn!("Non-host {} tried to send AdminAttack", user_id);
                                                    None
                                                }
                                            } else { None }
                                        };
                                        
                                        if let Some((tx, msg)) = room_tx {
                                            let _ = tx.send(msg);
                                        }
                                    }
                                    // Handle other cases or ignore
                                    _ => {
                                        tracing::debug!("Unhandled ClientMessage: {:?}", client_msg);
                                    }
                                }
                           },
                           Err(e) => {
                               tracing::warn!("Failed to deserialize MessagePack: {}", e);
                               tracing::warn!("Binary Length: {} bytes", bin.len());
                               if bin.len() > 0 {
                                    tracing::warn!("Header Byte: {:#04x}", bin[0]);
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
                    std::future::pending::<Result<Vec<u8>, broadcast::error::RecvError>>().await
                }
            } => {
                match recv_result {
                    Ok(msg) => {
                         let _ = sender.send(Message::Binary(msg)).await;
                    }
                    Err(_e) => {}
                }
            }
        }
    }
    
    // Cleanup
    if !current_room_id.is_empty() {
         let mut rooms = state.rooms.write().unwrap();
         if let Some(room) = rooms.get_mut(&current_room_id) {
             room.players.remove(&user_id);
             
             let leave_msg = ServerMessage::PlayerLeft { player_id: user_id.clone() };
             if let Ok(data) = rmp_serde::to_vec(&leave_msg) {
                 let _ = room.tx.send(data);
             }
         }
    }
}

// --- SHARED PROTOCOL DEFINITIONS ---

// #[serde(tag = "type", content = "data", rename_all = "kebab-case")] // To match JSON style somewhat if we wanted, but standard helpful
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    Auth { token: String },
    CreateGame { game_id: String, user_id: String, username: String, player_class: String, hp: f32, max_hp: f32 },
    JoinGame { game_id: String, user_id: String, username: String, player_class: String, hp: f32, max_hp: f32 },
    ChangeClass { class: String },
    StartGame { enemies: Vec<EnemyData> },
    UseAttack { target_id: Option<String>, attack_name: String, damage: f32, mana_cost: u32, is_area: bool },
    AdminAttack { target_id: String, attack_name: String, damage: f32, actor_id: String },
    EndTurn { next_turn_id: String },
    NextWave { enemies: Vec<EnemyData>, gold: u32, exp: u32 },
    GameOver { victory: bool },
    Input { x: f32, y: f32, vx: f32, vy: f32, anim: String },
    Flee,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    NewHost { game_id: String, host_id: String },
    GameState { players: Vec<PlayerData>, state: String, host_id: String },
    PlayerJoined { player_id: String, username: String, class: String, hp: f32, max_hp: f32, speed: f32 },
    PlayerLeft { player_id: String },
    PlayerUpdated { player_id: String, class: String },
    GameStarted { enemies: Vec<EnemyData> },
    CombatAction { actor_id: String, target_id: Option<String>, action_name: String, damage: f32, mana_cost: u32, is_area: bool, target_new_hp: Option<f32> },
    TurnChanged { current_turn_id: String },
    WaveStarted { enemies: Vec<EnemyData>, gold: u32, exp: u32 },
    GameEnded { victory: bool },
    PlayerUpdate { player_id: String, position: Option<(f32, f32)>, animation: Option<String> }, // Movement
    Error(String),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PlayerData {
    pub user_id: String,
    pub username: String,
    pub class: String,
    pub hp: f32,
    pub max_hp: f32,
    pub speed: f32,
    pub position: (f32, f32),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EnemyData {
    pub id: String,
    pub name: String,
    pub hp: f32,
    pub max_hp: f32,
    pub speed: f32,
    pub position: (f32, f32),
}
