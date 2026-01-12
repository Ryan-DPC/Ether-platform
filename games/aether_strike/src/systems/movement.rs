use macroquad::prelude::*;
use crate::entities::{StickFigure, Enemy, Entity};

pub struct MovementSystem;

impl MovementSystem {
    /// Déplace les stick figures vers l'ennemi le plus proche
    pub fn move_allies_to_enemies(
        allies: &mut Vec<StickFigure>,
        enemies: &Vec<Enemy>,
        delta_time: f32,
    ) {
        for ally in allies.iter_mut() {
            if !ally.is_alive() {
                continue;
            }

            // Trouver l'ennemi le plus proche
            if let Some(closest_enemy) = Self::find_closest_enemy(ally.position, enemies) {
                let target_pos = closest_enemy.position;
                let direction = (target_pos - ally.position).normalize_or_zero();
                
                // Calculer la distance
                let distance = ally.position.distance(target_pos);
                
                // Si on est hors de portée d'attaque, se déplacer
                if distance > ally.attack_range {
                    ally.position += direction * ally.speed * delta_time;
                }
            }
        }
    }

    /// Déplace les ennemis vers l'allié le plus proche
    pub fn move_enemies_to_allies(
        enemies: &mut Vec<Enemy>,
        allies: &Vec<StickFigure>,
        delta_time: f32,
    ) {
        for enemy in enemies.iter_mut() {
            if !enemy.is_alive() {
                continue;
            }

            // Trouver l'allié le plus proche
            if let Some(closest_ally) = Self::find_closest_ally(enemy.position, allies) {
                let target_pos = closest_ally.position;
                let direction = (target_pos - enemy.position).normalize_or_zero();
                
                // Calculer la distance
                let distance = enemy.position.distance(target_pos);
                
                // Si on est hors de portée d'attaque, se déplacer
                if distance > enemy.attack_range {
                    enemy.position += direction * enemy.speed * delta_time;
                }
            }
        }
    }

    fn find_closest_enemy(position: Vec2, enemies: &Vec<Enemy>) -> Option<&Enemy> {
        enemies
            .iter()
            .filter(|e| e.is_alive())
            .min_by(|a, b| {
                let dist_a = position.distance(a.position);
                let dist_b = position.distance(b.position);
                dist_a.partial_cmp(&dist_b).unwrap()
            })
    }

    fn find_closest_ally(position: Vec2, allies: &Vec<StickFigure>) -> Option<&StickFigure> {
        allies
            .iter()
            .filter(|a| a.is_alive())
            .min_by(|a, b| {
                let dist_a = position.distance(a.position);
                let dist_b = position.distance(b.position);
                dist_a.partial_cmp(&dist_b).unwrap()
            })
    }
}
