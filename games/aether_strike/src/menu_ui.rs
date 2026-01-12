use macroquad::prelude::*;
use crate::menu_system::{PlayerProfile, MenuButton, ClassButton, Friend, SessionButton, GameSession};
use crate::class_system::PlayerClass;

/// Dessiner le menu principal
pub fn draw_main_menu(profile: &PlayerProfile, buttons: &[MenuButton], mouse_pos: Vec2) {
    // Background
    clear_background(Color::from_rgba(20, 20, 40, 255));

    // Titre du jeu
    let title = "AETHER STRIKE";
    let title_size = 80.0;
    let title_dims = measure_text(title, None, title_size as u16, 1.0);
    draw_text(
        title,
        screen_width() / 2.0 - title_dims.width / 2.0,
        150.0,
        title_size,
        GOLD,
    );

    // Sous-titre
    let subtitle = "RPG Stick War";
    let subtitle_size = 30.0;
    let subtitle_dims = measure_text(subtitle, None, subtitle_size as u16, 1.0);
    draw_text(
        subtitle,
        screen_width() / 2.0 - subtitle_dims.width / 2.0,
        190.0,
        subtitle_size,
        LIGHTGRAY,
    );

    // Pseudo VEXT en haut à gauche
    draw_rectangle(10.0, 10.0, 300.0, 60.0, Color::from_rgba(0, 0, 0, 180));
    draw_text("Logged in as:", 20.0, 35.0, 18.0, LIGHTGRAY);
    draw_text(&profile.vext_username, 20.0, 60.0, 24.0, GOLD);

    // Dashboard amis à droite (si il y en a)
    if !profile.friends.is_empty() {
        draw_friends_dashboard(&profile.friends);
    }

    // Boutons du menu
    for button in buttons {
        let is_hovered = button.is_clicked(mouse_pos);
        button.draw(is_hovered);
    }

    // Version
    draw_text("v0.1.0", screen_width() - 80.0, screen_height() - 10.0, 16.0, DARKGRAY);
}

/// Dessiner le dashboard des amis
fn draw_friends_dashboard(friends: &[Friend]) {
    let x = screen_width() - 320.0;
    let y = 10.0;
    let width = 310.0;
    let height = (friends.len() as f32 * 60.0 + 60.0).min(400.0);

    // Fond
    draw_rectangle(x, y, width, height, Color::from_rgba(0, 0, 0, 180));
    draw_rectangle_lines(x, y, width, height, 2.0, GOLD);

    // Titre
    draw_text("Friends", x + 10.0, y + 30.0, 24.0, GOLD);
    draw_line(x + 10.0, y + 40.0, x + width - 10.0, y + 40.0, 2.0, GOLD);

    // Liste des amis
    for (i, friend) in friends.iter().enumerate() {
        let friend_y = y + 60.0 + i as f32 * 60.0;
        
        // Fond de l'ami
        let bg_color = if friend.online {
            Color::from_rgba(0, 50, 0, 100)
        } else {
            Color::from_rgba(50, 0, 0, 100)
        };
        draw_rectangle(x + 10.0, friend_y, width - 20.0, 50.0, bg_color);

        // Indicateur online/offline
        let status_color = if friend.online { GREEN } else { RED };
        draw_circle(x + 25.0, friend_y + 25.0, 8.0, status_color);

        // Nom
        draw_text(&friend.name, x + 45.0, friend_y + 30.0, 20.0, WHITE);

        // Statut
        let status_text = if friend.online { "Online" } else { "Offline" };
        draw_text(status_text, x + 45.0, friend_y + 45.0, 14.0, LIGHTGRAY);
    }
}

/// Dessiner le menu "Jouer" (Solo / Online)
pub fn draw_play_menu(buttons: &[MenuButton], mouse_pos: Vec2) {
    // Background
    clear_background(Color::from_rgba(20, 20, 40, 255));

    // Titre
    let title = "SELECT GAME MODE";
    let title_size = 60.0;
    let title_dims = measure_text(title, None, title_size as u16, 1.0);
    draw_text(
        title,
        screen_width() / 2.0 - title_dims.width / 2.0,
        150.0,
        title_size,
        GOLD,
    );

    // Boutons
    for button in buttons {
        let is_hovered = button.is_clicked(mouse_pos);
        button.draw(is_hovered);
    }

    // Instruction
    draw_text(
        "Press ESC to go back",
        20.0,
        screen_height() - 20.0,
        20.0,
        LIGHTGRAY,
    );
}

