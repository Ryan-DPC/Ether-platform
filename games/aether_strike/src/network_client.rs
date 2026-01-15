// Module réseau pour Aether Strike - Client WebSocket Relay Multiplayer
// 
// ARCHITECTURE:
// - Thread principal: Boucle de jeu Macroquad (synchrone)
// - Thread WS: Gestion WebSocket (asynchrone)
// - Communication: Channels mpsc (Multi-Producer Single-Consumer)
//
// FLOW:
// 1. GameClient::connect() lance un thread WS
// 2. Le jeu envoie des inputs via send_input()
// 3. Le thread WS envoie au serveur via WebSocket
// 4. Le serveur broadcast aux autres joueurs
// 5. Le thread WS reçoit les updates et les envoie via channel
// 6. Le jeu récupère via poll_updates() dans la boucle

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::mpsc::{channel, Sender, Receiver};
use std::thread;
use tungstenite::{connect, Message};
use url::Url;
use tungstenite::client::IntoClientRequest;

// Messages envoyés par le serveur
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerUpdate {
    pub player_id: String,
    pub position: Option<(f32, f32)>,
    pub velocity: Option<(f32, f32)>,
    pub action: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemotePlayer {
    pub userId: String,
    pub username: String,
    pub class: String,
    pub position: (f32, f32),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnemyData {
    pub id: String,
    pub name: String,
    pub hp: f32,
    pub max_hp: f32,
    pub speed: f32,
    pub position: (f32, f32),
}

#[derive(Debug, Clone)]


pub enum GameEvent {
    PlayerJoined { player_id: String, username: String, class: String },
    PlayerLeft { player_id: String },
    PlayerUpdated { player_id: String, class: String },
    PlayerUpdate(PlayerUpdate),
    GameState { players: Vec<RemotePlayer>, host_id: String },
    GameStarted { enemies: Vec<EnemyData> },
    NewHost { host_id: String },
    CombatAction { 
        actor_id: String, 
        target_id: Option<String>, 
        action_name: String, 
        damage: f32, 
        mana_cost: u32,
        is_area: bool 
    },
    TurnChanged { current_turn_id: String },
    Error(String),
}

// Client WebSocket pour le jeu
pub struct GameClient {
    // Channel pour envoyer des commandes au thread WS
    tx_to_ws: Sender<WsCommand>,
    // Channel pour recevoir les événements du thread WS
    rx_from_ws: Receiver<GameEvent>,
}

#[derive(Debug)]
pub enum WsCommand {
    Connect,
    Disconnect,
    SendInput { position: (f32, f32), velocity: (f32, f32), action: String },
    UseAttack { attack_name: String, target_id: Option<String> },
    EndTurn,
    Flee,
    ChangeClass { new_class: String },
    StartGame { enemies: Vec<EnemyData> },
}


impl GameClient {
    /// Crée une connexion au serveur relay
    /// 
    /// # Arguments
    /// * `ws_url` - URL du WebSocket
    /// * `token` - Token JWT
    /// * `game_id` - ID de la partie
    /// * `player_class` - Classe du joueur
    /// * `is_host` - Si on crée la partie ou on la rejoint
    pub fn connect(ws_url: &str, token: &str, game_id: String, player_class: String, is_host: bool, username: String, user_id: String) -> Result<Self, String> {
        // Channels bi-directionnels
        let (tx_to_ws, rx_in_ws) = channel::<WsCommand>();
        let (tx_from_ws, rx_from_ws) = channel::<GameEvent>();

        // Construire l'URL avec le token (encodé correctement)
        let mut url_parsed = Url::parse(ws_url).map_err(|e| format!("Invalid URL: {}", e))?;
        url_parsed.query_pairs_mut().append_pair("token", token);
        let full_url = url_parsed.to_string();
        
        println!("🔌 Connecting to relay server: {}", ws_url);

        // Cloner pour le thread
        let game_id_clone = game_id.clone();
        let player_class_clone = player_class.clone();
        let token_clone = token.to_string();
        let username_clone = username.clone();
        let user_id_clone = user_id.clone();

        // Lancer le thread WebSocket
        thread::spawn(move || {
            if let Err(e) = ws_thread_loop(full_url, game_id_clone, player_class_clone, is_host, rx_in_ws, tx_from_ws, token_clone, username_clone, user_id_clone) {
                eprintln!("❌ WebSocket thread error: {}", e);
            }
        });

        Ok(GameClient {
            tx_to_ws,
            rx_from_ws,
        })
    }

    /// Envoie la position et l'action du joueur local
    pub fn send_input(&self, position: (f32, f32), velocity: (f32, f32), action: String) {
        let _ = self.tx_to_ws.send(WsCommand::SendInput { position, velocity, action });
    }

    /// Envoie l'utilisation d'une attaque
    pub fn use_attack(&self, attack_name: String, target_id: Option<String>) {
        let _ = self.tx_to_ws.send(WsCommand::UseAttack { attack_name, target_id });
    }

    /// Passe le tour
    pub fn end_turn(&self) {
        let _ = self.tx_to_ws.send(WsCommand::EndTurn);
    }

    /// Tente de fuir
    pub fn flee(&self) {
        let _ = self.tx_to_ws.send(WsCommand::Flee);
    }

    /// Change la classe du joueur
    pub fn send_class_change(&self, new_class: String) {
        let _ = self.tx_to_ws.send(WsCommand::ChangeClass { new_class });
    }

    /// Démarre la partie (Hôte uniquement) avec les ennemis initiaux
    pub fn start_game(&self, enemies: Vec<EnemyData>) {
        let _ = self.tx_to_ws.send(WsCommand::StartGame { enemies });
    }

    /// Récupère tous les événements disponibles (non-bloquant)
    pub fn poll_updates(&self) -> Vec<GameEvent> {
        let mut events = Vec::new();
        
        // Vider le channel (non-bloquant avec try_recv)
        while let Ok(event) = self.rx_from_ws.try_recv() {
            events.push(event);
        }
        
        events
    }

    /// Déconnexion propre
    pub fn disconnect(&self) {
        let _ = self.tx_to_ws.send(WsCommand::Disconnect);
    }
}

/// Boucle principale du thread WebSocket
fn ws_thread_loop(
    url: String,
    game_id: String,
    player_class: String,
    is_host: bool,
    rx_commands: Receiver<WsCommand>,
    tx_events: Sender<GameEvent>,
    token: String,
    username: String,
    user_id: String,
) -> Result<(), String> {
    // Connexion WebSocket
    // Connexion WebSocket
    // Outer Loop for Reconnection
    loop {
        // Remove /api suffix if present
        let clean_url = if url.ends_with("/api") {
            url.replace("/api", "")
        } else {
            url.clone()
        };

        let mut final_url = clean_url.clone();
        
        // Manually ensure token is present in query string
        if !final_url.contains("token=") {
            if final_url.contains('?') {
                final_url.push_str(&format!("&token={}", token));
            } else {
                final_url.push_str(&format!("?token={}", token));
            }
        }

        let url_parsed = match Url::parse(&final_url) {
            Ok(u) => u,
            Err(e) => {
                eprintln!("Invalid URL in loop: {}", e);
                // If URL is invalid, retrying won't help. Break.
                return Err(format!("Invalid URL: {}", e));
            }
        };

        println!("🔌 Attempting to connect to WS: {}", final_url);

        // Build request with headers to mimic browser/frontend
        let request_res = url_parsed.into_client_request();
        if let Err(e) = request_res {
             eprintln!("Failed to build request: {}", e);
             std::thread::sleep(std::time::Duration::from_secs(5));
             continue; 
        }
        let mut request = request_res.unwrap();
        
        request.headers_mut().insert("Origin", "https://vext-frontend.onrender.com".parse().unwrap());
        
        match connect(request) {
            Ok((mut socket, _)) => {
                 // --- MISE EN PLACE DU NODE NON-BLOQUANT ---
                if let Err(e) = match socket.get_mut() {
                    tungstenite::stream::MaybeTlsStream::Plain(s) => s.set_nonblocking(true),
                    tungstenite::stream::MaybeTlsStream::Rustls(s) => s.get_mut().set_nonblocking(true),
                    _ => Ok(()),
                } {
                    eprintln!("Failed to set non-blocking: {}", e);
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    continue;
                }

                println!("✅ WebSocket connected (Non-blocking)");
                let _ = tx_events.send(GameEvent::Error("Connected".to_string())); // Notify game we are back

                // Rejoindre ou Créer la partie (Re-join on reconnect)
                let join_type = if is_host { "aether-strike:create-game" } else { "aether-strike:join-game" };
                let join_msg = serde_json::json!({
                    "type": join_type,
                    "data": {
                        "gameId": game_id,
                        "playerClass": player_class,
                        "maxPlayers": 4,
                        "username": username,
                        "userId": user_id
                    }
                });
                
                println!("📤 Sending Join Payload: {}", join_msg);

                if let Err(e) = socket.send(Message::Text(join_msg.to_string())) {
                     eprintln!("Failed to initiate game: {}", e);
                     // If we can't send join, socket is dead.
                     std::thread::sleep(std::time::Duration::from_secs(2));
                     continue;
                }

                println!("🎮 {} game: {}", if is_host { "Created" } else { "Joined" }, game_id);

                let mut last_ping = std::time::Instant::now();
                let ping_interval = std::time::Duration::from_secs(5); // More frequent ping (5s)

                // Inner Loop (Connected State)
                loop {
                    // 0. Keep-Alive / Ping
                    if last_ping.elapsed() > ping_interval {
                        if let Err(e) = socket.send(Message::Ping(vec![])) {
                            println!("⚠️ Failed to send Ping: {}", e);
                            // Connection likely dead, break to outer loop to reconnect
                            break;
                        }
                        last_ping = std::time::Instant::now();
                    }

                    // 1. Traiter les commandes du jeu
                    while let Ok(cmd) = rx_commands.try_recv() {
                        match cmd {
                            WsCommand::Connect => {}
                            WsCommand::SendInput { position, velocity, action } => {
                                let msg = serde_json::json!({
                                    "type": "aether-strike:player-input",
                                    "data": {
                                        "position": [position.0, position.1],
                                        "velocity": [velocity.0, velocity.1],
                                        "action": action
                                    }
                                });
                                let _ = socket.send(Message::Text(msg.to_string()));
                            }
                            WsCommand::StartGame { enemies } => {
                                 let msg = serde_json::json!({
                                     "type": "aether-strike:start-game",
                                     "enemies": enemies,
                                     "payload": { "enemies": enemies },
                                     "data": { "enemies": enemies }
                                 });
                                 let _ = socket.send(Message::Text(msg.to_string()));
                            }
                            WsCommand::UseAttack { attack_name, target_id } => {
                                let msg = serde_json::json!({
                                    "type": "aether-strike:use-attack",
                                    "data": {
                                        "attackName": attack_name,
                                        "targetId": target_id
                                    }
                                });
                                let _ = socket.send(Message::Text(msg.to_string()));
                            }
                            WsCommand::EndTurn => {
                                let msg = serde_json::json!({
                                    "type": "aether-strike:end-turn",
                                    "data": {}
                                });
                                let _ = socket.send(Message::Text(msg.to_string()));
                            }
                            WsCommand::Flee => {
                                let msg = serde_json::json!({
                                    "type": "aether-strike:flee",
                                    "data": {}
                                });
                                let _ = socket.send(Message::Text(msg.to_string()));
                            }
                            WsCommand::ChangeClass { new_class } => {
                                let msg = serde_json::json!({
                                    "type": "aether-strike:change-class",
                                    "newClass": new_class,
                                    "data": { 
                                        "newClass": new_class.clone(),
                                        "class": new_class // FIX: Added 'class' so receiver finds it
                                    },
                                    "payload": { "newClass": new_class }
                                });
                                let _ = socket.send(Message::Text(msg.to_string()));
                            }
                            WsCommand::Disconnect => {
                                let leave_msg = serde_json::json!({
                                    "type": "aether-strike:leave-game",
                                    "data": {}
                                });
                                let _ = socket.send(Message::Text(leave_msg.to_string()));
                                return Ok(()); // Actually exit thread
                            }
                        }
                    }

                    // 2. Lire les messages
                    match socket.read() {
                        Ok(msg) => {
                            match msg {
                                Message::Text(text) => {
                                    // println!("WS-RAW: {}", text); // Reduce spam unless debugging
                                    if let Ok(parsed) = serde_json::from_str::<Value>(&text) {
                                        if let Some(event_type) = parsed["type"].as_str() {
                                            let data = &parsed["data"];
                                            let game_event = match event_type {
                                                "aether-strike:player-joined" => {
                                                    Some(GameEvent::PlayerJoined {
                                                        player_id: data["playerId"].as_str().unwrap_or("").to_string(),
                                                        username: data["username"].as_str().unwrap_or("Unknown").to_string(),
                                                        class: data["class"].as_str().unwrap_or("warrior").to_string(),
                                                    })
                                                }
                                                "aether-strike:game-created" => {
                                                    Some(GameEvent::NewHost {
                                                        host_id: data["hostId"].as_str().unwrap_or("").to_string(),
                                                    })
                                                }
                                                "aether-strike:game-state" => {
                                                    let mut players = Vec::new();
                                                    if let Some(players_val) = data["players"].as_array() {
                                                        for p in players_val {
                                                            players.push(RemotePlayer {
                                                                userId: p["userId"].as_str().unwrap_or("").to_string(),
                                                                username: p["username"].as_str().unwrap_or("Unknown").to_string(),
                                                                class: p["class"].as_str().unwrap_or("warrior").to_string(),
                                                                position: (
                                                                    p["position"]["x"].as_f64().unwrap_or(0.0) as f32,
                                                                    p["position"]["y"].as_f64().unwrap_or(0.0) as f32,
                                                                ),
                                                            });
                                                        }
                                                    }
                                                    Some(GameEvent::GameState {
                                                        players,
                                                        host_id: data["hostId"].as_str().unwrap_or("").to_string(),
                                                    })
                                                }
                                                "aether-strike:new-host" => {
                                                    Some(GameEvent::NewHost {
                                                        host_id: data["hostId"].as_str().unwrap_or("").to_string(),
                                                    })
                                                }
                                                "aether-strike:player-left" => {
                                                    Some(GameEvent::PlayerLeft {
                                                        player_id: data["playerId"].as_str().unwrap_or("").to_string(),
                                                    })
                                                }
                                                "aether-strike:player-updated" => {
                                                    println!("📥 Received player-updated: {:?}", data);
                                                    Some(GameEvent::PlayerUpdated {
                                                        player_id: data["playerId"].as_str().unwrap_or("").to_string(),
                                                        class: data["class"].as_str().unwrap_or("warrior").to_string(),
                                                    })
                                                }
                                                "aether-strike:player-update" => {
                                                    let position = if let Some(pos_arr) = data["position"].as_array() {
                                                        Some((
                                                            pos_arr[0].as_f64().unwrap_or(0.0) as f32,
                                                            pos_arr[1].as_f64().unwrap_or(0.0) as f32,
                                                        ))
                                                    } else {
                                                        None
                                                    };
                                                    
                                                    Some(GameEvent::PlayerUpdate(PlayerUpdate {
                                                        player_id: data["playerId"].as_str().unwrap_or("").to_string(),
                                                        position,
                                                        velocity: None,
                                                        action: data["action"].as_str().map(|s| s.to_string()),
                                                    }))
                                                }
                                                "aether-strike:combat-action" => {
                                                    Some(GameEvent::CombatAction {
                                                        actor_id: data["actorId"].as_str().unwrap_or("").to_string(),
                                                        target_id: data["targetId"].as_str().map(|s| s.to_string()),
                                                        action_name: data["actionName"].as_str().unwrap_or("").to_string(),
                                                        damage: data["damage"].as_f64().unwrap_or(0.0) as f32,
                                                        mana_cost: data["manaCost"].as_u64().unwrap_or(0) as u32,
                                                        is_area: data["isArea"].as_bool().unwrap_or(false),
                                                    })
                                                }
                                                "aether-strike:turn-changed" => {
                                                    Some(GameEvent::TurnChanged {
                                                        current_turn_id: data["currentTurnId"].as_str().unwrap_or("").to_string(),
                                                    })
                                                }
                                                "aether-strike:game-started" => {
                                                    let enemies_json = data["enemies"].as_array();
                                                    let mut enemies_list = Vec::new();
                                                    if let Some(arr) = enemies_json {
                                                        for val in arr {
                                                            if let Ok(enemy) = serde_json::from_value::<EnemyData>(val.clone()) {
                                                                enemies_list.push(enemy);
                                                            }
                                                        }
                                                    }
                                                    Some(GameEvent::GameStarted { enemies: enemies_list })
                                                }
                                                _ => None
                                            };

                                            if let Some(event) = game_event {
                                                let _ = tx_events.send(event);
                                            }
                                        }
                                    }
                                }
                                Message::Ping(_) | Message::Pong(_) => {}
                                Message::Close(_) => {
                                    println!("🔌 Server closed connection. Reconnecting...");
                                    break; // Break inner loop to reconnect
                                }
                                _ => {}
                            }
                        }
                        Err(tungstenite::Error::Io(ref e)) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            // OK
                        }
                        Err(e) => {
                            eprintln!("WebSocket error (Connection broken): {}", e);
                            let _ = tx_events.send(GameEvent::Error(format!("Connection Lost: {}", e)));
                            break; // Break inner loop to reconnect
                        }
                    }

                    // 16ms sleep (~60 UPS)
                    std::thread::sleep(std::time::Duration::from_millis(16));
                } // End Inner Loop
            },
            Err(e) => {
                 eprintln!("Connection failed: {}", e);
                 let _ = tx_events.send(GameEvent::Error(format!("Connect failed: {}", e)));
                 // Wait before retry
                 std::thread::sleep(std::time::Duration::from_secs(5));
            }
        }
    } // End Outer Loop
}
