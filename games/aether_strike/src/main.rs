#![allow(dead_code)]
use macroquad::prelude::*;
use crate::input::handle_text_input;
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
mod launcher;
mod input;
mod draw;
mod server;
mod backend;
pub mod waves;
mod modules; // New Module Hub
mod network_handler;
mod combat_system;
mod world_renderer;

use game::GameState;
use entities::{StickFigure, Enemy};
use menu_system::{GameScreen, PlayerProfile, GameSession};
use crate::ui::hud::{HUD, HUDAction};
// Use new modules
use modules::button::{MenuButton, ClassButton, SessionButton};
use modules::turn::TurnSystem;
use modules::position::*; // Import constants directly
use class_system::CharacterClass;
use menu_ui::{draw_create_server, draw_password_dialog};
use assets::GameAssets;
use network_client::{GameClient, GameEvent};

const SCREEN_WIDTH: f32 = 1024.0;
const SCREEN_HEIGHT: f32 = 768.0;

// Position constants now imported from modules::position


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
    // ==== CHARGEMENT DES CLASSES DYNAMIQUE ====
    println!("📚 Loading character classes...");
    let all_classes = crate::class_system::CharacterClass::load_all();
    println!("✅ Loaded {} classes!", all_classes.len());

    // Charger les assets (besoin des classes pour les textures spécifiques)
    println!("🎨 Loading assets...");
    let assets = GameAssets::load(&all_classes).await;
    println!("✅ Assets loaded!");

    // Gestion des arguments de lancement (VEXT Integration)
    let (launcher_config, mut player_profile) = launcher::parse_launch_args();
    let vext_username = launcher_config.username;
    let _vext_token = launcher_config.token;
    let vext_token = _vext_token.clone();
    
    // DEBUG: Show CWD and Token Status
    if let Ok(cwd) = std::env::current_dir() {
        println!("📂 Current Working Directory: {:?}", cwd);
    }
    if vext_token.is_empty() {
        println!("⚠️ WARNING: No VEXT Token provided! Online multiplayer will fail.");
        println!("⚠️ Run with: --vext-token <YOUR_JWT_TOKEN>");
    } else {
        println!("🔑 Token provided (len: {})", vext_token.len());
    }

    // Extraire le nom de personnage (username sans discriminant)
    let character_name_input = vext_username
        .split('#')
        .next()
        .unwrap_or(&vext_username)
        .to_string();

    // Fallback if no friends passed (optional, or just leave empty)
    // player_profile.add_friend("MaxGamer42", true);
    
    let mut selected_class: Option<CharacterClass> = None;
    
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
    
    // Network manager (Refactored)
    let mut network_manager = server::NetworkManager::new();
    
    // Renderer (Refactored)
    let renderer = draw::Renderer::new(&assets, &all_classes);
    let mut other_players: HashMap<String, network_client::RemotePlayer> = HashMap::new();
    let mut is_host = false;
    let mut _lobby_host_id = String::new();
    // let vext_token = _vext_token.clone(); // Duplicate removed
    
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
    let mut wave_manager = waves::WaveManager::new();
    let mut last_network_log = String::from("Ready");
    let mut battle_ui_state = crate::ui::hud::BattleUIState::Main;
    let mut current_turn_id = String::new();
    let mut enemy_hp = 500.0;

    let mut combat_logs: Vec<String> = Vec::new();
    
    // Solo combat state
    let mut turn_system = TurnSystem::new();
    // turn_queue/index replaced by turn_system
    
    let mut enemy_attack_timer = 0.0;
    let _last_enemy_action_time = 0.0;
    
    let mut is_solo_mode = true;
    let mut is_player_turn = true;
    let mut lobby_entry_time = 0.0;


    // ==== MENU PRINCIPAL ====
    let main_menu_buttons = vec![
        MenuButton::new("JOUER", SCREEN_WIDTH / 2.0 - 150.0, 300.0, 300.0, 70.0),
        MenuButton::new("BOUTIQUE", SCREEN_WIDTH / 2.0 - 150.0, 390.0, 300.0, 70.0),
        MenuButton::new("OPTIONS", SCREEN_WIDTH / 2.0 - 150.0, 480.0, 300.0, 70.0),
        MenuButton::new("QUITTER", SCREEN_WIDTH / 2.0 - 150.0, 570.0, 300.0, 70.0),
    ];

    // ==== MENU JOUER ====
    let play_menu_buttons = vec![
        MenuButton::new("SOLO", SCREEN_WIDTH / 2.0 - 200.0, 250.0, 400.0, 80.0),
        MenuButton::new("ONLINE", SCREEN_WIDTH / 2.0 - 200.0, 350.0, 400.0, 80.0),
    ];


    let mut class_buttons = Vec::new();
    for (idx, cls) in all_classes.iter().enumerate() {
        let cols = 5;
        let x = 22.0 + (idx % cols) as f32 * 200.0;
        let y = 280.0 + (idx / cols) as f32 * 105.0;
        
        class_buttons.push(ClassButton::new(
            &cls.name,
            &cls.role,
            x, y, 190.0, 95.0,
            cls.color(),
        ));
    }

    // Boutons
    let confirm_button = MenuButton::new("START GAME", SCREEN_WIDTH / 2.0 - 150.0, SCREEN_HEIGHT - 80.0, 300.0, 60.0);
    let create_server_button = MenuButton::new("CREATE SERVER", SCREEN_WIDTH - 350.0, SCREEN_HEIGHT - 70.0, 200.0, 50.0);
    let confirm_create_button = MenuButton::new("CREATE", SCREEN_WIDTH / 2.0 - 100.0, SCREEN_HEIGHT - 100.0, 200.0, 50.0);
    let refresh_button = MenuButton::new("REFRESH", SCREEN_WIDTH - 170.0, 40.0, 150.0, 40.0);
    let start_btn = MenuButton::new("START", SCREEN_WIDTH / 2.0 - 100.0, SCREEN_HEIGHT - 100.0, 200.0, 50.0); // For lobby


    loop {
        let mouse_pos = vec2(mouse_position().0, mouse_position().1);

        // ==== GESTION DES INPUTS ====
        match current_screen {
            GameScreen::MainMenu => {
                renderer.draw_main_menu(&player_profile, &main_menu_buttons, mouse_pos);

                if is_mouse_button_pressed(MouseButton::Left) {
                    if main_menu_buttons[0].is_clicked(mouse_pos) {
                        current_screen = GameScreen::PlayMenu;
                    } else if main_menu_buttons[1].is_clicked(mouse_pos) {
                        // SHOP Clicked - Placeholder
                        println!("Boutique clicked (Not implemented)");
                    } else if main_menu_buttons[2].is_clicked(mouse_pos) {
                        current_screen = GameScreen::Options;
                    } else if main_menu_buttons[3].is_clicked(mouse_pos) {
                        break;
                    }
                }
            }

            GameScreen::PlayMenu => {
                renderer.draw_play_menu(&play_menu_buttons, mouse_pos);

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
                let selected_class_name = selected_class.as_ref().map(|c| c.name.as_str());
                renderer.draw_class_selection(&class_buttons, mouse_pos, player_name, selected_class_name);

                // Sélection de classe
                if is_mouse_button_pressed(MouseButton::Left) {
                    for (idx, btn) in class_buttons.iter().enumerate() {
                        if btn.is_clicked(mouse_pos) {
                            selected_class = Some(all_classes[idx].clone());
                            break;
                        }
                    }

                    // Bouton START GAME (seulement si classe sélectionnée)
                    if confirm_button.is_clicked(mouse_pos) && selected_class.is_some() {
                        let player_class = selected_class.as_ref().unwrap();
                        player_profile.character_name = character_name_input.clone();
                        
                        _game_state = Some(GameState::new(player_class.clone()));
                        // Player Position (Front Left)
                        let mut new_player = StickFigure::new(vec2(250.0, 450.0), "You".to_string());
                        new_player.max_health = player_class.hp;
                        new_player.health = new_player.max_health;
                        new_player.color = player_class.color();
                        _player = Some(new_player);
                        
                        // Main Boss Position (Front Right)
                        _enemy = None; // Will be spawned by WaveManager
                        
                        // Solo mode setup
                        is_solo_mode = true;

                        
                        // Reposition Player to Slot 0
                        if let Some(p) = &mut _player {
                            p.position = PLAYER_POSITIONS[0];
                        }
                        
                        // Clear Teammates (No Mocks)
                        _teammates.clear();
                        if !is_solo_mode { 
 
                            // ... 
                        }
                        // Actually, is_solo_mode is used later in loop. I need to decl it outside.
                        // Wait, is_solo_mode was defined at top level scope in main.rs line 93 (approx)?
                        // Let's check if I deleted it. Use view_file to check top scope variables.
                        // Assuming I need to restore it at top.


                        // Clear Enemies - They will be spawned by WaveManager
                        _enemies.clear();
                        _enemy = None;
                        
                        // Initialize WaveManager
                        wave_manager = waves::WaveManager::new();
                        
                        // --- TURN QUEUE INITIALIZATION ---
                        turn_system.init_queue(
                            &player_profile.vext_username,
                            if let Some(gs) = &_game_state { gs.resources.speed as u32 } else { 100 },
                           &other_players,
                           &_enemies,
                           _enemy.as_ref()
                        );
                        turn_system.log_state(); // DEBUG INITIAL STATE
                        current_turn_id = turn_system.get_current_id().to_string(); // Keep local copy for HUD or just use getter? HUD uses var. 
                        // HUD was using `current_turn_id`. Let's update HUD call later or update the var here.
                        // Actually, I should update `current_turn_id` usage everywhere or simply sync it.
                        // For this chunk, I will init and set local var.
                        
                        
                        // 2. Add Enemies (Wave 1 should be spawned by next update, but let's force spawn or handle in update?)
                        // WaveManager spawns in update(), so queue init might need to happen there or force first spawn here.
                        // Let's force update once to spawn Wave 1
                        // 2. Add Enemies - Handled by init_queue now if _enemies populated.
                        // However, _enemies might be empty here if spawned later.
                        // Use WaveManager to get accurate enemies for init.
                        // WaveManager logic
                        if let Some(_wave) = wave_manager.get_current_wave() {

                        
                        current_turn_id = turn_system.get_current_id().to_string();
                        
                        enemy_hp = 0.0; // Reset, will be set by wave spawn

                        combat_logs.clear();
                        combat_logs.push("Battle started!".to_string());
                        
                        println!("DEBUG INIT: _enemies count = {}, solo boss = {:?}", _enemies.len(), _enemy.is_some());
                        if let Some(e) = _enemies.first() {
                            println!("  First Enemy Pos: ({}, {})", e.position.x, e.position.y);
                        }

                        current_screen = GameScreen::InGame;
                    }
                    }
                }

                // Dessiner le bouton START GAME si classe sélectionnée
                if let Some(_player_class) = &selected_class {
                    let is_hovered = confirm_button.is_clicked(mouse_pos);
                    confirm_button.draw(is_hovered);
                }

                if is_key_pressed(KeyCode::Escape) {
                    current_screen = GameScreen::PlayMenu;
                    selected_class = None;
                }
            }

            GameScreen::SessionList => {
                renderer.draw_session_list(&sessions, &player_profile, mouse_pos);

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
                                selected_class.as_ref().map(|c| c.name.to_lowercase()).unwrap_or_else(|| "warrior".to_string()),
                                false, // is_host = false
                                player_profile.vext_username.clone(),
                                player_profile.vext_username.clone() // UserID
                            ) {
                                Ok(client) => {
                                    network_manager.client = Some(client);
                                    is_host = false;
                                    println!("✅ Connected to relay server!");
                                    println!("✅ Joined lobby: {}", lobby_id);
                                    current_screen = GameScreen::Lobby;
                                }
                                Err(e) => {
                                    eprintln!("❌ Failed to connect to relay: {}", e);
                                    // On peut quand même aller au lobby en mode "offline"
                                    current_screen = GameScreen::Lobby;
                                    lobby_entry_time = get_time();
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
                        sessions = backend::refresh_sessions();
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
                            selected_class.as_ref().map(|c| c.name.clone()).unwrap_or_else(|| "warrior".to_string()).to_lowercase(),
                            true, // is_host = true
                            player_profile.vext_username.clone(),
                            player_profile.vext_username.clone() // UserID
                        ) {
                            Ok(client) => {
                                network_manager.client = Some(client);
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
                        lobby_entry_time = get_time();
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
                if let Some(client) = &network_manager.client {
                    if let Some(next) = network_handler::NetworkHandler::handle_events(
                        client, &player_profile, &all_classes, &mut other_players, &mut _game_state,
                        &mut _enemies, &mut _enemy, &mut turn_system, &mut current_turn_id,
                        &mut combat_logs, &mut last_network_log, &mut _lobby_host_id, &mut selected_class,
                        SCREEN_WIDTH, SCREEN_HEIGHT, &mut enemy_hp
                    ) {
                        if next == "InGame" {
                            current_screen = GameScreen::InGame;
                            is_solo_mode = false;

                            // Init visual player entity with Sorted Position
                            // Init visual player entity with Sorted Position
                            let mut all_ids = vec![player_profile.vext_username.clone()];
                            for id in other_players.keys() {
                                all_ids.push(id.clone());
                            }
                            all_ids.sort();

                            let get_pos = |rank: usize| -> Vec2 {
                                match rank {
                                    0 => vec2(250.0, 450.0), // Front Center
                                    1 => vec2(150.0, 350.0), // Top Flank
                                    2 => vec2(150.0, 550.0), // Bottom Flank
                                    3 => vec2(50.0, 450.0),  // Rear Guard
                                    _ => vec2(100.0 + (rank as f32 * 10.0), 450.0),
                                }
                            };

                            for (rank, id) in all_ids.iter().enumerate() {
                                let pos = get_pos(rank);
                                if *id == player_profile.vext_username {
                                    if let Some(cls) = selected_class.as_ref() {
                                        let mut new_player = StickFigure::new(pos, "You".to_string());
                                        new_player.max_health = cls.hp;
                                        new_player.health = new_player.max_health;
                                        new_player.color = cls.color();
                                        _player = Some(new_player);
                                    }
                                } else {
                                    if let Some(p) = other_players.get_mut(id) {
                                        p.position = (pos.x, pos.y);
                                    }
                                }
                            }
                        }
                    }
                }

                if !other_players.is_empty() {
                    renderer.draw_lobby(session_name, 1 + other_players.len(), &player_profile, &other_players);
                } else {
                     renderer.draw_lobby(session_name, 1, &player_profile, &other_players);
                }

 
                 // --- CLASS SELECTION UI (Grid restricted for space or scrollable) ---
                 draw_text("CHOOSE CLASS:", 500.0, 100.0, 30.0, WHITE);
                 
                 for (idx, cls) in all_classes.iter().enumerate() {
                     let btn_x = 500.0 + (idx / 10) as f32 * 170.0; // Two columns if many classes
                     let btn_y = 140.0 + (idx % 10) as f32 * 45.0;
                     let btn_w = 160.0;
                     let btn_h = 40.0;
                     
                     let is_selected = selected_class.as_ref().map(|c| &c.name == &cls.name).unwrap_or(false);
                     let color = if is_selected { cls.color() } else { DARKGRAY };
                     
                     let is_hovered = mouse_pos.x >= btn_x && mouse_pos.x <= btn_x + btn_w && mouse_pos.y >= btn_y && mouse_pos.y <= btn_y + btn_h;
                     
                     if is_hovered {
                         draw_rectangle(btn_x - 2.0, btn_y - 2.0, btn_w + 4.0, btn_h + 4.0, WHITE);
                     }
                     draw_rectangle(btn_x, btn_y, btn_w, btn_h, color);
                     draw_text(&cls.name, btn_x + 10.0, btn_y + 28.0, 18.0, WHITE);
                     
                     if is_mouse_button_pressed(MouseButton::Left) && is_hovered {
                         selected_class = Some(cls.clone());
                         // Send update to server
                         if let Some(client) = &network_manager.client {
                             println!("📤 Sending class change: {}", cls.name.to_lowercase());
                             client.send_class_change(cls.name.to_lowercase());
                         }
                     }
                 }

                // Start Button (Host Only)
                // Debug log occasionally
                if get_time() % 5.0 < 0.02 {
                    println!("Debug Host Check: lobby_host_id='{}', username='{}', is_host={}", 
                        _lobby_host_id, player_profile.vext_username, is_host);
                }

                if _lobby_host_id == player_profile.vext_username || is_host {
                    
                    // Draw the button!
                    let is_hovered = start_btn.is_clicked(mouse_pos);
                    start_btn.draw(is_hovered);

                    // Check if START is clicked (with cooldown)
                    if is_hovered && is_mouse_button_pressed(MouseButton::Left) && get_time() - lobby_entry_time > 1.0 {
                        println!("Host starting game...");
                        if let Some(client) = &network_manager.client {
                            // Generate Wave 1 Enemies
                            let mut init_enemies = Vec::new();
                            let temp_wm = waves::WaveManager::new(); // Just to get Wave 1 data
                                if let Some(wave) = temp_wm.waves.get(0) { // Wave 1
                                    println!("Host: Found Wave 1 with {} enemies", wave.enemies.len());
                                    for (stats, kind, _pos) in &wave.enemies {
                                         let e = Enemy::new(*_pos, kind.clone(), stats.clone());
                                     // ADD TO LOCAL BACKUP
                                     _enemies.push(e.clone());
                                     
                                     init_enemies.push(network_client::EnemyData {
                                         id: e.id,
                                         name: e.name,
                                         hp: e.health,
                                         max_hp: e.max_health,
                                         speed: e.speed,
                                         position: (e.position.x, e.position.y),
                                     });
                                }
                            } else {
                                println!("Host: ERROR - Wave 1 not found!");
                            }
                            
                            println!("Host: Sending start_game with {} enemies", init_enemies.len());
                            client.start_game(init_enemies);
                        }
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
                    if let Some(client) = &network_manager.client {
                        client.disconnect();
                    }
                    network_manager.client = None;
                    other_players.clear();
                    last_network_log = "Disconnected".to_string();
                }
            }

            GameScreen::InGame => {
                // DBG 
                if get_time() % 3.0 < 0.02 {
                     println!("InGame Loop: _enemies count = {}, _enemy (solo boss) = {:?}", _enemies.len(), _enemy.is_some());
                     if let Some(e) = _enemies.first() {
                         println!("  First Enemy Pos: ({}, {})", e.position.x, e.position.y);
                     }
                     for p in other_players.values() {
                         println!("  Remote Player {}: Class='{}'", p.username, p.class);
                     }
                }

                world_renderer::WorldRenderer::draw_game(
                    &renderer,
                    &_player,
                    &_teammates,
                    &other_players,
                    &_enemies,
                    _enemy.as_ref(),
                    &_game_state,
                    SCREEN_WIDTH,
                    SCREEN_HEIGHT,
                );

                // ===== WAVE SYSTEM =====

                // --- WAVE MANAGER UPDATE (Solo Mode) ---
                if is_solo_mode {
                    // Cleanup dead enemies
                    _enemies.retain(|e| e.health > 0.0);
                    if let Some(e) = &_enemy {
                         if e.health <= 0.0 { _enemy = None; }
                    }

                    let dt = get_frame_time();
                    let enemies_alive = _enemies.len(); // optimized since we just retained
                    let boss_alive = _enemy.is_some();
                    
                    wave_manager.update(dt, enemies_alive, boss_alive);
                    
                    if wave_manager.state == waves::WaveState::Spawning {
                        if let Some(wave) = wave_manager.get_current_wave() {
                            // Clear existing if any (except maybe bodies?)
                            // _enemies.clear(); // Keep bodies?
                            
                            // Spawn logic
                            for (stats, kind, pos) in &wave.enemies {
                                if *kind == crate::entities::enemy::EnemyType::Boss {
                                    _enemy = Some(Enemy::new(*pos, kind.clone(), stats.clone()));
                                } else {
                                    let mut new_enemy = Enemy::new(*pos, kind.clone(), stats.clone());
                                    new_enemy.add_threat("You", 1.0);
                                    _enemies.push(new_enemy);
                                }
                            }
                            
                            combat_logs.push(format!("⚠️ {}", wave.title));
                            
                            // SYNC TURN SYSTEM
                            turn_system.init_queue(
                               &player_profile.vext_username,
                               if let Some(gs) = &_game_state { gs.resources.speed as u32 } else { 100 },
                               &other_players,
                               &_enemies,
                               _enemy.as_ref()
                            );
                            turn_system.log_state(); // DEBUG SOLO WAVE INIT

                            current_turn_id = turn_system.get_current_id().to_string();

                        }
                    }
                }

                // Display Wave Title
                if let Some(wave) = wave_manager.get_current_wave() {
                    let title_text = &wave.title;
                    let text_w = measure_text(title_text, None, 30, 1.0).width;
                    draw_text(title_text, SCREEN_WIDTH / 2.0 - text_w / 2.0, 80.0, 30.0, WHITE);
                }


                // ===== RELAY MULTIPLAYER: Poll for updates in-game =====
                if let Some(client) = &network_manager.client {
                    network_handler::NetworkHandler::handle_events(
                        client, &player_profile, &all_classes, &mut other_players, &mut _game_state,
                        &mut _enemies, &mut _enemy, &mut turn_system, &mut current_turn_id,
                        &mut combat_logs, &mut last_network_log, &mut _lobby_host_id, &mut selected_class,
                        SCREEN_WIDTH, SCREEN_HEIGHT, &mut enemy_hp
                    );

                    // Envoyer notre position (mock movement for now)
                    if let Some(player) = &_player {
                        client.send_input((player.position.x, player.position.y), (0.0, 0.0), "idle".to_string());
                    }
                }
                
                // Drawing is now handled by WorldRenderer at the beginning of InGame arm






                

                // --- DRAW HUD ---
                if let Some(gs) = &mut _game_state {
                    let _current_class = &gs.character_class;
                    
                    // Determine if it's player's turn
                    // Determine if it's player's turn
                    let is_my_turn = if is_solo_mode {
                        current_turn_id == player_profile.vext_username
                    } else {
                        current_turn_id == player_profile.vext_username
                    };
                    
                    // Helper to advance turn queue (Solo Mode)
                    // We need to do this manually inline or via a state change request
                    // Since we can't define a closure that borrows everything easily here due to move,
                    // we'll handle the "End Turn" signal via a flag or just inline logic.
                    // Let's use `should_advance_turn` flag.
                    let mut should_advance_turn = false;
                    
                    if let Some(action) = HUD::draw(
                        gs, 
                        SCREEN_WIDTH, 
                        SCREEN_HEIGHT, 
                        &player_profile.vext_username,
                        &gs.character_class,
                        &other_players,
                        &_enemies,
                        _enemy.as_ref(),
                        &current_turn_id,
                        is_my_turn,
                        &mut battle_ui_state,
                        &combat_logs,
                    ) {

                        // Handle actions
                        if is_solo_mode {
                            combat_system::CombatSystem::handle_player_action(
                                &action, gs, &mut _player, &mut _enemies, &mut _enemy,
                                &mut turn_system, &mut combat_logs, &mut battle_ui_state,
                                &mut should_advance_turn, &mut enemy_hp
                            );
                            
                            // Specific handling for screen switch that might not be in CombatSystem (Flee)
                            if let HUDAction::Flee = action {
                                current_screen = GameScreen::MainMenu;
                                is_solo_mode = false;
                            } else if let HUDAction::GiveUp = action {
                                current_screen = GameScreen::PlayMenu;
                                is_solo_mode = false;
                            }

                            // Multiplayer mode: send to server
                            if let Some(client) = &network_manager.client {
                                match action {
                                    HUDAction::UseAttack(name, target_id) => { 
                                        let mut damage = 10.0;
                                        let mut mana = 0;
                                        let mut is_area = false;
                                        if let Some(gs) = &_game_state {
                                            if let Some(skill) = gs.character_class.skills.iter().find(|s| s.name == name) {
                                                damage = skill.base_damage;
                                                mana = skill.mana_cost;
                                                is_area = skill.skill_type.to_lowercase().contains("aoe");
                                            }
                                        }
                                        client.use_attack(name, Some(target_id), damage, mana, is_area); 
                                    }
                                    HUDAction::Flee => { client.flee(); }
                                    HUDAction::EndTurn => { 
                                        let next = turn_system.peek_next_id();
                                        client.end_turn(next); 
                                    }
                                    _ => { println!("Action not supported in Multiplayer"); }
                                }
                            }
                        }
                    }
                    
                     // === SOLO MODE: ENEMY AI & TURN ADVANCEMENT ===
                     if is_solo_mode && !is_my_turn {
                         combat_system::CombatSystem::handle_enemy_ai(
                             &current_turn_id, &mut _enemies, &mut _enemy, gs, &mut combat_logs,
                             &mut battle_ui_state, &mut enemy_attack_timer, &mut should_advance_turn
                         );
                     }
                     
                     // === MULTIPLAYER HOST AI ===
                     if !is_solo_mode && _lobby_host_id == player_profile.vext_username {
                         if let Some(client) = &network_manager.client {
                             let current_id = &current_turn_id;
                             
                             // Minion Turn
                             if let Some(enemy) = _enemies.iter().find(|e| &e.id == current_id) {
                                  enemy_attack_timer += get_frame_time() as f64;
                                  if enemy_attack_timer > 2.0 {
                                      enemy_attack_timer = 0.0;
                                      // Pick Target (Simple: Host or Random)
                                      let target = if !other_players.is_empty() {
                                            // Simple round robin or first
                                            other_players.keys().next().unwrap().clone()
                                      } else {
                                            player_profile.vext_username.clone()
                                      };
                                      
                                      println!("Host AI: Minion {} attacks {}", enemy.id, target);
                                      client.admin_attack(enemy.id.clone(), "Attack".to_string(), Some(target), enemy.attack_damage);
                                      
                                      let next = turn_system.peek_next_id();
                                      client.end_turn(next);
                                  }
                             } 
                             // Boss Turn
                             else if let Some(boss) = &_enemy {
                                 if &boss.id == current_id {
                                      enemy_attack_timer += get_frame_time() as f64;
                                      if enemy_attack_timer > 2.0 {
                                          enemy_attack_timer = 0.0;
                                          let target = player_profile.vext_username.clone();
                                          println!("Host AI: Boss {} attacks {}", boss.id, target);
                                          client.admin_attack(boss.id.clone(), "Smash".to_string(), Some(target), boss.attack_damage);
                                          let next = turn_system.peek_next_id();
                                          client.end_turn(next);
                                      }
                                 }
                             }
                         }
                     }

                     if should_advance_turn {
                         combat_system::CombatSystem::update_turn_system(
                             &mut turn_system, &player_profile, &_game_state, &other_players,
                             &mut _enemies, &mut _enemy, &mut current_turn_id, &mut combat_logs
                         );
                         should_advance_turn = false;
                     }
                    
                    // Solo Mode override to sync local turn system
                    if is_solo_mode {
                       // Main loop uses current_turn_id to decide who acts
                    } else {
                       // Multiplayer override: Server event sets current_turn_id usually
                       // But if we want timeline to work, we might need to sync TurnSystem with Server Turn ID
                    }
    
                    
                    // Victory Check handled by WaveManager
                    if wave_manager.state == waves::WaveState::AllWavesCleared {
                        combat_logs.push("VICTORY COMPLETED!".to_string());
                        // Maybe switch screen?
                    }
                }

                // Combat log is now drawn inside HUD::draw()

                if is_key_pressed(KeyCode::Escape) {
                    current_screen = GameScreen::MainMenu;
                    is_solo_mode = false;
                    // Properly disconnect from server
                    if let Some(client) = &network_manager.client {
                        client.disconnect();
                    }
                    network_manager.client = None;
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
