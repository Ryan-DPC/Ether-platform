use macroquad::prelude::*;
use std::collections::HashMap;
use crate::menu_system::{GameScreen, PlayerProfile, GameSession};
use crate::modules::button::{MenuButton, SessionButton};
use crate::menu_ui::{draw_create_server};
use crate::input::handle_text_input;
use crate::network_api;
use crate::network_protocol::PlayerData;
use crate::network_protocol::EnemyData;
use crate::network_client::GameClient;
use crate::server::NetworkManager;
use crate::class_system::CharacterClass;
use crate::draw::Renderer;
use crate::backend;
use crate::game::GameState;
use crate::entities::Enemy;
use crate::modules::turn::TurnSystem; // If needed for NetworkHandler? Yes
use crate::network_handler;

pub enum LobbyAction {
    None,
    SwitchScreen(GameScreen),
    StartGame, // Signal to init entities in main
}

pub struct LobbySystem {
    // Inputs for Create Server
    pub server_name_input: String,
    pub server_password_input: String,
    pub is_private_server: bool,
    pub max_players: u32,
    pub server_name_active: bool,
    pub server_password_active: bool,
    
    // Logic state
    pub selected_session: Option<usize>,
    pub lobby_entry_time: f64,
    
    // UI Elements
    pub sessions: Vec<SessionButton>,
    
    // Buttons
    create_server_button: MenuButton,
    confirm_create_button: MenuButton,
    refresh_button: MenuButton,
    start_btn: MenuButton, // For host in lobby (not implemented in main yet but good to have)
}

impl LobbySystem {
    pub fn new(screen_width: f32, screen_height: f32) -> Self {
        Self {
            server_name_input: String::new(),
            server_password_input: String::new(),
            is_private_server: false,
            max_players: 4,
            server_name_active: false,
            server_password_active: false,
            selected_session: None,
            lobby_entry_time: 0.0,
            sessions: Vec::new(),
            
            create_server_button: MenuButton::new("CREATE SERVER", screen_width - 350.0, screen_height - 70.0, 200.0, 50.0),
            confirm_create_button: MenuButton::new("CREATE", screen_width / 2.0 - 100.0, screen_height - 100.0, 200.0, 50.0),
            refresh_button: MenuButton::new("REFRESH", screen_width - 170.0, 40.0, 150.0, 40.0),
            start_btn: MenuButton::new("START", screen_width / 2.0 - 100.0, screen_height - 100.0, 200.0, 50.0),
        }
    }

