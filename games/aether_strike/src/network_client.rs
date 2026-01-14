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

#[derive(Debug, Clone)]
pub enum GameEvent {
    PlayerJoined { player_id: String, username: String },
    PlayerLeft { player_id: String },
    PlayerUpdate(PlayerUpdate),
    GameState { players: Vec<RemotePlayer>, host_id: String },
    GameStarted,
    NewHost { host_id: String },
    Error(String),
}

// Client WebSocket pour le jeu
pub struct GameClient {
    // Channel pour envoyer des commandes au thread WS
    tx_to_ws: Sender<WsCommand>,
    // Channel pour recevoir les événements du thread WS
    rx_from_ws: Receiver<GameEvent>,
}

// Commandes que le jeu peut envoyer au thread WS
enum WsCommand {
    SendInput { position: (f32, f32), velocity: (f32, f32), action: String },
    SendAttack { target_pos: (f32, f32) },
    StartGame,
    Disconnect,
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
    pub fn connect(ws_url: &str, token: &str, game_id: String, player_class: String, is_host: bool) -> Result<Self, String> {
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

        // Lancer le thread WebSocket
        thread::spawn(move || {
            if let Err(e) = ws_thread_loop(full_url, game_id_clone, player_class_clone, is_host, rx_in_ws, tx_from_ws) {
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

    /// Envoie une attaque
    pub fn send_attack(&self, target_pos: (f32, f32)) {
        let _ = self.tx_to_ws.send(WsCommand::SendAttack { target_pos });
    }

    /// Démarre la partie (Hôte uniquement)
    pub fn start_game(&self) {
        let _ = self.tx_to_ws.send(WsCommand::StartGame);
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
) -> Result<(), String> {
    // Connexion WebSocket
    let url_parsed = Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
    let (mut socket, _response) = connect(url_parsed)
        .map_err(|e| format!("Connection failed: {}", e))?;

    println!("✅ WebSocket connected");

    // Rejoindre ou Créer la partie
    let join_type = if is_host { "aether-strike:create-game" } else { "aether-strike:join-game" };
    let join_msg = serde_json::json!({
        "type": join_type,
        "data": {
            "gameId": game_id,
            "playerClass": player_class,
            "maxPlayers": 4
        }
    });
    
    socket.send(Message::Text(join_msg.to_string()))
        .map_err(|e| format!("Failed to initiate game: {}", e))?;

    println!("🎮 {} game: {}", if is_host { "Created" } else { "Joined" }, game_id);

    // Boucle principale
    loop {
        // 1. Traiter les commandes du jeu (non-bloquant)
        while let Ok(cmd) = rx_commands.try_recv() {
            match cmd {
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
                WsCommand::StartGame => {
                    let msg = serde_json::json!({
                        "type": "aether-strike:start-game",
                        "data": {}
                    });
                    let _ = socket.send(Message::Text(msg.to_string()));
                }
                WsCommand::SendAttack { target_pos } => {
                    let msg = serde_json::json!({
                        "type": "aether-strike:player-attack",
                        "data": {
                            "targetPos": [target_pos.0, target_pos.1]
                        }
                    });
                    let _ = socket.send(Message::Text(msg.to_string()));
                }
                WsCommand::Disconnect => {
                    let leave_msg = serde_json::json!({
                        "type": "aether-strike:leave-game",
                        "data": {}
                    });
                    let _ = socket.send(Message::Text(leave_msg.to_string()));
                    return Ok(());
                }
            }
        }

        // 2. Lire les messages du serveur (non-bloquant)
        match socket.read() {
            Ok(msg) => {
                if let Message::Text(text) = msg {
                    if let Ok(parsed) = serde_json::from_str::<Value>(&text) {
                        if let Some(event_type) = parsed["type"].as_str() {
                            let data = &parsed["data"];
                            
                            let game_event = match event_type {
                                "aether-strike:player-joined" => {
                                    Some(GameEvent::PlayerJoined {
                                        player_id: data["playerId"].as_str().unwrap_or("").to_string(),
                                        username: data["username"].as_str().unwrap_or("Unknown").to_string(),
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
                                "aether-strike:game-started" => {
                                    Some(GameEvent::GameStarted)
                                }
                                _ => None
                            };

                            if let Some(event) = game_event {
                                let _ = tx_events.send(event);
                            }
                        }
                    }
                }
            }
            Err(tungstenite::Error::Io(ref e)) if e.kind() == std::io::ErrorKind::WouldBlock => {
                // Pas de données disponibles, c'est normal en mode non-bloquant
            }
            Err(e) => {
                eprintln!("WebSocket error: {}", e);
                let _ = tx_events.send(GameEvent::Error(format!("{}", e)));
                return Err(format!("WS error: {}", e));
            }
        }

        // Petit sleep pour ne pas manger 100% CPU
        std::thread::sleep(std::time::Duration::from_millis(16)); // ~60 UPS
    }
}
