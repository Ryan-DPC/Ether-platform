// Module réseau pour Aether Strike - Client WebSocket Relay Multiplayer (MessagePack Version)

use std::sync::mpsc::{channel, Sender, Receiver};
use std::collections::HashMap;
use std::thread;
use tungstenite::{connect, Message};
use url::Url;
use tungstenite::client::IntoClientRequest;

// Generic imports
use crate::network_protocol::{ClientMessage, ServerMessage, PlayerData, EnemyData};

// Re-export PlayerData as RemotePlayer to minimize refactoring elsewhere for now, 
// OR just expect to fix it. Let's fix it.
// We used to have RemotePlayer. Now we use PlayerData.
// GameEvent will use PlayerData.

#[derive(Debug, Clone)]
pub enum GameEvent {
    PlayerJoined { player_id: String, username: String, class: String, hp: f32, max_hp: f32, speed: f32 },
    PlayerLeft { player_id: String },
    PlayerUpdated { player_id: String, class: String },
    // PlayerUpdate(PlayerUpdate), // Movement updates - simplified in ServerMessage check
    PlayerMove { player_id: String, position: Option<(f32, f32)>, action: Option<String> }, // Derived from PlayerUpdate in protocol
    GameState { players: Vec<PlayerData>, host_id: String },
    GameStarted { enemies: Vec<EnemyData> },
    NewHost { host_id: String },
    CombatAction { 
        actor_id: String, 
        target_id: Option<String>, 
        action_name: String, 
        damage: f32, 
        mana_cost: u32,
        is_area: bool,
        target_new_hp: Option<f32>
    },
    TurnChanged { current_turn_id: String },
    WaveStarted { enemies: Vec<EnemyData>, gold: u32, exp: u32 },
    GameEnded { victory: bool },
    Error(String),
}

// Client WebSocket pour le jeu
pub struct GameClient {
    tx_to_ws: Sender<ClientMessage>, // Changed to typed message
    rx_from_ws: Receiver<GameEvent>,
}

impl GameClient {
    pub fn connect(ws_url: &str, token: &str, game_id: String, player_class: String, is_host: bool, username: String, user_id: String, hp: f32, max_hp: f32, _speed: f32) -> Result<Self, String> {
        let (tx_to_ws, rx_in_ws) = channel::<ClientMessage>();
        let (tx_from_ws, rx_from_ws) = channel::<GameEvent>();

        let mut url_parsed = Url::parse(ws_url).map_err(|e| format!("Invalid URL: {}", e))?;
        url_parsed.query_pairs_mut().append_pair("token", token);
        let full_url = url_parsed.to_string();
        
        println!("🔌 Connecting to relay server (MsgPack): {}", ws_url);

        // Initial Message to send once connected
        // We defer this to the thread loop to ensure connection first
        let initial_msg = if is_host {
            ClientMessage::CreateGame { game_id, user_id, username, player_class, hp, max_hp }
        } else {
            ClientMessage::JoinGame { game_id, user_id, username, player_class, hp, max_hp }
        };

        let token_str = token.to_string();
        thread::spawn(move || {
            if let Err(e) = ws_thread_loop(full_url, initial_msg, rx_in_ws, tx_from_ws, token_str) {
                eprintln!("❌ WebSocket thread error: {}", e);
            }
        });

        Ok(GameClient {
            tx_to_ws,
            rx_from_ws,
        })
    }

    pub fn send_input(&self, position: (f32, f32), velocity: (f32, f32), action: String) {
        let _ = self.tx_to_ws.send(ClientMessage::Input { 
            x: position.0, y: position.1, 
            vx: velocity.0, vy: velocity.1, 
            anim: action 
        });
    }

    pub fn use_attack(&self, attack_name: String, target_id: Option<String>, damage: f32, mana_cost: u32, is_area: bool) {
        let _ = self.tx_to_ws.send(ClientMessage::UseAttack { 
            target_id, attack_name, damage, mana_cost, is_area 
        });
    }

    pub fn admin_attack(&self, actor_id: String, attack_name: String, target_id: Option<String>, damage: f32) {
        let target = target_id.unwrap_or_default();
        let _ = self.tx_to_ws.send(ClientMessage::AdminAttack { 
            actor_id, attack_name, target_id: target, damage 
        });
    }

    pub fn end_turn(&self, next_turn_id: String) {
        let _ = self.tx_to_ws.send(ClientMessage::EndTurn { next_turn_id });
    }

    pub fn flee(&self) {
        let _ = self.tx_to_ws.send(ClientMessage::Flee);
    }

    pub fn send_class_change(&self, new_class: String) {
        let _ = self.tx_to_ws.send(ClientMessage::ChangeClass { class: new_class });
    }

    pub fn start_game(&self, enemies: Vec<EnemyData>) {
        println!("WS-CLIENT: Sending StartGame message...");
        let _ = self.tx_to_ws.send(ClientMessage::StartGame(enemies));
    }

    pub fn start_next_wave(&self, enemies: Vec<EnemyData>, gold: u32, exp: u32) {
        let _ = self.tx_to_ws.send(ClientMessage::NextWave { enemies, gold, exp });
    }

    pub fn trigger_game_over(&self, victory: bool) {
        let _ = self.tx_to_ws.send(ClientMessage::GameOver { victory });
    }

    pub fn poll_updates(&self) -> Vec<GameEvent> {
        let mut events = Vec::new();
        while let Ok(event) = self.rx_from_ws.try_recv() {
            events.push(event);
        }
        events
    }

    pub fn disconnect(&self) {
        // Drop logic normally handles this, but we can force close if needed
        // Since we removed 'Disconnect' from ClientMessage enum (it's implicit by drop), 
        // we might just let the channel close.
    }
}