    pub fn update(
        &mut self,
        current_screen: &mut GameScreen,
        renderer: &Renderer,
        player_profile: &PlayerProfile,
        network_manager: &mut NetworkManager,
        selected_class: &mut Option<CharacterClass>,
        vext_token: &str,
        // For Lobby Polling
        all_classes: &[CharacterClass],
        other_players: &mut HashMap<String, PlayerData>,
        game_state: &mut Option<GameState>,
        enemies: &mut Vec<Enemy>,
        enemy: &mut Option<Enemy>,
        turn_system: &mut TurnSystem,
        current_turn_id: &mut String,
        combat_logs: &mut Vec<String>,
        last_network_log: &mut String,
        lobby_host_id: &mut String,
        enemy_hp: &mut f32,
        _is_host: &mut bool, // tracked in main, ref/mut here
        screen_width: f32,
        screen_height: f32,
    ) -> LobbyAction {
        let mouse_pos = vec2(mouse_position().0, mouse_position().1);

        match current_screen {
            GameScreen::SessionList => {
                renderer.draw_session_list(&self.sessions, player_profile, mouse_pos);

                if is_mouse_button_pressed(MouseButton::Left) {
                    // Check JOIN buttons
                    for (i, session) in self.sessions.iter().enumerate() {
                        if session.join_button_clicked(mouse_pos) {
                            self.selected_session = Some(i);
                            
                            // Connect
                            let lobby_id = session.session.name.clone();
                            let ws_url = network_api::get_ws_url();
                            
                            match GameClient::connect(
                                &ws_url,
                                vext_token,
                                lobby_id.clone(),
                                selected_class.as_ref().map(|c| c.name.to_lowercase()).unwrap_or_else(|| "warrior".to_string()),
                                false, // is_host
                                player_profile.vext_username.clone(),
                                player_profile.vext_username.clone(),
                                selected_class.as_ref().map(|c| c.hp).unwrap_or(100.0),
                                selected_class.as_ref().map(|c| c.hp).unwrap_or(100.0),
                                selected_class.as_ref().map(|c| c.speed).unwrap_or(100.0)
                            ) {
                                Ok(client) => {
                                    network_manager.client = Some(client);
                                    *_is_host = false;
                                    println!("✅ Connected to lobby: {}", lobby_id);
                                    return LobbyAction::SwitchScreen(GameScreen::Lobby);
                                }
                                Err(e) => {
                                    eprintln!("❌ Failed to connect: {}", e);
                                    return LobbyAction::SwitchScreen(GameScreen::Lobby);
                                }
                            }
                        }
                    }

                    // CREATE SERVER button
                    if self.create_server_button.is_clicked(mouse_pos) {
                        self.server_name_input.clear();
                        self.server_password_input.clear();
                        self.is_private_server = false;
                        self.max_players = 4;
                        return LobbyAction::SwitchScreen(GameScreen::CreateServer);
                    }

                    // REFRESH button
                    if self.refresh_button.is_clicked(mouse_pos) {
                        self.sessions = backend::refresh_sessions();
                    }
                }

                let is_hovered = self.refresh_button.is_clicked(mouse_pos);
                self.refresh_button.draw(is_hovered);
                
                let is_hovered = self.create_server_button.is_clicked(mouse_pos);
                self.create_server_button.draw(is_hovered);

                if is_key_pressed(KeyCode::Escape) {
                    return LobbyAction::SwitchScreen(GameScreen::PlayMenu);
                }
            }

            GameScreen::CreateServer => {
                draw_create_server(
                    &self.server_name_input,
                    self.is_private_server,
                    &self.server_password_input,
                    self.max_players,
                    self.server_name_active,
                    self.server_password_active,
                    mouse_pos,
                );

                if is_mouse_button_pressed(MouseButton::Left) {
                    let name_rect = Rect::new(100.0, 160.0, 600.0, 50.0);
                    self.server_name_active = name_rect.contains(mouse_pos);

                    let checkbox_rect = Rect::new(300.0, 210.0, 30.0, 30.0);
                    if checkbox_rect.contains(mouse_pos) {
                        self.is_private_server = !self.is_private_server;
                        if !self.is_private_server { self.server_password_input.clear(); }
                    }

                    if self.is_private_server {
                        let password_rect = Rect::new(100.0, 300.0, 600.0, 50.0);
                        self.server_password_active = password_rect.contains(mouse_pos);
                    } else {
                        self.server_password_active = false;
                    }

                    if self.confirm_create_button.is_clicked(mouse_pos) && !self.server_name_input.is_empty() {
                         network_api::announce_server(
                            &self.server_name_input, 
                            &player_profile.vext_username,
                            self.max_players,
                            self.is_private_server,
                            if self.is_private_server && !self.server_password_input.is_empty() { Some(self.server_password_input.clone()) } else { None }
                        );

                        match GameClient::connect(
                            &network_api::get_ws_url(),
                            vext_token,
                            self.server_name_input.clone(),
                            selected_class.as_ref().map(|c| c.name.clone()).unwrap_or_else(|| "warrior".to_string()).to_lowercase(),
                            true, // is_host
                            player_profile.vext_username.clone(),
                            player_profile.vext_username.clone(),
                             selected_class.as_ref().map(|c| c.hp).unwrap_or(100.0),
                            selected_class.as_ref().map(|c| c.hp).unwrap_or(100.0),
                            selected_class.as_ref().map(|c| c.speed).unwrap_or(100.0)
                        ) {
                            Ok(client) => {
                                network_manager.client = Some(client);
                                *_is_host = true;
                                println!("✅ Server created: {}", self.server_name_input);
                            }
                            Err(e) => eprintln!("❌ Failed to connect relay: {}", e),
                        }

                        // Add to local list
                        let new_session = GameSession::new(
                            &self.server_name_input, &player_profile.vext_username, self.max_players,
                            self.is_private_server, if self.is_private_server { Some(self.server_password_input.clone()) } else { None }
                        );
                        let y_pos = 140.0 + self.sessions.len() as f32 * 70.0;
                         self.sessions.push(SessionButton::new(
                            new_session, 20.0, y_pos, screen_width - 360.0, 60.0
                        ));
                        self.selected_session = Some(self.sessions.len() - 1);
                        self.lobby_entry_time = get_time();
                        
                        return LobbyAction::SwitchScreen(GameScreen::Lobby);
                    }
                }

                if self.server_name_active { handle_text_input(&mut self.server_name_input, 30); }
                else if self.server_password_active { handle_text_input(&mut self.server_password_input, 20); }

                let is_hovered = self.confirm_create_button.is_clicked(mouse_pos);
                self.confirm_create_button.draw(is_hovered);

                if is_key_pressed(KeyCode::Escape) {
                    return LobbyAction::SwitchScreen(GameScreen::SessionList);
                }
            }

            GameScreen::Lobby => {
                clear_background(Color::from_rgba(30, 30, 50, 255));
                
                let session_name = if let Some(idx) = self.selected_session {
                    if idx < self.sessions.len() {
                        &self.sessions[idx].session.name
                    } else { "Lobby" }
                } else { "Lobby" };

                draw_text(&format!("LOBBY: {}", session_name), 50.0, 50.0, 40.0, WHITE);

                // POLL EVENTS
                if let Some(client) = &network_manager.client {
                    if let Some(next) = network_handler::NetworkHandler::handle_events(
                        client, player_profile, all_classes, other_players, game_state,
                        enemies, enemy, turn_system, current_turn_id,
                        combat_logs, last_network_log, lobby_host_id, selected_class,
                        screen_width, screen_height, enemy_hp
                    ) {
                        if next == "InGame" {
                            return LobbyAction::StartGame;
                        }
                    }
                }

                renderer.draw_lobby(session_name, 1 + other_players.len(), player_profile, other_players);

                // --- CLASS SELECTION UI ---
                draw_text("CHOOSE CLASS:", 500.0, 100.0, 30.0, WHITE);
                
                for (idx, cls) in all_classes.iter().enumerate() {
                    let btn_x = 500.0 + (idx / 10) as f32 * 170.0;
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
                        *selected_class = Some(cls.clone());
                        if let Some(client) = &network_manager.client {
                            println!("📤 Sending class change: {}", cls.name.to_lowercase());
                            client.send_class_change(cls.name.to_lowercase());
                        }
                    }
                }

                // --- START BUTTON (Host Only) ---
                if *lobby_host_id == player_profile.vext_username || *_is_host {
                    let is_hovered = self.start_btn.is_clicked(mouse_pos);
                    self.start_btn.draw(is_hovered);

                    if is_hovered && is_mouse_button_pressed(MouseButton::Left) && get_time() - self.lobby_entry_time > 1.0 {
                        println!("Host starting game...");
                        if let Some(client) = &network_manager.client {
                            // Generate Wave 1 Enemies
                            if let Some(wave) = crate::waves::WaveManager::new().waves.get(0) { // Wave 1
                                let mut enemies_list = Vec::new();
                                for (i, def) in wave.enemies.iter().enumerate() {
                                    let id = format!("{}-{}", def.0.name, rand::rand() as u32);
                                    let hp = def.0.hp; // Simplified
                                    enemies_list.push(crate::network_protocol::EnemyData {
                                        id,
                                        name: def.0.name.clone(),
                                        hp, // f32
                                        max_hp: hp,
                                        speed: def.0.speed,
                                        position: (600.0 + (i as f32 * 50.0), 300.0 + (i as f32 * 50.0)),
                                    });
                                }
                                println!("Host: Sending start_game with {} enemies", enemies_list.len());
                                client.start_game(enemies_list);
                            }
                        }
                    }
                }
                
                if is_key_pressed(KeyCode::Escape) {
                     if let Some(client) = &network_manager.client { client.disconnect(); }
                     network_manager.client = None;
                     other_players.clear();
                     return LobbyAction::SwitchScreen(GameScreen::PlayMenu);
                }
            }
            
            _ => {}
        }

        LobbyAction::None
    }
}
