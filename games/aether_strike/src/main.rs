use macroquad::prelude::*;

mod game;
mod entities;
mod systems;
mod ui;
mod class_system;
mod inventory;
mod menu_system;
mod menu_ui;

use game::GameState;
use entities::{StickFigure, Enemy};
use class_system::PlayerClass;
use menu_system::{GameScreen, PlayerProfile, MenuButton, ClassButton, GameSession, SessionButton};
use menu_ui::{draw_main_menu, draw_play_menu, draw_character_creation, draw_session_list, draw_create_server, draw_password_dialog};

const SCREEN_WIDTH: f32 = 1024.0;
const SCREEN_HEIGHT: f32 = 768.0;

// Position des combattants (vue de côté)
const PLAYER_X: f32 = 200.0;
const PLAYER_Y: f32 = 450.0;
const ENEMY_X: f32 = 700.0;
const ENEMY_Y: f32 = 450.0;

fn window_conf() -> Conf {
    Conf {
        window_title: "Aether Strike - RPG Stick War".to_owned(),
        window_width: SCREEN_WIDTH as i32,
        window_height: SCREEN_HEIGHT as i32,
        window_resizable: false,
        ..Default::default()
    }
}

#[macroquad::main(window_conf)]
async fn main() {
    // État du jeu
    let mut current_screen = GameScreen::MainMenu;
    
    // Profil du joueur (mock du launcher VEXT)
    let mut player_profile = PlayerProfile::new("YourUsername".to_string()); // TODO: Lire depuis VEXT
    // Ajouter quelques amis pour test
    player_profile.add_friend("MaxGamer42", true);
    player_profile.add_friend("ShadowNinja", false);
    player_profile.add_friend("DragonSlayer", true);
    
    // Variables pour la création de personnage
    let mut character_name_input = String::new();
    let mut name_input_active = false;
    let mut selected_class: Option<PlayerClass> = None;
    
    // Variables pour le online
    let mut server_name_input = String::new();
    let mut server_password_input = String::new();
    let mut is_private_server = false;
    let mut max_players = 4u32;
    let mut server_name_active = false;
    let mut server_password_active = false;
    
    // Sessions mock (normalement viendraient du serveur)
    let mut sessions: Vec<SessionButton> = vec![
        SessionButton::new(
            GameSession::new("Epic Battle Arena", "MaxGamer42", 4, false, None),
            20.0, 140.0, SCREEN_WIDTH - 360.0, 60.0,
        ),
        SessionButton::new(
            GameSession {
                name: "Pro Players Only".to_string(),
                host: "DragonSlayer".to_string(),
                current_players: 3,
                max_players: 4,
                average_level: 15,
                ping: 25,
                is_private: true,
                password: Some("secret".to_string()),
                map: "TheNexus".to_string(),
            },
            20.0, 210.0, SCREEN_WIDTH - 360.0, 60.0,
        ),
        SessionButton::new(
            GameSession {
                name: "Chill Farming".to_string(),
                host: "SwiftArcher".to_string(),
                current_players: 2,
                max_players: 6,
                average_level: 8,
                ping: 45,
                is_private: false,
                password: None,
                map: "TheNexus".to_string(),
            },
            20.0, 280.0, SCREEN_WIDTH - 360.0, 60.0,
        ),
    ];
    
    // Dialogue de mot de passe
    let mut show_password_dialog = false;
    let mut join_password_input = String::new();
    let mut join_password_active = true;
    let mut selected_session: Option<usize> = None;
    
    // Variables pour le jeu
    let mut _game_state: Option<GameState> = None;
    let mut _player: Option<StickFigure> = None;
    let mut _enemy: Option<Enemy> = None;

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
                draw_character_creation(&class_buttons, mouse_pos, &character_name_input, name_input_active);

                // Gestion de l'input du nom
                if is_mouse_button_pressed(MouseButton::Left) {
                    let input_rect = Rect::new(100.0, 160.0, 600.0, 50.0);
                    name_input_active = input_rect.contains(mouse_pos);

                    // Sélection de classe
                    if class_buttons[0].is_clicked(mouse_pos) {
                        selected_class = Some(PlayerClass::Warrior);
                    } else if class_buttons[1].is_clicked(mouse_pos) {
                        selected_class = Some(PlayerClass::Mage);
                    } else if class_buttons[2].is_clicked(mouse_pos) {
                        selected_class = Some(PlayerClass::Archer);
                    }

                    // Bouton START GAME
                    if confirm_button.is_clicked(mouse_pos) && selected_class.is_some() && !character_name_input.is_empty() {
                        let player_class = selected_class.unwrap();
                        player_profile.character_name = character_name_input.clone();
                        
                        _game_state = Some(GameState::new(player_class));
                        let mut new_player = StickFigure::new(vec2(PLAYER_X, PLAYER_Y));
                        new_player.max_health = _game_state.as_ref().unwrap().get_max_hp();
                        new_player.health = new_player.max_health;
                        new_player.color = player_class.color();
                        _player = Some(new_player);
                        
                        _enemy = Some(Enemy::new(vec2(ENEMY_X, ENEMY_Y)));
                        
                        current_screen = GameScreen::InGame;
                    }
                }

                // Input clavier pour le nom
                if name_input_active {
                    handle_text_input(&mut character_name_input, 20);
                    if is_key_pressed(KeyCode::Enter) {
                        name_input_active = false;
                    }
                }

                // Dessiner le bouton START GAME si prêt
                if selected_class.is_some() && !character_name_input.is_empty() {
                    let is_hovered = confirm_button.is_clicked(mouse_pos);
                    confirm_button.draw(is_hovered);
                }

                if is_key_pressed(KeyCode::Escape) {
                    current_screen = GameScreen::PlayMenu;
                    character_name_input.clear();
                    selected_class = None;
                }
            }

            GameScreen::SessionList => {
                draw_session_list(&sessions, &player_profile, mouse_pos);

                if is_mouse_button_pressed(MouseButton::Left) {
                    // Vérifier les clics sur les sessions
                    for (i, session) in sessions.iter().enumerate() {
                        if session.is_clicked(mouse_pos) {
                            if session.session.is_private {
                                // Demander mot de passe
                                selected_session = Some(i);
                                show_password_dialog = true;
                                join_password_input.clear();
                                join_password_active = true;
                            } else {
                                // Rejoindre directement
                                println!("Joining session: {}", session.session.name);
                                current_screen = GameScreen::InGame;
                            }
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
                }

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
                        // Créer le serveur
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
                        
                        // Ajouter à la liste
                        let y_pos = 140.0 + sessions.len() as f32 * 70.0;
                        sessions.push(SessionButton::new(
                            new_session,
                            20.0,
                            y_pos,
                            SCREEN_WIDTH - 360.0,
                            60.0,
                        ));

                        println!("Server created: {}", server_name_input);
                        current_screen = GameScreen::SessionList;
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

            GameScreen::InGame => {
                // TODO: Intégrer tout le code du jeu ici
                clear_background(Color::from_rgba(40, 40, 60, 255));
                
                let text = if selected_class.is_some() {
                    format!("Welcome {}, playing as {:?}!", 
                        player_profile.character_name,
                        selected_class.unwrap()
                    )
                } else {
                    "In Game (Online mode)".to_string()
                };
                
                draw_text(&text, 100.0, 100.0, 30.0, WHITE);
                draw_text("Press ESC to return to menu", 100.0, 150.0, 20.0, LIGHTGRAY);

                if is_key_pressed(KeyCode::Escape) {
                    current_screen = GameScreen::MainMenu;
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
                            current_screen = GameScreen::InGame;
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