fn ws_thread_loop(
    url: String,
    initial_msg: ClientMessage,
    rx_commands: Receiver<ClientMessage>,
    tx_events: Sender<GameEvent>,
    token: String,
) -> Result<(), String> {
    
    // We need to resend initial_msg on reconnection, so we keep a copy or reconstruct it?
    // We'll store it.
    let mut pending_login = Some(initial_msg.clone());

    loop {
        // ... URL Construction (Simplified for brevity, assuming URL is good or handled externally mostly)
         let mut final_url = url.clone();
         if !final_url.contains("token=") {
            final_url.push_str(if final_url.contains('?') { "&token=" } else { "?token=" });
            final_url.push_str(&token);
        }

        let url_parsed = Url::parse(&final_url).map_err(|e| e.to_string())?;

        println!("🔌 Connecting WS...");
        let request_res = url_parsed.into_client_request();
        if let Err(_) = request_res { thread::sleep(std::time::Duration::from_secs(5)); continue; }
        
        let mut request = request_res.unwrap();
        request.headers_mut().insert("Origin", "https://vext-frontend.onrender.com".parse().unwrap());
        
        match connect(request) {
            Ok((mut socket, _)) => {
                 if let Err(_) = match socket.get_mut() {
                    tungstenite::stream::MaybeTlsStream::Plain(s) => s.set_nonblocking(true),
                    tungstenite::stream::MaybeTlsStream::Rustls(s) => s.get_mut().set_nonblocking(true),
                    _ => Ok(()),
                } { thread::sleep(std::time::Duration::from_secs(5)); continue; }

                println!("✅ Connected!");
                let _ = tx_events.send(GameEvent::Error("Connected".to_string()));

                // Send Login/Join
                if let Some(msg) = &pending_login {
                     if let Ok(data) = rmp_serde::to_vec(msg) {
                         let _ = socket.send(Message::Binary(data));
                         println!("📤 Sent Initial Join/Create");
                     }
                }

                let mut last_ping = std::time::Instant::now();
                
                loop {
                    // PING
                    if last_ping.elapsed().as_secs() > 5 {
                        if socket.send(Message::Ping(vec![])).is_err() { break; }
                        last_ping = std::time::Instant::now();
                    }

                    // SEND COMMANDS
                    while let Ok(cmd) = rx_commands.try_recv() {
                         // Update pending login if it's a structural change, technically we don't change login mid-game
                         // but if we disconnect, we might wanna re-join. For now, we reuse initial_msg.
                         
                         if let Ok(data) = rmp_serde::to_vec(&cmd) {
                             let _ = socket.send(Message::Binary(data));
                         }
                    }

                    // READ MESSAGES
                    match socket.read() {
                        Ok(msg) => {
                            match msg {
                                Message::Binary(bin) => {
                                    if let Ok(server_msg) = rmp_serde::from_slice::<ServerMessage>(&bin) {
                                        // Map ServerMessage -> GameEvent
                                        let event = match server_msg {
                                            ServerMessage::NewHost { host_id, .. } => Some(GameEvent::NewHost { host_id }),
                                            ServerMessage::GameState { players, state: _, host_id } => {
                                                Some(GameEvent::GameState { players, host_id })
                                            },
                                            ServerMessage::PlayerJoined { player_id, username, class, hp, max_hp, speed } => {
                                                Some(GameEvent::PlayerJoined { player_id, username, class, hp, max_hp, speed })
                                            },
                                            ServerMessage::PlayerLeft { player_id } => Some(GameEvent::PlayerLeft { player_id }),
                                            ServerMessage::PlayerUpdated { player_id, class } => Some(GameEvent::PlayerUpdated { player_id, class }),
                                            ServerMessage::GameStarted { enemies } => {
                                                println!("WS-THREAD: Received GameStarted with {} enemies", enemies.len());
                                                Some(GameEvent::GameStarted { enemies })
                                            },
                                            ServerMessage::CombatAction { actor_id, target_id, action_name, damage, mana_cost, is_area, target_new_hp } => {
                                                Some(GameEvent::CombatAction { actor_id, target_id, action_name, damage, mana_cost, is_area, target_new_hp })
                                            },
                                            ServerMessage::TurnChanged { current_turn_id } => Some(GameEvent::TurnChanged { current_turn_id }),
                                            ServerMessage::WaveStarted { enemies, gold, exp } => Some(GameEvent::WaveStarted { enemies, gold, exp }),
                                            ServerMessage::GameEnded { victory } => Some(GameEvent::GameEnded { victory }),
                                            ServerMessage::PlayerUpdate { player_id, position, animation } => {
                                                Some(GameEvent::PlayerMove { player_id, position, action: animation })
                                            },
                                            ServerMessage::Error(e) => Some(GameEvent::Error(e)),
                                        };

                                        if let Some(e) = event {
                                            let _ = tx_events.send(e);
                                        }
                                    } else {
                                        eprintln!("Failed to deserialize Binary message");
                                    }
                                }
                                Message::Close(_) => break,
                                _ => {}
                            }
                        }
                         Err(tungstenite::Error::Io(ref e)) if e.kind() == std::io::ErrorKind::WouldBlock => {}
                         Err(_) => break,
                    }

                    thread::sleep(std::time::Duration::from_millis(1)); // WAS 16ms - Optimized for responsiveness
                }
            }
            Err(_) => {
                let _ = tx_events.send(GameEvent::Error("Connecting...".to_string())); 
                thread::sleep(std::time::Duration::from_secs(5));
            }
        }
    }
}
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
