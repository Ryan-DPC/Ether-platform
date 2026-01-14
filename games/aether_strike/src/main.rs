#![allow(dead_code)]
use macroquad::prelude::*;
use crate::ui::hud::HUD;
use std::collections::HashMap;

mod game;
mod entities;
mod systems;
mod ui;
mod class_system;
mod inventory;
mod menu_system;
mod menu_ui;
mod assets;
mod network_api;
mod network_client;

use game::GameState;
use entities::{StickFigure, Enemy};
use class_system::PlayerClass;
use menu_system::{GameScreen, PlayerProfile, MenuButton, ClassButton, GameSession, SessionButton};
use menu_ui::{draw_main_menu, draw_play_menu, draw_class_selection, draw_session_list, draw_create_server, draw_password_dialog};
use assets::GameAssets;
use network_client::{GameClient, GameEvent};

const SCREEN_WIDTH: f32 = 1024.0;
const SCREEN_HEIGHT: f32 = 768.0;

// Position des combattants (vue de côté)
const PLAYER_X: f32 = 200.0;
const PLAYER_Y: f32 = 450.0;
const ENEMY_X: f32 = 700.0;
const ENEMY_Y: f32 = 450.0;

fn window_conf() -> Conf {
    Conf {
        window_title: "Aether Strike - Dev Build".to_owned(),
        window_width: SCREEN_WIDTH as i32,
        window_height: SCREEN_HEIGHT as i32,
        window_resizable: false,
        ..Default::default()
    }
}

