use macroquad::prelude::*;
use crate::entities::{Enemy, Entity};
use crate::game::Resources;

/// Type d'attaque spéciale
#[derive(Debug, Clone, Copy)]
pub enum AbilityType {
    Fireball,    // Boule de feu (dégâts zone)
    Lightning,   // Éclair (dégâts instantanés)
    Heal,        // Soigner les alliés
}

impl AbilityType {
    pub fn name(&self) -> &str {
        match self {
            AbilityType::Fireball => "Fireball",
            AbilityType::Lightning => "Lightning",
            AbilityType::Heal => "Heal",
        }
    }

    pub fn cost(&self) -> u32 {
        match self {
            AbilityType::Fireball => 30,
            AbilityType::Lightning => 50,
            AbilityType::Heal => 40,
        }
    }

    pub fn icon(&self) -> &str {
        match self {
            AbilityType::Fireball => "🔥",
            AbilityType::Lightning => "⚡",
            AbilityType::Heal => "💚",
        }
    }

    pub fn color(&self) -> Color {
        match self {
            AbilityType::Fireball => ORANGE,
            AbilityType::Lightning => YELLOW,
            AbilityType::Heal => GREEN,
        }
    }
}

pub struct SpecialAbility {
    pub ability_type: AbilityType,
    pub button: Button,
}

impl SpecialAbility {
    pub fn new(ability_type: AbilityType, position: Vec2) -> Self {
        SpecialAbility {
            ability_type,
            button: Button::new(position, 60.0, 60.0),
        }
    }

    pub fn draw(&self, resources: &Resources) {
        let can_afford = resources.can_afford_mana(self.ability_type.cost());
        let color = if can_afford {
            self.ability_type.color()
        } else {
            DARKGRAY
        };

        self.button.draw(color);

        // Icône centrée
        let text_size = 30.0;
        draw_text(
            self.ability_type.icon(),
            self.button.position.x + self.button.width / 2.0 - text_size / 2.0,
            self.button.position.y + self.button.height / 2.0 + 10.0,
            text_size,
            WHITE,
        );

        // Coût en mana
        let cost_text = format!("{}", self.ability_type.cost());
        let cost_text_size = 16.0;
        draw_text(
            &cost_text,
            self.button.position.x + self.button.width / 2.0 - cost_text_size / 2.0,
            self.button.position.y + self.button.height + 15.0,
            cost_text_size,
            WHITE,
        );
    }

    pub fn is_clicked(&self, mouse_pos: Vec2) -> bool {
        self.button.is_clicked(mouse_pos)
    }

    pub fn activate(&self, enemies: &mut Vec<Enemy>, resources: &mut Resources) {
        if !resources.spend_mana(self.ability_type.cost()) {
            return; // Pas assez de mana
        }

        match self.ability_type {
            AbilityType::Fireball => {
                // Inflige des dégâts à tous les ennemis
                for enemy in enemies.iter_mut() {
                    enemy.take_damage(25.0);
                }
            }
            AbilityType::Lightning => {
                // Inflige des dégâts massifs au premier ennemi
                if let Some(enemy) = enemies.first_mut() {
                    enemy.take_damage(80.0);
                }
            }
            AbilityType::Heal => {
                // TODO: Soigner les alliés (à implémenter)
            }
        }
    }
}

pub struct Button {
    pub position: Vec2,
    pub width: f32,
    pub height: f32,
}

impl Button {
    pub fn new(position: Vec2, width: f32, height: f32) -> Self {
        Button {
            position,
            width,
            height,
        }
    }

    pub fn draw(&self, color: Color) {
        // Ombre
        draw_rectangle(
            self.position.x + 3.0,
            self.position.y + 3.0,
            self.width,
            self.height,
            Color::from_rgba(0, 0, 0, 100),
        );

        // Bouton principal
        draw_rectangle(
            self.position.x,
            self.position.y,
            self.width,
            self.height,
            color,
        );

        // Bordure
        draw_rectangle_lines(
            self.position.x,
            self.position.y,
            self.width,
            self.height,
            3.0,
            WHITE,
        );
    }

    pub fn is_clicked(&self, mouse_pos: Vec2) -> bool {
        mouse_pos.x >= self.position.x
            && mouse_pos.x <= self.position.x + self.width
            && mouse_pos.y >= self.position.y
            && mouse_pos.y <= self.position.y + self.height
    }
}
