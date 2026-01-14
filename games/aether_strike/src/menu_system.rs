use macroquad::prelude::*;

/// États du jeu
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum GameScreen {
    MainMenu,
    PlayMenu,           // Solo / Online
    CharacterCreation,  // Choix de classe
    SessionList,        // Liste des sessions (Online)
    CreateServer,       // Créer un serveur
    Lobby,              // Salle d'attente (NOUVEAU)
    InGame,
    Options,
}

/// Données du joueur
#[derive(Debug, Clone)]
pub struct PlayerProfile {
    pub vext_username: String,  // Pseudo du launcher VEXT
    pub character_name: String,
    pub friends: Vec<Friend>,
}

impl PlayerProfile {
    pub fn new(vext_username: String) -> Self {
        PlayerProfile {
            vext_username,
            character_name: String::new(),
            friends: vec![],  // 0 mock
        }
    }

    pub fn add_friend(&mut self, name: &str, online: bool) {
        self.friends.push(Friend::new(name, online));
    }
}

/// Ami dans la liste
#[derive(Debug, Clone)]
pub struct Friend {
    pub name: String,
    pub online: bool,
}

impl Friend {
    pub fn new(name: &str, online: bool) -> Self {
        Friend {
            name: name.to_string(),
            online,
        }
    }
}

/// Session de jeu online
#[derive(Debug, Clone)]
pub struct GameSession {
    pub name: String,
    pub host: String,
    pub current_players: u32,
    pub max_players: u32,
    pub average_level: u32,
    pub ping: u32,
    pub is_private: bool,
    pub password: Option<String>,  // Si privé
    pub map: String,
}

impl GameSession {
    pub fn new(name: &str, host: &str, max_players: u32, is_private: bool, password: Option<String>) -> Self {
        GameSession {
            name: name.to_string(),
            host: host.to_string(),
            current_players: 1,
            max_players,
            average_level: 1,
            ping: 0,
            is_private,
            password,
            map: "TheNexus".to_string(),
        }
    }
}

/// Bouton de menu
pub struct MenuButton {
    pub label: String,
    pub rect: Rect,
    pub color: Color,
    pub hover_color: Color,
}

impl MenuButton {
    pub fn new(label: &str, x: f32, y: f32, width: f32, height: f32) -> Self {
        MenuButton {
            label: label.to_string(),
            rect: Rect::new(x, y, width, height),
            color: Color::from_rgba(50, 50, 80, 255),
            hover_color: Color::from_rgba(70, 70, 120, 255),
        }
    }

    pub fn draw(&self, is_hovered: bool) {
        let color = if is_hovered { self.hover_color } else { self.color };

        // Ombre
        draw_rectangle(
            self.rect.x + 5.0,
            self.rect.y + 5.0,
            self.rect.w,
            self.rect.h,
            Color::from_rgba(0, 0, 0, 150),
        );

        // Fond
        draw_rectangle(self.rect.x, self.rect.y, self.rect.w, self.rect.h, color);

        // Bordure
        draw_rectangle_lines(
            self.rect.x,
            self.rect.y,
            self.rect.w,
            self.rect.h,
            3.0,
            if is_hovered { GOLD } else { WHITE },
        );

        // Texte centré
        let text_size = 32.0;
        let text_dims = measure_text(&self.label, None, text_size as u16, 1.0);
        draw_text(
            &self.label,
            self.rect.x + (self.rect.w - text_dims.width) / 2.0,
            self.rect.y + (self.rect.h + text_dims.height) / 2.0 - 5.0,
            text_size,
            WHITE,
        );
    }

    pub fn is_clicked(&self, mouse_pos: Vec2) -> bool {
        self.rect.contains(mouse_pos)
    }
}

/// Bouton de classe
pub struct ClassButton {
    pub class_name: String,
    pub description: String,
    pub rect: Rect,
    pub color: Color,
}

impl ClassButton {
    pub fn new(class_name: &str, description: &str, x: f32, y: f32, width: f32, height: f32, color: Color) -> Self {
        ClassButton {
            class_name: class_name.to_string(),
            description: description.to_string(),
            rect: Rect::new(x, y, width, height),
            color,
        }
    }