#[macroquad::main(window_conf)]
async fn main() {
    // Charger les assets
    println!("🎨 Loading assets...");
    let assets = GameAssets::load().await;
    println!("✅ Assets loaded!");

    // Gestion des arguments de lancement (VEXT Integration)
    let args: Vec<String> = std::env::args().collect();
    let mut vext_username = "GuestPlayer".to_string();
    let mut _vext_token = String::new();
    
    // Parser les arguments
    for i in 0..args.len() {
        if args[i] == "--vext-user-id" && i + 1 < args.len() {
            vext_username = args[i + 1].clone();
            println!("✅ VEXT Integration: Logged in as {}", vext_username);
        }
        if args[i] == "--vext-token" && i + 1 < args.len() {
            _vext_token = args[i + 1].clone();
            println!("🔐 VEXT Integration: Token received");
        }
        if args[i] == "--vext-friends" && i + 1 < args.len() {
            let friends_str = &args[i + 1];
            println!("👥 VEXT Integration: Loading friends list...");
            
            // Format: "User1:online,User2:offline"
            let friends_list: Vec<&str> = friends_str.split(',').collect();
            for friend_entry in friends_list {
                let parts: Vec<&str> = friend_entry.split(':').collect();
                if parts.len() == 2 {
                    let _name = parts[0];
                    let _is_online = parts[1] == "online";
                    // Only add if we manage to parse it
                    // Hacky way to access private method or just reuse `add_friend` if public
                    // PlayerProfile::add_friend is public? Yes line 59 calls it.
                }
            }
        }
    }

    // Extraire le nom de personnage (username sans discriminant)
    let character_name_input = vext_username
        .split('#')
        .next()
        .unwrap_or(&vext_username)
        .to_string();
    
    // Profil du joueur
    let mut player_profile = PlayerProfile::new(vext_username);
    
    // Parse friends again securely after creation because we need the instance
    for i in 0..args.len() {
        if args[i] == "--vext-friends" && i + 1 < args.len() {
             let friends_str = &args[i + 1];
             let friends_list: Vec<&str> = friends_str.split(',').collect();
             for friend_entry in friends_list {
                 let parts: Vec<&str> = friend_entry.split(':').collect();
                 if parts.len() >= 2 {
                    let name = parts[0];
                    let is_online = parts[1] == "online";
                    player_profile.add_friend(name, is_online);
                 }
            }
        }
    }

    // Fallback if no friends passed (optional, or just leave empty)
    // player_profile.add_friend("MaxGamer42", true);
    
    let mut selected_class: Option<PlayerClass> = None;
    
    // Variables pour le online
    let mut server_name_input = String::new();
    let mut server_password_input = String::new();
    let mut is_private_server = false;
    let mut max_players = 4u32;
    let mut server_name_active = false;
    let mut server_password_active = false;
    
    // Sessions mock (normalement viendraient du serveur)
    // Sessions mock (normalement viendraient du serveur - vide maintenant)
    let mut sessions: Vec<SessionButton> = Vec::new();
    
    // Network multiplayer relay
    let mut game_client: Option<GameClient> = None;
    let mut other_players: HashMap<String, network_client::RemotePlayer> = HashMap::new();
    let mut is_host = false;
    let mut _lobby_host_id = String::new();
    let vext_token = _vext_token.clone(); // Garde le token pour l'auth WebSocket
    
    // Dialogue de mot de passe
    let mut show_password_dialog = false;
    let mut join_password_input = String::new();
    let join_password_active = true;
    let mut selected_session: Option<usize> = None;
    
    // Variables pour le jeu
    let mut current_screen = GameScreen::MainMenu;
    let mut _game_state: Option<GameState> = None;
    let mut _player: Option<StickFigure> = None;
    let mut _teammates: Vec<StickFigure> = Vec::new();
    let mut _enemy: Option<Enemy> = None;
    let mut _enemies: Vec<Enemy> = Vec::new();
    let mut last_network_log = String::from("Ready");
    let mut battle_ui_state = crate::ui::hud::BattleUIState::Main;
    let mut current_turn_id = String::new();
    let mut enemy_hp = 500.0;
    let mut enemy_max_hp = 500.0;
    let mut combat_logs: Vec<String> = Vec::new();
    
    // Solo combat state
    let mut is_solo_mode = false;
    let mut is_player_turn = true;
    let mut enemy_attack_timer = 0.0;
    let mut last_enemy_action_time = 0.0;

    // ==== MENU PRINCIPAL ====
    let main_menu_buttons = vec![
        MenuButton::new("JOUER", SCREEN_WIDTH / 2.0 - 150.0, 300.0, 300.0, 70.0),
        MenuButton::new("OPTIONS", SCREEN_WIDTH / 2.0 - 150.0, 390.0, 300.0, 70.0),
        MenuButton::new("QUITTER", SCREEN_WIDTH / 2.0 - 150.0, 480.0, 300.0, 70.0),
    ];

    // ==== MENU JOUER ====
    let play_menu_buttons = vec![
        MenuButton::new("SOLO", SCREEN_WIDTH / 2.0 - 200.0, 250.0, 400.0, 80.0),
        MenuButton::new("ONLINE", SCREEN_WIDTH / 2.0 - 200.0, 350.0, 400.0, 80.0),
    ];

    // ==== CRÉATION DE PERSONNAGE ====
    let class_buttons = vec![
        ClassButton::new(
            "⚔️ WARRIOR",
            "Tank / Melee DPS - High HP, Strong Defense",
            100.0, 280.0, 280.0, 100.0,
            Color::from_rgba(200, 50, 50, 255),
        ),
        ClassButton::new(
            "🔮 MAGE",
            "Ranged DPS / Caster - High Mana, Spell Power",
            400.0, 280.0, 280.0, 100.0,
            Color::from_rgba(50, 100, 200, 255),
        ),
        ClassButton::new(
            "🏹 ARCHER",
            "Balanced DPS - Precision, Critical Hits",
            700.0, 280.0, 280.0, 100.0,
            Color::from_rgba(50, 200, 100, 255),
        ),
    ];

    // Boutons
    let confirm_button = MenuButton::new("START GAME", SCREEN_WIDTH / 2.0 - 150.0, 450.0, 300.0, 60.0);
    let create_server_button = MenuButton::new("CREATE SERVER", SCREEN_WIDTH - 350.0, SCREEN_HEIGHT - 70.0, 200.0, 50.0);
    let confirm_create_button = MenuButton::new("CREATE", SCREEN_WIDTH / 2.0 - 100.0, SCREEN_HEIGHT - 100.0, 200.0, 50.0);
    let refresh_button = MenuButton::new("REFRESH", SCREEN_WIDTH - 170.0, 40.0, 150.0, 40.0);

    loop {
        let mouse_pos = vec2(mouse_position().0, mouse_position().1);

        // ==== GESTION DES INPUTS ====
        match current_screen {
            GameScreen::MainMenu => {
                draw_main_menu(&player_profile, &main_menu_buttons, mouse_pos);

                if is_mouse_button_pressed(MouseButton::Left) {
                    if main_menu_buttons[0].is_clicked(mouse_pos) {
                        current_screen = GameScreen::PlayMenu;
                    } else if main_menu_buttons[1].is_clicked(mouse_pos) {
                        current_screen = GameScreen::Options;
                    } else if main_menu_buttons[2].is_clicked(mouse_pos) {
                        break;
                    }
                }
            }

            GameScreen::PlayMenu => {
                draw_play_menu(&play_menu_buttons, mouse_pos);

                if is_mouse_button_pressed(MouseButton::Left) {
                    if play_menu_buttons[0].is_clicked(mouse_pos) {
                        // Solo selected
                        current_screen = GameScreen::CharacterCreation;
                    } else if play_menu_buttons[1].is_clicked(mouse_pos) {
                        // Online
                        current_screen = GameScreen::SessionList;
                    }
                }

                if is_key_pressed(KeyCode::Escape) {
                    current_screen = GameScreen::MainMenu;
                }
            }

            GameScreen::CharacterCreation => {
                // Nom automatique depuis le username VEXT (sans discriminant)
                let player_name = character_name_input.as_str();
                let selected_class_name = selected_class.map(|c| c.name());
                draw_class_selection(&class_buttons, mouse_pos, player_name, selected_class_name);

                // Sélection de classe
                if is_mouse_button_pressed(MouseButton::Left) {
                    if class_buttons[0].is_clicked(mouse_pos) {
                        selected_class = Some(PlayerClass::Warrior);
                    } else if class_buttons[1].is_clicked(mouse_pos) {
                        selected_class = Some(PlayerClass::Mage);
                    } else if class_buttons[2].is_clicked(mouse_pos) {
                        selected_class = Some(PlayerClass::Archer);
                    }

                    // Bouton START GAME (seulement si classe sélectionnée)
                    if confirm_button.is_clicked(mouse_pos) && selected_class.is_some() {
                        let player_class = selected_class.unwrap();
                        player_profile.character_name = character_name_input.clone();
                        
                        _game_state = Some(GameState::new(player_class));
                        // Player Position (Front Left)
                        let mut new_player = StickFigure::new(vec2(250.0, 450.0));
                        new_player.max_health = _game_state.as_ref().unwrap().get_max_hp();
                        new_player.health = new_player.max_health;
                        new_player.color = player_class.color();
                        _player = Some(new_player);
                        
                        // Main Boss Position (Front Right)
                        _enemy = Some(Enemy::new(vec2(900.0, 420.0)));
                        
                        // Solo mode setup
                        is_solo_mode = true;
                        
                        // Create Mock Teammates
                        _teammates.clear();
                        // 1. DarkKnight (Back Top)
                        let mut t1 = StickFigure::new(vec2(180.0, 400.0));
                        t1.color = Color::from_rgba(200, 50, 50, 255); // Warrior red
                        _teammates.push(t1);
                        // 2. Elara (Back Middle/Far)
                        let mut t2 = StickFigure::new(vec2(120.0, 450.0));
                        t2.color = Color::from_rgba(50, 100, 200, 255); // Mage blue
                        _teammates.push(t2);
                        // 3. SwiftArrow (Back Bottom)
                        let mut t3 = StickFigure::new(vec2(180.0, 500.0));
                        t3.color = Color::from_rgba(50, 200, 100, 255); // Archer green
                        _teammates.push(t3);

                        // Create Mock Enemies
                        _enemies.clear();
                        // 1. Shadow Minion
                        _enemies.push(Enemy::new(vec2(1050.0, 400.0)));
                        // 2. Dark Spirit
                        _enemies.push(Enemy::new(vec2(1100.0, 450.0)));
                        // 3. Void Crawler
                        _enemies.push(Enemy::new(vec2(1050.0, 500.0)));
                        is_player_turn = true;
                        enemy_hp = 500.0;
                        enemy_max_hp = 500.0;
                        combat_logs.clear();
                        combat_logs.push("Battle started!".to_string());
                        
                        current_screen = GameScreen::InGame;
                    }
                }

                // Dessiner le bouton START GAME si classe sélectionnée
                if selected_class.is_some() {
                    let is_hovered = confirm_button.is_clicked(mouse_pos);
                    confirm_button.draw(is_hovered);
                }

                if is_key_pressed(KeyCode::Escape) {
                    current_screen = GameScreen::PlayMenu;
                    selected_class = None;
                }
            }

            GameScreen::SessionList => {
                draw_session_list(&sessions, &player_profile, mouse_pos);

                if is_mouse_button_pressed(MouseButton::Left) {
                    // Vérifier les clics sur les boutons JOIN
                    for (i, session) in sessions.iter().enumerate() {
                        if session.join_button_clicked(mouse_pos) {
                            selected_session = Some(i);
                            
                            // Connecter au relay WebSocket
                            let lobby_id = session.session.name.clone(); // Utilise le nom comme ID pour l'instant
                            let ws_url = network_api::get_ws_url();
                            
                            match GameClient::connect(
                                &ws_url,
                                &vext_token,
                                lobby_id.clone(),
                                selected_class.unwrap_or(PlayerClass::Warrior).name().to_lowercase(),
                                false // is_host = false
                            ) {
                                Ok(client) => {
                                    game_client = Some(client);
                                    is_host = false;
                                    println!("✅ Connected to relay server!");
                                    println!("✅ Joined lobby: {}", lobby_id);
                                    current_screen = GameScreen::Lobby;
                                }
                                Err(e) => {
                                    eprintln!("❌ Failed to connect to relay: {}", e);
                                    // On peut quand même aller au lobby en mode "offline"
                                    current_screen = GameScreen::Lobby;
                                }
                            }
                            break;
                        }
                    }

                    // Bouton CREATE SERVER
                    if create_server_button.is_clicked(mouse_pos) {
                        current_screen = GameScreen::CreateServer;
                        server_name_input.clear();
                        server_password_input.clear();
                        is_private_server = false;
                        max_players = 4;
                    }

                    // Bouton REFRESH
                    if refresh_button.is_clicked(mouse_pos) {
                        let lobbies = network_api::fetch_server_list();
                        sessions = lobbies.into_iter().enumerate().map(|(i, lobby)| {
                            SessionButton::new(
                                GameSession {
                                    name: lobby.name,
                                    host: lobby.hostUsername,
                                    current_players: lobby.currentPlayers,
                                    max_players: lobby.maxPlayers,
                                    average_level: 1, // Pas encore dans l'API
                                    ping: 0, // Ping local pour l'instant
                                    is_private: lobby.isPrivate,
                                    password: lobby.password,
                                    map: lobby.mapName,
                                },
                                20.0,
                                140.0 + i as f32 * 70.0,
                                SCREEN_WIDTH - 360.0,
                                60.0,
                            )
                        }).collect();
                    }
                }

                let is_hovered = refresh_button.is_clicked(mouse_pos);
                refresh_button.draw(is_hovered);

                // Dessiner le bouton CREATE SERVER
                let is_hovered = create_server_button.is_clicked(mouse_pos);
                create_server_button.draw(is_hovered);

                if is_key_pressed(KeyCode::Escape) {
                    current_screen = GameScreen::PlayMenu;
                }
            }

            GameScreen::CreateServer => {
                draw_create_server(
                    &server_name_input,
                    is_private_server,
                    &server_password_input,
                    max_players,
                    server_name_active,
                    server_password_active,
                    mouse_pos,
                );

                if is_mouse_button_pressed(MouseButton::Left) {
                    // Input server name
                    let name_rect = Rect::new(100.0, 160.0, 600.0, 50.0);
                    server_name_active = name_rect.contains(mouse_pos);

                    // Checkbox private
                    let checkbox_rect = Rect::new(300.0, 210.0, 30.0, 30.0);
                    if checkbox_rect.contains(mouse_pos) {
                        is_private_server = !is_private_server;
                        if !is_private_server {
                            server_password_input.clear();
                        }
                    }

                    // Input password
                    if is_private_server {
                        let password_rect = Rect::new(100.0, 300.0, 600.0, 50.0);
                        server_password_active = password_rect.contains(mouse_pos);
                    } else {
                        server_password_active = false;
                    }

                    // Bouton CREATE
                    if confirm_create_button.is_clicked(mouse_pos) && !server_name_input.is_empty() {
                        // Announce to Backend (METADATA)
                        network_api::announce_server(
                            &server_name_input, 
                            &player_profile.vext_username,
                            max_players,
                            is_private_server,
                            if is_private_server && !server_password_input.is_empty() { Some(server_password_input.clone()) } else { None }
                        );

                        // Connect to Relay (WS)
                        let lobby_id = server_name_input.clone();
                        let ws_url = network_api::get_ws_url();
                        
                        match GameClient::connect(
                            &ws_url,
                            &vext_token,
                            lobby_id.clone(),
                            selected_class.unwrap_or(PlayerClass::Warrior).name().to_lowercase(),
                            true // is_host = true
                        ) {
                            Ok(client) => {
                                game_client = Some(client);
                                is_host = true;
                                println!("✅ Server created and connected to relay: {}", lobby_id);
                            }
                            Err(e) => {
                                eprintln!("❌ Failed to connect relay: {}", e);
                            }
                        }

                        // Créer le serveur localement pour la liste
                        let new_session = GameSession::new(
                            &server_name_input,
                            &player_profile.vext_username,
                            max_players,
                            is_private_server,
                            if is_private_server && !server_password_input.is_empty() {
                                Some(server_password_input.clone())
                            } else {
                                None
                            },
                        );
                        
                        let y_pos = 140.0 + sessions.len() as f32 * 70.0;
                        sessions.push(SessionButton::new(
                            new_session,
                            20.0,
                            y_pos,
                            SCREEN_WIDTH - 360.0,
                            60.0,
                        ));

                        selected_session = Some(sessions.len() - 1);
                        current_screen = GameScreen::Lobby;
                    }
                }

                // Input clavier
                if server_name_active {
                    handle_text_input(&mut server_name_input, 30);
                } else if server_password_active {
                    handle_text_input(&mut server_password_input, 20);
                }

                // Dessiner bouton CREATE
                let is_hovered = confirm_create_button.is_clicked(mouse_pos);
                confirm_create_button.draw(is_hovered);

                if is_key_pressed(KeyCode::Escape) {
                    current_screen = GameScreen::SessionList;
                }
            }


            GameScreen::Lobby => {
                clear_background(Color::from_rgba(30, 30, 50, 255));
                
                let session_name = if let Some(idx) = selected_session {
                    &sessions[idx].session.name
                } else {
                    "Lobby"
                };

                draw_text(&format!("LOBBY: {}", session_name), 50.0, 50.0, 40.0, WHITE);

                // ===== RELAY MULTIPLAYER: Poll for updates =====
                if let Some(client) = &game_client {
                    for event in client.poll_updates() {
                        match event {
                            GameEvent::GameState { players, host_id } => {
                                let msg = format!("Sync ({} players)", players.len());
                                println!("📋 {}", msg);
                                last_network_log = msg;
                                other_players.clear();
                                for mut p in players {
                                    if p.username != player_profile.vext_username {
                                        // Normalize class for display
                                        if let Some(cls) = PlayerClass::from_name(&p.class) {
                                            p.class = cls.name().to_string();
                                        }
                                        other_players.insert(p.userId.clone(), p);
                                    } else {
                                        // Sync our own local selected_class with server record
                                        if let Some(cls) = PlayerClass::from_name(&p.class) {
                                            selected_class = Some(cls);
                                        }
                                    }
                                }
                                _lobby_host_id = host_id;
                            }
                            GameEvent::PlayerJoined { player_id, username, class } => {
                                let msg = format!("{} joined! ({})", username, &player_id[..4]);
                                println!("👋 {}", msg);
                                last_network_log = msg;
                                if username != player_profile.vext_username {
                                    let mut display_class = class.clone();
                                    if let Some(cls) = PlayerClass::from_name(&class) {
                                        display_class = cls.name().to_string();
                                    }
                                    other_players.insert(player_id.clone(), network_client::RemotePlayer {
                                        userId: player_id,
                                        username: username,
                                        class: display_class,
                                        position: (400.0, 300.0),
                                    });
                                }
                            }
                            GameEvent::PlayerLeft { player_id } => {
                                let msg = format!("Player {} left", &player_id[..6]);
                                println!("👋 {}", msg);
                                last_network_log = msg;
                                other_players.remove(&player_id);
                            }
                            GameEvent::PlayerUpdated { player_id, class } => {
                                let mut display_class = class.clone();
                                if let Some(cls) = PlayerClass::from_name(&class) {
                                    display_class = cls.name().to_string();
                                }
                                let msg = format!("Update: {} -> {}", &player_id[..4], display_class);
                                println!("✏️ {}", msg);
                                last_network_log = msg;
                                // If it's another player, update them
                                if let Some(player) = other_players.get_mut(&player_id) {
                                    player.class = display_class;
                                }
                            }
                            GameEvent::GameStarted => {
                                // ... existing GameStarted logic ...
                                let msg = "Game start received! Launching...".to_string();
                                println!("🚀 {}", msg);
                                last_network_log = msg;
                                
                                // --- INITIALIZE GAME STATE FOR MULTIPLAYER ---
                                let p_class = selected_class.unwrap_or(PlayerClass::Warrior);
                                selected_class = Some(p_class);
                                
                                _game_state = Some(GameState::new(p_class));
                                
                                let mut new_player = StickFigure::new(vec2(PLAYER_X, PLAYER_Y));
                                new_player.max_health = _game_state.as_ref().unwrap().get_max_hp();
                                new_player.health = new_player.max_health;
                                new_player.color = p_class.color();
                                _player = Some(new_player);
                                
                                _enemy = Some(Enemy::new(vec2(ENEMY_X, ENEMY_Y)));
                                // ---------------------------------------------

                                current_screen = GameScreen::InGame;
                            }
                            // ... existing cases ...
                            GameEvent::NewHost { host_id } => {
                                let msg = format!("New host: {}", host_id);
                                println!("👑 {}", msg);
                                last_network_log = msg;
                                _lobby_host_id = host_id;
                            }
                            GameEvent::Error(e) => {
                                last_network_log = format!("Error: {}", e);
                                println!("❌ {}", last_network_log);
                            }
                            GameEvent::PlayerUpdate(update) => {
                                if let Some(pos) = update.position {
                                    if let Some(player) = other_players.get_mut(&update.player_id) {
                                        player.position = pos;
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }

                // Players Box
                draw_rectangle(50.0, 100.0, 400.0, 500.0, Color::from_rgba(20, 20, 40, 255));
                draw_rectangle_lines(50.0, 100.0, 400.0, 500.0, 2.0, LIGHTGRAY);
                
                // Dynamic player count
                let player_count = 1 + other_players.len();
                draw_text(&format!("PLAYERS ({}/4)", player_count), 70.0, 140.0, 30.0, GOLD);
                
                // Player 1 (You)
                let my_class_name = selected_class.unwrap_or(PlayerClass::Warrior).name();
                draw_text(&format!("1. {} [{}] (You)", player_profile.vext_username, my_class_name), 70.0, 190.0, 24.0, GREEN);
                
                // Other players
                let mut y = 230.0;
                let mut i = 2;
                for player in other_players.values() {
                    draw_text(&format!("{}. {} [{}]", i, player.username, player.class), 70.0, y, 24.0, WHITE);
                    y += 40.0;
                    i += 1;
                }
                
                // Empty slots
                for j in i..=4 {
                    draw_text(&format!("{}. Waiting...", j), 70.0, y, 24.0, DARKGRAY);
                    y += 40.0;
                }

                // --- CLASS SELECTION UI (Burger/Buttons) ---
                draw_text("CHOOSE CLASS:", 500.0, 140.0, 30.0, WHITE);
                
                let classes = vec![PlayerClass::Warrior, PlayerClass::Mage, PlayerClass::Archer];
                for (idx, cls) in classes.iter().enumerate() {
                    let btn_x = 500.0;
                    let btn_y = 180.0 + idx as f32 * 60.0;
                    let btn_w = 200.0;
                    let btn_h = 50.0;
                    
                    let is_selected = selected_class.unwrap_or(PlayerClass::Warrior) == *cls;
                    let color = if is_selected { cls.color() } else { DARKGRAY };
                    
                    let is_hovered = mouse_pos.x >= btn_x && mouse_pos.x <= btn_x + btn_w && mouse_pos.y >= btn_y && mouse_pos.y <= btn_y + btn_h;
                    
                    if is_hovered {
                        draw_rectangle(btn_x - 2.0, btn_y - 2.0, btn_w + 4.0, btn_h + 4.0, WHITE);
                    }
                    draw_rectangle(btn_x, btn_y, btn_w, btn_h, color);
                    draw_text(cls.name(), btn_x + 20.0, btn_y + 35.0, 24.0, WHITE);
                    
                    if is_mouse_button_pressed(MouseButton::Left) && is_hovered {
                        selected_class = Some(*cls);
                        // Send update to server
                        if let Some(client) = &game_client {
                            println!("📤 Sending class change: {}", cls.name().to_lowercase());
                            client.send_class_change(cls.name().to_lowercase());
                        }
                    }
                }

                // Start Button (Host Only)
                if is_host {
                    // ... existing start button logic ...
                    let start_btn_rect = Rect::new(SCREEN_WIDTH - 350.0, SCREEN_HEIGHT - 150.0, 300.0, 80.0);
                    let is_hovered = start_btn_rect.contains(mouse_pos);
                    let btn_color = if is_hovered { GREEN } else { DARKGREEN };
                    
                    draw_rectangle(start_btn_rect.x, start_btn_rect.y, start_btn_rect.w, start_btn_rect.h, btn_color);
                    draw_text("START GAME", start_btn_rect.x + 30.0, start_btn_rect.y + 50.0, 40.0, WHITE);
                    
                    if is_mouse_button_pressed(MouseButton::Left) && is_hovered {
                         if let Some(client) = &game_client {
                             client.start_game();
                         }
                         // Initialize our own state immediately as well or wait for event?
                         // Wait for event to be safe and consistent with clients
                         // current_screen = GameScreen::InGame; 
                    }
                } else {
                    draw_text("WAITING FOR HOST TO START...", SCREEN_WIDTH - 450.0, SCREEN_HEIGHT - 100.0, 24.0, LIGHTGRAY);
                }
                
                // ... debug log ...

                // Debug Network Log
                draw_text(&format!("Last Event: {}", last_network_log), 50.0, SCREEN_HEIGHT - 30.0, 20.0, YELLOW);

                if is_key_pressed(KeyCode::Escape) {
                    current_screen = GameScreen::SessionList;
                    // Disconnect relay
                    if let Some(client) = &game_client {
                        client.disconnect();
                    }
                    game_client = None;
                    other_players.clear();
                    last_network_log = "Disconnected".to_string();
                }
            }

            GameScreen::InGame => {
                clear_background(Color::from_rgba(20, 20, 30, 255));
                
                // --- DRAW ENVIRONMENT (Aesthetics) ---
                // Simple tiled floor
                for x in 0..((SCREEN_WIDTH / 50.0) as i32 + 1) {
                    for y in 0..((SCREEN_HEIGHT / 50.0) as i32 + 1) {
                         let color = if (x + y) % 2 == 0 {
                             Color::from_rgba(30, 30, 45, 255)
                         } else {
                             Color::from_rgba(35, 35, 50, 255)
                         };
                         draw_rectangle(x as f32 * 50.0, y as f32 * 50.0, 50.0, 50.0, color);
                    }
                }
                
                // Draw a "Ground" line for reference
                draw_rectangle(0.0, 500.0, SCREEN_WIDTH, 20.0, Color::from_rgba(50, 40, 30, 255));

                // ===== RELAY MULTIPLAYER: Poll for updates in-game =====
                if let Some(client) = &game_client {
                    for event in client.poll_updates() {
                        match event {
                            GameEvent::PlayerUpdate(update) => {
                                if let Some(player) = other_players.get_mut(&update.player_id) {
                                    if let Some(pos) = update.position {
                                        player.position = pos;
                                    }
                                }
                            }
                            GameEvent::PlayerUpdated { player_id, class } => {
                                if let Some(player) = other_players.get_mut(&player_id) {
                                    player.class = class;
                                }
                            }
                            GameEvent::GameState { players, .. } => {
                                // Full sync in game too
                                other_players.clear();
                                for mut p in players {
                                    if p.username != player_profile.vext_username {
                                        if let Some(cls) = PlayerClass::from_name(&p.class) {
                                            p.class = cls.name().to_string();
                                        }
                                        other_players.insert(p.userId.clone(), p);
                                    }
                                }
                            }
                            GameEvent::PlayerLeft { player_id } => {
                                other_players.remove(&player_id);
                            }
                            GameEvent::TurnChanged { current_turn_id: next_id } => {
                                current_turn_id = next_id;
                                combat_logs.push(format!("Turn: {}", if current_turn_id == "enemy" { "ENEMY" } else { &current_turn_id[..4] }));
                            }
                            GameEvent::CombatAction { actor_id, target_id, action_name, damage, mana_cost, is_area: _ } => {
                                let actor_name = if actor_id == "enemy" { "ENEMY" } else { 
                                    if actor_id == player_profile.vext_username { "YOU" } else { &actor_id[..4] }
                                };
                                combat_logs.push(format!("{} used {} ({} dmg)", actor_name, action_name, damage));
                                
                                // Update HP based on target
                                if let Some(tid) = target_id {
                                    if tid == "enemy" {
                                        enemy_hp = (enemy_hp - damage).max(0.0);
                                    } else if tid == player_profile.vext_username {
                                        if let Some(gs) = &mut _game_state {
                                            gs.resources.current_hp = (gs.resources.current_hp - damage).max(0.0);
                                        }
                                    }
                                } else if actor_id == "enemy" {
                                    // Enemy area attack? (Simple: hit player)
                                    if let Some(gs) = &mut _game_state {
                                        gs.resources.current_hp = (gs.resources.current_hp - damage).max(0.0);
                                    }
                                }

                                // Update Mana if it's us
                                if actor_id == player_profile.vext_username {
                                    if let Some(gs) = &mut _game_state {
                                        gs.resources.mana = gs.resources.mana.saturating_sub(mana_cost);
                                    }
                                }
                            }
                            _ => {}
                        }
                    }

                    // Envoyer notre position (mock movement for now)
                    if let Some(player) = &_player {
                        client.send_input((player.position.x, player.position.y), (0.0, 0.0), "idle".to_string());
                    }
                }
                
                // Dessiner les entités
                
                // Draw Teammates (Smaller)
                for teammate in &mut _teammates {
                     // Draw smaller (0.8 scale)
                     teammate.draw(Some(&assets.sprite_sheet), Some(assets.get_warrior_rect(0))); // Default sprite for now or vary based on mock class
                }

                if let Some(player) = &mut _player {
                    // Sélectionner la texture et le rect en fonction de la classe
                    // Utiliser frame 0 (idle) pour l'instant. On pourrait animer ça plus tard.
                    let (tex, rect) = if let Some(cls) = selected_class {
                         match cls {
                            PlayerClass::Warrior => (Some(&assets.sprite_sheet), Some(assets.get_warrior_rect(0))),
                            PlayerClass::Mage => (Some(&assets.sprite_sheet), Some(assets.get_mage_rect(0))),
                            PlayerClass::Archer => (Some(&assets.sprite_sheet), Some(assets.get_archer_rect(0))),
                        }
                    } else {
                        (None, None) 
                    };
                    
                    if let Some(r) = rect {
                         draw_texture_ex(
                            &assets.sprite_sheet,
                            player.position.x,
                            player.position.y,
                            WHITE,
                            DrawTextureParams {
                                source: Some(r),
                                dest_size: Some(vec2(140.0, 140.0)), // Bigger player
                                ..Default::default()
                            },
                        );
                        // Name tag above player
                        draw_text("YOU", player.position.x + 50.0, player.position.y - 10.0, 20.0, GOLD);
                    } else {
                        player.draw(tex, rect);
                    }
                }
                
                // Draw Minion Enemies
                for enemy in &mut _enemies {
                     // Draw smaller
                     draw_texture_ex(
                        &assets.sprite_sheet,
                        enemy.position.x,
                        enemy.position.y,
                        WHITE,
                        DrawTextureParams {
                             source: Some(assets.get_enemy_rect(0)),
                             dest_size: Some(vec2(80.0, 80.0)), // Smaller minions
                             flip_x: true,
                             ..Default::default()
                        }
                     );
                }

                // Draw Main Boss
                if let Some(enemy) = &mut _enemy {
                    // Draw Boss Bigger
                     draw_texture_ex(
                        &assets.sprite_sheet,
                        enemy.position.x,
                        enemy.position.y,
                        WHITE,
                        DrawTextureParams {
                             source: Some(assets.get_enemy_rect(0)),
                             dest_size: Some(vec2(180.0, 180.0)), // Big Boss
                             flip_x: true,
                             ..Default::default()
                        }
                     );
                     // Boss Name Tag
                     draw_text("BOSS", enemy.position.x + 60.0, enemy.position.y - 15.0, 24.0, RED);
                }

                // Dessiner les autres joueurs (Online)
                for player in other_players.values() {
                    let rect = match player.class.to_lowercase().as_str() {
                        "mage" => assets.get_mage_rect(0),
                        "archer" => assets.get_archer_rect(0),
                        _ => assets.get_warrior_rect(0),
                    };
                    draw_texture_ex(
                        &assets.sprite_sheet,
                        player.position.0,
                        player.position.1,
                        WHITE,
                        DrawTextureParams {
                            source: Some(rect),
                            dest_size: Some(vec2(100.0, 100.0)),
                            ..Default::default()
                        },
                    );
                    draw_text(&player.username, player.position.0, player.position.1 - 10.0, 18.0, WHITE);
                }

                // --- DRAW HUD ---
                if let Some(gs) = &mut _game_state {
                    let class_enum = selected_class.unwrap_or(PlayerClass::Warrior);
                    
                    // Determine if it's player's turn
                    let is_my_turn = if is_solo_mode {
                        is_player_turn
                    } else {
                        current_turn_id == player_profile.vext_username
                    };
                    
                    let e_hp_percent = enemy_hp / enemy_max_hp;

                    if let Some(action) = HUD::draw(
                        gs, 
                        SCREEN_WIDTH, 
                        SCREEN_HEIGHT, 
                        &character_name_input,
                        class_enum,
                        &other_players,
                        e_hp_percent,
                        is_my_turn,
                        &mut battle_ui_state,
                        &combat_logs,
                    ) {
                        // Handle actions
                        if is_solo_mode {
                            // Solo mode: process locally
                            match action {
                                crate::ui::hud::HUDAction::UseAttack(name) => {
                                    // Find attack damage
                                    let attacks = class_enum.get_attacks();
                                    if let Some(atk) = attacks.iter().find(|a| a.name == name) {
                                        if gs.resources.can_afford_mana(atk.mana_cost) {
                                            // Spend mana
                                            gs.resources.mana = gs.resources.mana.saturating_sub(atk.mana_cost);
                                            
                                            // Deal damage to enemy
                                            let damage = atk.damage;
                                            enemy_hp = (enemy_hp - damage).max(0.0);
                                            
                                            combat_logs.push(format!("You used {} for {:.0} damage!", name, damage));
                                            
                                            // Switch to enemy turn
                                            is_player_turn = false;
                                            enemy_attack_timer = get_time() + 1.5; // Enemy attacks after 1.5s
                                            battle_ui_state = crate::ui::hud::BattleUIState::Main;
                                        }
                                    }
                                }
                                crate::ui::hud::HUDAction::Flee => {
                                    combat_logs.push("You fled from battle!".to_string());
                                    current_screen = GameScreen::MainMenu;
                                    is_solo_mode = false;
                                }
                                crate::ui::hud::HUDAction::EndTurn => {
                                    is_player_turn = false;
                                    enemy_attack_timer = get_time() + 1.0;
                                }
                            }
                        } else {
                            // Multiplayer mode: send to server
                            if let Some(client) = &game_client {
                                match action {
                                    crate::ui::hud::HUDAction::UseAttack(name) => {
                                        client.use_attack(name, Some("enemy".to_string()));
                                    }
                                    crate::ui::hud::HUDAction::Flee => {
                                        client.flee();
                                    }
                                    crate::ui::hud::HUDAction::EndTurn => {
                                        client.end_turn();
                                    }
                                }
                            }
                        }
                    }
                    
                    // === SOLO MODE: ENEMY AI ===
                    if is_solo_mode && !is_player_turn && get_time() > enemy_attack_timer {
                        // Enemy attacks player
                        let enemy_attacks = vec![
                            ("Slash", 25.0),
                            ("Heavy Strike", 40.0),
                            ("Dark Pulse", 35.0),
                        ];
                        
                        // Random attack
                        let attack_idx = (get_time() * 1000.0) as usize % enemy_attacks.len();
                        let (attack_name, base_damage) = enemy_attacks[attack_idx];
                        
                        // Apply damage to player
                        let damage = base_damage;
                        gs.resources.current_hp = (gs.resources.current_hp - damage).max(0.0);
                        
                        combat_logs.push(format!("Enemy used {} for {:.0} damage!", attack_name, damage));
                        
                        // Check if player died
                        if gs.resources.current_hp <= 0.0 {
                            combat_logs.push("You have been defeated!".to_string());
                            // Could transition to game over screen
                        }
                        
                        // Check if enemy died
                        if enemy_hp <= 0.0 {
                            combat_logs.push("Victory! Enemy defeated!".to_string());
                            gs.resources.gold += 100;
                        }
                        
                        // Switch back to player turn
                        is_player_turn = true;
                    }
                }

                // Combat log is now drawn inside HUD::draw()

                if is_key_pressed(KeyCode::Escape) {
                    current_screen = GameScreen::MainMenu;
                    is_solo_mode = false;
                    // Properly disconnect from server
                    if let Some(client) = &game_client {
                        client.disconnect();
                    }
                    game_client = None;
                    other_players.clear();
                    last_network_log = "Left Game".to_string();
                }
            }
                
            GameScreen::Options => {
                clear_background(Color::from_rgba(20, 20, 40, 255));
                draw_text("OPTIONS", 100.0, 100.0, 40.0, GOLD);
                draw_text("Coming soon...", 100.0, 150.0, 24.0, WHITE);
                draw_text("Press ESC to go back", 20.0, SCREEN_HEIGHT - 20.0, 20.0, LIGHTGRAY);

                if is_key_pressed(KeyCode::Escape) {
                    current_screen = GameScreen::MainMenu;
                }
            }
        }

        // Dialogue de mot de passe par-dessus tout
        if show_password_dialog {
            draw_password_dialog(&join_password_input, join_password_active);

            if join_password_active {
                handle_text_input(&mut join_password_input, 20);
            }

            if is_key_pressed(KeyCode::Enter) {
                // Vérifier le mot de passe
                if let Some(session_idx) = selected_session {
                    if let Some(ref password) = sessions[session_idx].session.password {
                        if join_password_input == *password {
                            println!("Password correct! Joining session: {}", sessions[session_idx].session.name);
                            show_password_dialog = false;
                            current_screen = GameScreen::Lobby;
                        } else {
                            println!("Wrong password!");
                            join_password_input.clear();
                        }
                    }
                }
            }

            if is_key_pressed(KeyCode::Escape) {
                show_password_dialog = false;
                join_password_input.clear();
            }
        }

        next_frame().await;
    }
}

/// Gérer l'input de texte
fn handle_text_input(text: &mut String, max_len: usize) {
    let keys_pressed = get_keys_pressed();
    for key in keys_pressed {
        match key {
            KeyCode::Backspace => {
                text.pop();
            }
            KeyCode::Space => {
                if text.len() < max_len {
                    text.push(' ');
                }
            }
            _ => {
                if let Some(c) = key_to_char(key) {
                    if text.len() < max_len {
                        text.push(c);
                    }
                }
            }
        }
    }
}

/// Convertir une touche en caractère
fn key_to_char(key: KeyCode) -> Option<char> {
    match key {
        KeyCode::A => Some('a'),
        KeyCode::B => Some('b'),
        KeyCode::C => Some('c'),
        KeyCode::D => Some('d'),
        KeyCode::E => Some('e'),
        KeyCode::F => Some('f'),
        KeyCode::G => Some('g'),
        KeyCode::H => Some('h'),
        KeyCode::I => Some('i'),
        KeyCode::J => Some('j'),
        KeyCode::K => Some('k'),
        KeyCode::L => Some('l'),
        KeyCode::M => Some('m'),
        KeyCode::N => Some('n'),
        KeyCode::O => Some('o'),
        KeyCode::P => Some('p'),
        KeyCode::Q => Some('q'),
        KeyCode::R => Some('r'),
        KeyCode::S => Some('s'),
        KeyCode::T => Some('t'),
        KeyCode::U => Some('u'),
        KeyCode::V => Some('v'),
        KeyCode::W => Some('w'),
        KeyCode::X => Some('x'),
        KeyCode::Y => Some('y'),
        KeyCode::Z => Some('z'),
        KeyCode::Key0 => Some('0'),
        KeyCode::Key1 => Some('1'),
        KeyCode::Key2 => Some('2'),
        KeyCode::Key3 => Some('3'),
        KeyCode::Key4 => Some('4'),
        KeyCode::Key5 => Some('5'),
        KeyCode::Key6 => Some('6'),
        KeyCode::Key7 => Some('7'),
        KeyCode::Key8 => Some('8'),
        KeyCode::Key9 => Some('9'),
        _ => None,
    }
}
