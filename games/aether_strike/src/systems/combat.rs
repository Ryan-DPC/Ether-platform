use macroquad::prelude::*;
use crate::entities::{StickFigure, Enemy, Entity};

pub struct CombatSystem;

impl CombatSystem {
    /// Fait combattre les alliés contre les ennemis
    pub fn process_ally_attacks(allies: &mut Vec<StickFigure>, enemies: &mut Vec<Enemy>) {
        for ally in allies.iter_mut() {
            if !ally.is_alive() || !ally.can_attack() {
                continue;
            }

            // Trouver l'ennemi le plus proche dans la portée
            if let Some(enemy_idx) = Self::find_enemy_in_range(ally.position, ally.attack_range, enemies) {
                // Attaquer l'ennemi
                enemies[enemy_idx].take_damage(ally.attack_damage);
                ally.attack();
            }
        }
    }

    /// Fait combattre les ennemis contre les alliés
    pub fn process_enemy_attacks(enemies: &mut Vec<Enemy>, allies: &mut Vec<StickFigure>) {
        for enemy in enemies.iter_mut() {
            if !enemy.is_alive() || !enemy.can_attack() {
                continue;
            }

            // Trouver l'allié le plus proche dans la portée
            if let Some(ally_idx) = Self::find_ally_in_range(enemy.position, enemy.attack_range, allies) {
                // Attaquer l'allié
                allies[ally_idx].take_damage(enemy.attack_damage);
                enemy.attack();
            }
        }
    }

    /// Nettoyer les entités mortes
    pub fn remove_dead_entities(
        allies: &mut Vec<StickFigure>,
        enemies: &mut Vec<Enemy>,
    ) -> u32 {
        let enemies_killed = enemies.iter().filter(|e| !e.is_alive()).count() as u32;
        
        allies.retain(|a| a.is_alive());
        enemies.retain(|e| e.is_alive());
        
        enemies_killed
    }

    fn find_enemy_in_range(
        position: Vec2,
        range: f32,
        enemies: &Vec<Enemy>,
    ) -> Option<usize> {
        enemies
            .iter()
            .enumerate()
            .filter(|(_, e)| e.is_alive())
            .find(|(_, e)| position.distance(e.position) <= range)
            .map(|(idx, _)| idx)
    }

    fn find_ally_in_range(
        position: Vec2,
        range: f32,
        allies: &Vec<StickFigure>,
    ) -> Option<usize> {
        allies
            .iter()
            .enumerate()
            .filter(|(_, a)| a.is_alive())
            .find(|(_, a)| position.distance(a.position) <= range)
            .map(|(idx, _)| idx)
    }
}