    pub fn draw(&self, is_hovered: bool) {
        let alpha = if is_hovered { 255 } else { 200 };
        let color = Color::new(self.color.r, self.color.g, self.color.b, alpha as f32 / 255.0);

        // Ombre
        draw_rectangle(
            self.rect.x + 5.0,
            self.rect.y + 5.0,
            self.rect.w,
            self.rect.h,
            Color::from_rgba(0, 0, 0, 150),
        );

        // Fond
        draw_rectangle(self.rect.x, self.rect.y, self.rect.w, self.rect.h, color);

        // Bordure
        draw_rectangle_lines(
            self.rect.x,
            self.rect.y,
            self.rect.w,
            self.rect.h,
            4.0,
            if is_hovered { GOLD } else { WHITE },
        );

        // Nom de la classe
        let text_size = 28.0;
        draw_text(
            &self.class_name,
            self.rect.x + 20.0,
            self.rect.y + 40.0,
            text_size,
            WHITE,
        );

        // Description
        let desc_size = 18.0;
        draw_text(
            &self.description,
            self.rect.x + 20.0,
            self.rect.y + 70.0,
            desc_size,
            LIGHTGRAY,
        );
    }

    pub fn is_clicked(&self, mouse_pos: Vec2) -> bool {
        self.rect.contains(mouse_pos)
    }
}

/// Bouton de session
pub struct SessionButton {
    pub session: GameSession,
    pub rect: Rect,
}

impl SessionButton {
    pub fn new(session: GameSession, x: f32, y: f32, width: f32, height: f32) -> Self {
        SessionButton {
            session,
            rect: Rect::new(x, y, width, height),
        }
    }

    pub fn draw(&self, _is_hovered: bool) {
        let bg_color = Color::from_rgba(30, 40, 60, 255);

        // Fond
        draw_rectangle(self.rect.x, self.rect.y, self.rect.w, self.rect.h, bg_color);

        // Bordure (toujours grise, plus de hover jaune)
        draw_rectangle_lines(
            self.rect.x,
            self.rect.y,
            self.rect.w,
            self.rect.h,
            2.0,
            Color::from_rgba(100, 100, 150, 255),
        );

        let x = self.rect.x + 10.0;
        let y = self.rect.y + 15.0;

        // Icône Private/Public
        if self.session.is_private {
            draw_text("🔒", x, y + 15.0, 20.0, RED);
        } else {
            draw_text("🌐", x, y + 15.0, 20.0, GREEN);
        }

        // Nom du serveur
        draw_text(&self.session.name, x + 30.0, y + 15.0, 22.0, WHITE);

        // Host
        draw_text(
            &format!("Host: {}", self.session.host),
            x + 30.0,
            y + 35.0,
            16.0,
            LIGHTGRAY,
        );

        // Players
        let players_x = x + 300.0;
        draw_text(
            &format!("{}/{}", self.session.current_players, self.session.max_players),
            players_x,
            y + 25.0,
            18.0,
            SKYBLUE,
        );

        // Avg Level
        let level_x = players_x + 80.0;
        draw_text(
            &format!("Lvl {}", self.session.average_level),
            level_x,
            y + 25.0,
            18.0,
            YELLOW,
        );

        // Ping
        let ping_x = level_x + 80.0;
        let ping_color = if self.session.ping < 50 {
            GREEN
        } else if self.session.ping < 100 {
            YELLOW
        } else {
            RED
        };
        draw_text(
            &format!("{}ms", self.session.ping),
            ping_x,
            y + 25.0,
            18.0,
            ping_color,
        );

        // Map
        let map_x = ping_x + 80.0;
        draw_text(&self.session.map, map_x, y + 25.0, 16.0, LIGHTGRAY);
        
        // ===== BOUTON JOIN =====
        let join_btn_x = self.rect.x + self.rect.w - 90.0;
        let join_btn_y = self.rect.y + 10.0;
        let join_btn_w = 80.0;
        let join_btn_h = 40.0;
        
        draw_rectangle(join_btn_x, join_btn_y, join_btn_w, join_btn_h, DARKGREEN);
        draw_rectangle_lines(join_btn_x, join_btn_y, join_btn_w, join_btn_h, 2.0, GREEN);
        draw_text("JOIN", join_btn_x + 20.0, join_btn_y + 28.0, 20.0, WHITE);
    }

    pub fn is_clicked(&self, mouse_pos: Vec2) -> bool {
        self.rect.contains(mouse_pos)
    }
    
    // Nouvelle méthode pour détecter le clic sur JOIN
    pub fn join_button_clicked(&self, mouse_pos: Vec2) -> bool {
        let join_btn_rect = Rect::new(
            self.rect.x + self.rect.w - 90.0,
            self.rect.y + 10.0,
            80.0,
            40.0,
        );
        join_btn_rect.contains(mouse_pos)
    }
}