/// Dessiner la création de personnage
pub fn draw_character_creation(
    class_buttons: &[ClassButton],
    mouse_pos: Vec2,
    character_name: &str,
    name_input_active: bool,
) {
    // Background
    clear_background(Color::from_rgba(20, 20, 40, 255));

    // Titre
    let title = "CREATE YOUR CHARACTER";
    let title_size = 50.0;
    let title_dims = measure_text(title, None, title_size as u16, 1.0);
    draw_text(
        title,
        screen_width() / 2.0 - title_dims.width / 2.0,
        80.0,
        title_size,
        GOLD,
    );

    // Champ de nom
    draw_text("Character Name:", 100.0, 150.0, 24.0, WHITE);
    
    let input_rect = Rect::new(100.0, 160.0, 600.0, 50.0);
    draw_rectangle(
        input_rect.x,
        input_rect.y,
        input_rect.w,
        input_rect.h,
        Color::from_rgba(40, 40, 60, 255),
    );
    draw_rectangle_lines(
        input_rect.x,
        input_rect.y,
        input_rect.w,
        input_rect.h,
        2.0,
        if name_input_active { GOLD } else { WHITE },
    );

    // Afficher le nom avec curseur si actif
    let display_name = if name_input_active && character_name.is_empty() {
        "Type your name..."
    } else {
        character_name
    };
    
    let text_color = if character_name.is_empty() && !name_input_active {
        DARKGRAY
    } else {
        WHITE
    };

    draw_text(
        display_name,
        input_rect.x + 10.0,
        input_rect.y + 35.0,
        28.0,
        text_color,
    );

    // Curseur clignotant
    if name_input_active {
        let cursor_x = input_rect.x + 10.0 + measure_text(character_name, None, 28, 1.0).width;
        let time = get_time();
        if (time * 2.0) as i32 % 2 == 0 {
            draw_line(cursor_x, input_rect.y + 10.0, cursor_x, input_rect.y + 40.0, 2.0, WHITE);
        }
    }

    // Titre des classes
    draw_text("Choose Your Class:", 100.0, 250.0, 28.0, WHITE);

    // Boutons de classe
    for button in class_buttons {
        let is_hovered = button.is_clicked(mouse_pos);
        button.draw(is_hovered);
    }

    // Instructions
    draw_text(
        "Click on the name field to type | Press ENTER to confirm | Press ESC to go back",
        20.0,
        screen_height() - 20.0,
        18.0,
        LIGHTGRAY,
    );
}

/// Dessiner la liste de sessions
pub fn draw_session_list(
    sessions: &[SessionButton],
    profile: &PlayerProfile,
    mouse_pos: Vec2,
) {
    // Background
    clear_background(Color::from_rgba(20, 20, 40, 255));

    // Titre
    let title = "SESSION LIST";
    let title_size = 50.0;
    draw_text(title, 30.0, 60.0, title_size, GOLD);

    // Dashboard amis à droite
    if !profile.friends.is_empty() {
        draw_friends_dashboard(&profile.friends);
    }

    // En-têtes de colonnes
    let header_y = 100.0;
    draw_rectangle(20.0, header_y, screen_width() - 360.0, 30.0, Color::from_rgba(40, 40, 60, 255));
    draw_text("SESSION", 50.0, header_y + 20.0, 18.0, LIGHTGRAY);
    draw_text("PLAYERS", 350.0, header_y + 20.0, 18.0, LIGHTGRAY);
    draw_text("LEVEL", 440.0, header_y + 20.0, 18.0, LIGHTGRAY);
    draw_text("PING", 520.0, header_y + 20.0, 18.0, LIGHTGRAY);
    draw_text("MAP", 600.0, header_y + 20.0, 18.0, LIGHTGRAY);

    // Liste des sessions
    for session in sessions {
        let is_hovered = session.is_clicked(mouse_pos);
        session.draw(is_hovered);
    }

    // Boutons en bas
    let button_y = screen_height() - 80.0;
    draw_text(
        "Press ESC to go back | Double-click to join | CREATE SERVER",
        20.0,
        screen_height() - 20.0,
        18.0,
        LIGHTGRAY,
    );
}

