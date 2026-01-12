use macroquad::prelude::*;
use super::{Entity, EntityType};

/// Ennemi (stick figure ennemi)
#[derive(Debug, Clone)]
pub struct Enemy {
    pub position: Vec2,
    pub health: f32,
    pub max_health: f32,
    pub speed: f32,
    pub attack_damage: f32,
    pub attack_range: f32,
    pub attack_cooldown: f32,
    pub attack_timer: f32,
    pub gold_reward: u32,
    pub color: Color,
}

impl Enemy {
    pub fn new(position: Vec2) -> Self {
        Enemy {
            position,
            health: 50.0,
            max_health: 50.0,
            speed: 60.0,
            attack_damage: 10.0,
            attack_range: 50.0,
            attack_cooldown: 1.5, // Plus lent que les alliés
            attack_timer: 0.0,
            gold_reward: 5,
            color: RED,
        }
    }

    pub fn update(&mut self, delta_time: f32) {
        // Réduction du cooldown d'attaque
        if self.attack_timer > 0.0 {
            self.attack_timer -= delta_time;
        }
    }

    pub fn can_attack(&self) -> bool {
        self.attack_timer <= 0.0
    }

    pub fn attack(&mut self) {
        self.attack_timer = self.attack_cooldown;
    }

    pub fn draw(&self) {
        // Corps (rectangle vertical)
        let body_height = 30.0;
        let body_width = 6.0;
        draw_rectangle(
            self.position.x - body_width / 2.0,
            self.position.y - body_height / 2.0,
            body_width,
            body_height,
            self.color,
        );

        // Tête (cercle)
        let head_radius = 8.0;
        draw_circle(
            self.position.x,
            self.position.y - body_height / 2.0 - head_radius,
            head_radius,
            self.color,
        );

        // Bras (ligne horizontale)
        let arm_width = 20.0;
        draw_line(
            self.position.x - arm_width / 2.0,
            self.position.y - body_height / 4.0,
            self.position.x + arm_width / 2.0,
            self.position.y - body_height / 4.0,
            3.0,
            self.color,
        );

        // Jambes (2 lignes)
        let leg_length = 15.0;
        draw_line(
            self.position.x - 5.0,
            self.position.y + body_height / 2.0,
            self.position.x - 5.0,
            self.position.y + body_height / 2.0 + leg_length,
            3.0,
            self.color,
        );
        draw_line(
            self.position.x + 5.0,
            self.position.y + body_height / 2.0,
            self.position.x + 5.0,
            self.position.y + body_height / 2.0 + leg_length,
            3.0,
            self.color,
        );

        // Barre de vie
        let health_bar_width = 40.0;
        let health_bar_height = 5.0;
        let health_percentage = self.health / self.max_health;

        // Background
        draw_rectangle(
            self.position.x - health_bar_width / 2.0,
            self.position.y - 60.0,
            health_bar_width,
            health_bar_height,
            DARKGRAY,
        );

        // Foreground
        draw_rectangle(
            self.position.x - health_bar_width / 2.0,
            self.position.y - 60.0,
            health_bar_width * health_percentage,
            health_bar_height,
            ORANGE,
        );
    }
}

impl Entity for Enemy {
    fn position(&self) -> Vec2 {
        self.position
    }

    fn set_position(&mut self, pos: Vec2) {
        self.position = pos;
    }

    fn health(&self) -> f32 {
        self.health
    }

    fn max_health(&self) -> f32 {
        self.max_health
    }

    fn is_alive(&self) -> bool {
        self.health > 0.0
    }

    fn take_damage(&mut self, damage: f32) {
        self.health = (self.health - damage).max(0.0);
    }

    fn entity_type(&self) -> EntityType {
        EntityType::Enemy
    }
}
