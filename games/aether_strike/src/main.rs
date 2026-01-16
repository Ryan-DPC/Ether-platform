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
pub mod network_protocol;

use game::GameState;
use entities::{StickFigure, Enemy};
use menu_system::{GameScreen, PlayerProfile, GameSession};
use crate::ui::hud::{HUD, HUDAction};
// Use new modules
use modules::button::{MenuButton, ClassButton, SessionButton};
use modules::turn::TurnSystem;
use modules::position::*; // Import constants directly
use modules::host_ai::HostAI;
use modules::lobby_ui::{LobbySystem, LobbyAction};
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
    
    let mut current_turn_id = String::new();
    let mut last_network_log = String::new();
    let mut last_turn_id_debug = String::new(); // For debug/management of turns
    let mut host_ai = HostAI::new();
    let mut lobby_system = LobbySystem::new(SCREEN_WIDTH, SCREEN_HEIGHT);
    
    // Network manager (Refactored)
    let mut network_manager = server::NetworkManager::new();
    
    // Renderer (Refactored)
    let renderer = draw::Renderer::new(&assets, &all_classes);
    let mut other_players: HashMap<String, network_protocol::PlayerData> = HashMap::new();
    let mut is_host = false;
    let mut _lobby_host_id = String::new();
    
    
    // Variables pour le jeu
    let mut current_screen = GameScreen::MainMenu;
    
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
    // Moved to LobbySystem: create_server, confirm_create, refresh, start_btn
    let summary_back_btn = MenuButton::new("BACK TO MENU", SCREEN_WIDTH / 2.0 - 150.0, SCREEN_HEIGHT - 150.0, 300.0, 60.0);


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

            GameScreen::SessionList | GameScreen::CreateServer | GameScreen::Lobby => {
                let action = lobby_system.update(
                    &mut current_screen,
                    &renderer,
                    &player_profile,
                    &mut network_manager,
                    &mut selected_class,
                    &vext_token,
                    &all_classes,
                    &mut other_players,
                    &mut _game_state,
                    &mut _enemies,
                    &mut _enemy,
                    &mut turn_system,
                    &mut current_turn_id,
                    &mut combat_logs,
                    &mut last_network_log,
                    &mut _lobby_host_id,
                    &mut enemy_hp,
                    &mut is_host,
                    SCREEN_WIDTH,
                    SCREEN_HEIGHT
                );

                match action {
                    LobbyAction::SwitchScreen(s) => {
                        println!("DEBUG: Switching screen to {:?}", s);
                        current_screen = s;
                    },
                    LobbyAction::StartGame => {
                        current_screen = GameScreen::InGame;
                        is_solo_mode = false;
                        if is_host {
                            _lobby_host_id = player_profile.vext_username.clone(); // FORCE HOST ID
                        }

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
                    _ => {}
                }
            }

 
                 
                // (Class Loop Moved)

                // (Start Logic Moved)

            GameScreen::InGame => {
                // DBG 
                if get_time() % 3.0 < 0.02 {
                     // Debug logs removed to reduce console spam
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
                    let maybe_next = network_handler::NetworkHandler::handle_events(
                        client, &player_profile, &all_classes, &mut other_players, &mut _game_state,
                        &mut _enemies, &mut _enemy, &mut turn_system, &mut current_turn_id,
                        &mut combat_logs, &mut last_network_log, &mut _lobby_host_id, &mut selected_class,
                        SCREEN_WIDTH, SCREEN_HEIGHT, &mut enemy_hp
                    );
                    if let Some(next) = maybe_next {
                        if next == "Summary" { current_screen = GameScreen::Summary; }
                        else if next == "MainMenu" { current_screen = GameScreen::MainMenu; }
                    }

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
                        } else {
                            // Multiplayer mode: send to server
                            if let Some(client) = &network_manager.client {
                                match action {
                                    HUDAction::UseAttack(name, target_id) => { 
                                        let mut damage = 10.0;
                                        let mut mana = 0;
                                        let mut is_area = false;
                                        if let Some(skill) = gs.character_class.skills.iter().find(|s| s.name == name) {
                                            damage = skill.base_damage;
                                            mana = skill.mana_cost;
                                            is_area = skill.skill_type.to_lowercase().contains("aoe");
                                        }
                                        
                                        // --- OPTIMISTIC MANA UPDATE (0 Lag) ---
                                        gs.resources.mana = gs.resources.mana.saturating_sub(mana);
                                        
                                        client.use_attack(name, Some(target_id), damage, mana, is_area); 
                                        
                                        // Auto-End Turn after attack in Multiplayer
                                        let next = turn_system.peek_next_id();
                                        
                                        // --- OPTIMISTIC TURN ADVANCE (0 Lag) ---
                                        // Update local state immediately so next actor (e.g. Host AI) can start
                                        current_turn_id = next.clone();
                                        turn_system.sync_to_id(&next);
                                        
                                        client.end_turn(next);
                                    }
                                    HUDAction::Flee => { client.flee(); }
                                    HUDAction::EndTurn => { 
                                        let next = turn_system.peek_next_id();
                                        
                                        // --- OPTIMISTIC TURN ADVANCE (0 Lag) ---
                                        current_turn_id = next.clone();
                                        turn_system.sync_to_id(&next);
                                        
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
                     
                     // Track turn changes to reset AI flag
                     if current_turn_id != last_turn_id_debug {
                         last_turn_id_debug = current_turn_id.clone();
                         host_ai.reset_turn_flag();
                     }

                     // === MULTIPLAYER HOST AI ===
                     // Logic moved to src/modules/host_ai.rs
                     if let Some(gs) = &_game_state {
                         host_ai.update(
                             &mut current_turn_id,
                             &player_profile,
                             gs, 
                             &network_manager,
                             &_enemies,
                             &_enemy,
                             &other_players,
                             &mut turn_system,
                             is_solo_mode,
                             &_lobby_host_id
                         );
                     }

                     // === MULTIPLAYER HOST WAVE MANAGEMENT ===
                     if !is_solo_mode && _lobby_host_id == player_profile.vext_username {
                          // Update Wave Manager state (Host Only)
                          // DEBUG: Verify queue
                          if turn_system.turn_queue.is_empty() {
                              println!("WARNING: Host Wave Update - Turn Queue Empty!");
                          }

                          let old_wave_index = wave_manager.current_wave_index;
                          wave_manager.update(get_frame_time(), _enemies.len(), _enemy.is_some());
                          
                          if let Some(client) = &network_manager.client {
                              // --- LOOT & PROGRESSION: Award rewards on wave clear ---
                              if wave_manager.current_wave_index > old_wave_index {
                                   let gold_reward = 50 * wave_manager.current_wave_index as u32;
                                   let exp_reward = 20 * wave_manager.current_wave_index as u32;
                                   
                                   if let Some(gs) = &mut _game_state {
                                       gs.resources.gold += gold_reward;
                                       gs.exp += exp_reward;
                                       combat_logs.push(format!("💰 Wave Cleared! +{} Gold, +{} XP", gold_reward, exp_reward));
                                       gs.check_level_up();
                                   }
                              }

                              // Check if we need to spawn
                              if wave_manager.state == waves::WaveState::Spawning {
                                        // 1. Get Wave Enemies
                                        let mut new_enemies_data = Vec::new();
                                        if let Some(wave) = wave_manager.get_current_wave() {
                                            for (i, (stats, kind, pos)) in wave.enemies.iter().enumerate() {
                                               let enemy_id = format!("{}-{}-{}", stats.name, wave_manager.current_wave_index, i); 
                                           new_enemies_data.push(crate::network_protocol::EnemyData {
                                                   id: enemy_id,
                                                   name: stats.name.clone(),
                                                   hp: stats.hp,
                                                   max_hp: stats.hp,
                                                   speed: stats.speed, 
                                                   position: (pos.x, pos.y),
                                               });
                                            }
                                        }
                                        // 2. Send Start Wave
                                        if !new_enemies_data.is_empty() {
                                            println!("HOST: Starting Wave {} with {} enemies", wave_manager.current_wave_index, new_enemies_data.len());
                                            let (g, e) = (50 * wave_manager.current_wave_index as u32, 20 * wave_manager.current_wave_index as u32);
                                            client.start_next_wave(new_enemies_data, g, e);
                                        }

                                        // 3. Advance State (Manual force to Active)
                                        wave_manager.state = waves::WaveState::Active;
                                   } else if wave_manager.state == waves::WaveState::AllWavesCleared {
                                        wave_manager.wave_timer += get_frame_time();
                                        if wave_manager.wave_timer < 0.1 {
                                             client.trigger_game_over(true); 
                                        }
                                   }
                          }
                     }

                     // === MULTIPLAYER DEATH SKIP ===
                     if !is_solo_mode && is_my_turn {
                         if let Some(gs) = &_game_state {
                             if gs.resources.current_hp <= 0.0 {
                                 if let Some(client) = &network_manager.client {
                                     let next = turn_system.peek_next_id();
                                     client.end_turn(next);
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
                
            GameScreen::Summary => {
                clear_background(Color::from_rgba(10, 10, 25, 255));
                
                let title = if let Some(logs) = combat_logs.last() {
                    if logs.contains("VICTORY") { "VICTORY!" } else { "DEFEAT" }
                } else { "GAME OVER" };
                
                let title_color = if title == "VICTORY!" { GOLD } else { RED };
                draw_text(title, SCREEN_WIDTH / 2.0 - measure_text(title, None, 60, 1.0).width / 2.0, 150.0, 60.0, title_color);
                
                if let Some(gs) = &_game_state {
                    let text = format!("Gold Gained: {}", gs.session_gold);
                    draw_text(&text, SCREEN_WIDTH / 2.0 - measure_text(&text, None, 30, 1.0).width / 2.0, 250.0, 30.0, WHITE);
                    
                    let text = format!("XP Gained: {}", gs.session_exp);
                    draw_text(&text, SCREEN_WIDTH / 2.0 - measure_text(&text, None, 30, 1.0).width / 2.0, 300.0, 30.0, WHITE);
                    
                    let text = format!("Final Level: {}", gs.level);
                    draw_text(&text, SCREEN_WIDTH / 2.0 - measure_text(&text, None, 30, 1.0).width / 2.0, 350.0, 30.0, YELLOW);
                }
                
                let is_hovered = summary_back_btn.is_clicked(mouse_pos);
                summary_back_btn.draw(is_hovered);
                if is_mouse_button_pressed(MouseButton::Left) && summary_back_btn.is_clicked(mouse_pos) {
                    current_screen = GameScreen::MainMenu;
                    // Reset game
                    _game_state = None;
                    _enemies.clear();
                    _enemy = None;
                    if let Some(client) = &network_manager.client { client.disconnect(); }
                    network_manager.client = None;
                }

                if is_key_pressed(KeyCode::Escape) {
                    current_screen = GameScreen::MainMenu;
                }
            }
        }

        // Password logic removed (legacy)

        next_frame().await;
    }
}