/// Dessiner le dialogue de création de serveur
pub fn draw_create_server(
    server_name: &str,
    is_private: bool,
    password: &str,
    max_players: u32,
    name_input_active: bool,
    password_input_active: bool,
    mouse_pos: Vec2,
) {
    // Background
    clear_background(Color::from_rgba(20, 20, 40, 255));

    // Titre
    let title = "CREATE SERVER";
    let title_size = 50.0;
    let title_dims = measure_text(title, None, title_size as u16, 1.0);
    draw_text(
        title,
        screen_width() / 2.0 - title_dims.width / 2.0,
        80.0,
        title_size,
        GOLD,
    );

    let start_y = 150.0;

    // Server Name
    draw_text("Server Name:", 100.0, start_y, 24.0, WHITE);
    let name_rect = Rect::new(100.0, start_y + 10.0, 600.0, 50.0);
    draw_rectangle(name_rect.x, name_rect.y, name_rect.w, name_rect.h, Color::from_rgba(40, 40, 60, 255));
    draw_rectangle_lines(name_rect.x, name_rect.y, name_rect.w, name_rect.h, 2.0, if name_input_active { GOLD } else { WHITE });
    draw_text(server_name, name_rect.x + 10.0, name_rect.y + 35.0, 24.0, WHITE);

    // Private checkbox
    let checkbox_y = start_y + 80.0;
    draw_text("Private Server:", 100.0, checkbox_y, 24.0, WHITE);
    let checkbox_rect = Rect::new(300.0, checkbox_y - 20.0, 30.0, 30.0);
    draw_rectangle(checkbox_rect.x, checkbox_rect.y, checkbox_rect.w, checkbox_rect.h, Color::from_rgba(40, 40, 60, 255));
    draw_rectangle_lines(checkbox_rect.x, checkbox_rect.y, checkbox_rect.w, checkbox_rect.h, 2.0, WHITE);
    if is_private {
        draw_text("✓", checkbox_rect.x + 5.0, checkbox_rect.y + 25.0, 30.0, GREEN);
    }

    // Password (si private)
    if is_private {
        let password_y = checkbox_y + 60.0;
        draw_text("Password:", 100.0, password_y, 24.0, WHITE);
        let password_rect = Rect::new(100.0, password_y + 10.0, 600.0, 50.0);
        draw_rectangle(password_rect.x, password_rect.y, password_rect.w, password_rect.h, Color::from_rgba(40, 40, 60, 255));
        draw_rectangle_lines(password_rect.x, password_rect.y, password_rect.w, password_rect.h, 2.0, if password_input_active { GOLD } else { WHITE });
        
        // Masquer le password avec des *
        let masked_password: String = password.chars().map(|_| '*').collect();
        draw_text(&masked_password, password_rect.x + 10.0, password_rect.y + 35.0, 24.0, WHITE);
    }

    // Max Players
    let max_players_y = if is_private { checkbox_y + 140.0 } else { checkbox_y + 60.0 };
    draw_text("Max Players:", 100.0, max_players_y, 24.0, WHITE);
    draw_text(&format!("{}", max_players), 300.0, max_players_y, 24.0, SKYBLUE);

    // Instructions
    draw_text(
        "Press ESC to cancel",
        20.0,
        screen_height() - 20.0,
        18.0,
        LIGHTGRAY,
    );
}

/// Dessiner le dialogue de mot de passe
pub fn draw_password_dialog(password_input: &str, input_active: bool) {
    let dialog_w = 500.0;
    let dialog_h = 200.0;
    let dialog_x = (screen_width() - dialog_w) / 2.0;
    let dialog_y = (screen_height() - dialog_h) / 2.0;

    // Overlay sombre
    draw_rectangle(0.0, 0.0, screen_width(), screen_height(), Color::from_rgba(0, 0, 0, 180));

    // Dialogue
    draw_rectangle(dialog_x, dialog_y, dialog_w, dialog_h, Color::from_rgba(30, 30, 50, 255));
    draw_rectangle_lines(dialog_x, dialog_y, dialog_w, dialog_h, 3.0, GOLD);

    // Titre
    draw_text("Enter Password", dialog_x + 20.0, dialog_y + 40.0, 28.0, GOLD);

    // Input
    let input_rect = Rect::new(dialog_x + 20.0, dialog_y + 70.0, dialog_w - 40.0, 50.0);
    draw_rectangle(input_rect.x, input_rect.y, input_rect.w, input_rect.h, Color::from_rgba(40, 40, 60, 255));
    draw_rectangle_lines(input_rect.x, input_rect.y, input_rect.w, input_rect.h, 2.0, if input_active { GOLD } else { WHITE });
    
    // Masquer le password
    let masked: String = password_input.chars().map(|_| '*').collect();
    draw_text(&masked, input_rect.x + 10.0, input_rect.y + 35.0, 24.0, WHITE);

    // Instructions
    draw_text("Press ENTER to join | ESC to cancel", dialog_x + 20.0, dialog_y + 160.0, 16.0, LIGHTGRAY);
}

