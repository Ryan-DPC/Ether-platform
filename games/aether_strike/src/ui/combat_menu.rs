use macroquad::prelude::*;

/// État du menu de combat
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MenuState {
    Main,      // Menu principal (Attack, Bag, Flee, Passif)
    Attack,    // Sous-menu des attaques
    Bag,       // Sous-menu du sac
    Passif,    // Sous-menu des passifs
}

/// Type d'attaque disponible
#[derive(Debug, Clone)]
pub struct Attack {
    pub name: String,
    pub damage: f32,
    pub mana_cost: u32,
    pub description: String,
}

impl Attack {
    pub fn new(name: &str, damage: f32, mana_cost: u32, description: &str) -> Self {
        Attack {
            name: name.to_string(),
            damage,
            mana_cost,
            description: description.to_string(),
        }
    }
}

/// Génère 10 attaques mock pour le test
pub fn get_mock_attacks() -> Vec<Attack> {
    vec![
        Attack::new("Basic Attack", 0.0, 0, "Free attack (dmg based on level)"), // Dégâts calculés dynamiquement
        Attack::new("Slash", 15.0, 5, "Basic sword slash"),
        Attack::new("Fireball", 30.0, 15, "Launch a fireball"),
        Attack::new("Ice Spike", 25.0, 12, "Sharp ice projectile"),
        Attack::new("Thunder", 40.0, 20, "Lightning strike"),
        Attack::new("Heal", 0.0, 10, "Restore HP"),
        Attack::new("Poison", 20.0, 8, "Poison damage over time"),
        Attack::new("Shield Bash", 18.0, 6, "Stun enemy"),
        Attack::new("Arrow Rain", 35.0, 18, "Multiple arrows"),
        Attack::new("Meteor", 50.0, 30, "Massive damage"),
    ]
}

/// Bouton du menu principal
pub struct MenuButton {
    pub label: String,
    pub rect: Rect,
    pub color: Color,
}

impl MenuButton {
    pub fn new(label: &str, x: f32, y: f32, width: f32, height: f32) -> Self {
        MenuButton {
            label: label.to_string(),
            rect: Rect::new(x, y, width, height),
            color: Color::from_rgba(60, 60, 80, 255),
        }
    }

    pub fn draw(&self, is_hovered: bool) {
        let color = if is_hovered {
            Color::from_rgba(80, 80, 120, 255)
        } else {
            self.color
        };

        // Ombre
        draw_rectangle(
            self.rect.x + 3.0,
            self.rect.y + 3.0,
            self.rect.w,
            self.rect.h,
            Color::from_rgba(0, 0, 0, 100),
        );

        // Fond du bouton
        draw_rectangle(self.rect.x, self.rect.y, self.rect.w, self.rect.h, color);

        // Bordure
        draw_rectangle_lines(
            self.rect.x,
            self.rect.y,
            self.rect.w,
            self.rect.h,
            2.0,
            WHITE,
        );

        // Texte centré
        let text_size = 24.0;
        let text_dims = measure_text(&self.label, None, text_size as u16, 1.0);
        draw_text(
            &self.label,
            self.rect.x + (self.rect.w - text_dims.width) / 2.0,
            self.rect.y + (self.rect.h + text_dims.height) / 2.0,
            text_size,
            WHITE,
        );
    }

    pub fn is_clicked(&self, mouse_pos: Vec2) -> bool {
        self.rect.contains(mouse_pos)
    }
}

/// Bouton d'attaque (plus petit)
pub struct AttackButton {
    pub attack: Attack,
    pub rect: Rect,
}

impl AttackButton {
    pub fn new(attack: Attack, x: f32, y: f32, width: f32, height: f32) -> Self {
        AttackButton {
            attack,
            rect: Rect::new(x, y, width, height),
        }
    }

    pub fn draw(&self, is_hovered: bool, can_afford: bool) {
        let color = if !can_afford {
            Color::from_rgba(40, 40, 40, 255) // Grisé si pas assez de mana
        } else if is_hovered {
            Color::from_rgba(100, 150, 200, 255)
        } else {
            Color::from_rgba(70, 100, 150, 255)
        };

        // Ombre
        draw_rectangle(
            self.rect.x + 2.0,
            self.rect.y + 2.0,
            self.rect.w,
            self.rect.h,
            Color::from_rgba(0, 0, 0, 100),
        );

        // Fond
        draw_rectangle(self.rect.x, self.rect.y, self.rect.w, self.rect.h, color);

        // Bordure
        let border_color = if can_afford { GOLD } else { DARKGRAY };
        draw_rectangle_lines(
            self.rect.x,
            self.rect.y,
            self.rect.w,
            self.rect.h,
            2.0,
            border_color,
        );

        // Nom de l'attaque
        let text_size = 18.0;
        draw_text(
            &self.attack.name,
            self.rect.x + 5.0,
            self.rect.y + 20.0,
            text_size,
            WHITE,
        );

        // Coût en mana
        if self.attack.mana_cost > 0 {
            let mana_text = format!("MP: {}", self.attack.mana_cost);
            draw_text(
                &mana_text,
                self.rect.x + 5.0,
                self.rect.y + 38.0,
                14.0,
                SKYBLUE,
            );
        }

        // Dégâts
        if self.attack.damage > 0.0 {
            let dmg_text = format!("DMG: {}", self.attack.damage as i32);
            draw_text(
                &dmg_text,
                self.rect.x + self.rect.w - 60.0,
                self.rect.y + 38.0,
                14.0,
                ORANGE,
            );
        }
    }

    pub fn is_clicked(&self, mouse_pos: Vec2) -> bool {
        self.rect.contains(mouse_pos)
    }
}
