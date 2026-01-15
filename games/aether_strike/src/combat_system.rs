use crate::game::GameState;
use crate::entities::{Enemy, StickFigure};
use crate::modules::turn::TurnSystem;
use crate::modules::effect::EffectType;
use crate::ui::hud::{HUDAction, BattleUIState};
use crate::waves::{WaveManager, WaveState};
use crate::menu_system::PlayerProfile;
use crate::network_client::RemotePlayer;
use std::collections::HashMap;
use macroquad::prelude::*;

pub struct CombatSystem;

impl CombatSystem {
    pub fn handle_player_action(
        action: &HUDAction,
        gs: &mut GameState,
        player: &mut Option<StickFigure>,
        enemies: &mut Vec<Enemy>,
        enemy_boss: &mut Option<Enemy>,
        turn_system: &mut TurnSystem,
        combat_logs: &mut Vec<String>,
        battle_ui_state: &mut BattleUIState,
        should_advance_turn: &mut bool,
        enemy_hp: &mut f32,
    ) {
        match action {
            HUDAction::UseAttack(name, target_id) => {
                if let Some(atk) = gs.character_class.skills.iter().find(|s| &s.name == name) {
                    if gs.resources.can_afford_mana(atk.mana_cost) {
                        gs.resources.mana = gs.resources.mana.saturating_sub(atk.mana_cost);
                        let effects = atk.get_effects();
                        let is_aoe = atk.skill_type.contains("AoE") || atk.skill_type.contains("Area");
                        
                        let mut final_targets = Vec::new();
                        if target_id == "player" {
                            final_targets.push("player".to_string());
                        } else {
                            let mut main_idx = None;
                            for (i, e) in enemies.iter().enumerate() {
                                if &e.id == target_id {
                                    main_idx = Some(i);
                                    break;
                                }
                            }
                            
                            if let Some(boss) = &enemy_boss {
                                if &boss.id == target_id {
                                    final_targets.push(boss.id.clone());
                                }
                            }
                            
                            if let Some(idx) = main_idx {
                                final_targets.push(enemies[idx].id.clone());
                                if is_aoe {
                                    if idx > 0 { final_targets.push(enemies[idx - 1].id.clone()); }
                                    if idx < enemies.len() - 1 { final_targets.push(enemies[idx + 1].id.clone()); }
                                }
                            }
                        }

                        for tid in final_targets {
                            for effect in &effects {
                                match &effect.effect_type {
                                    EffectType::Heal => {
                                        if tid == "player" {
                                            let heal_val = effect.value;
                                            gs.resources.current_hp = (gs.resources.current_hp + heal_val).min(gs.resources.max_hp);
                                            if let Some(p) = player { p.health = gs.resources.current_hp; }
                                            combat_logs.push(format!("You healed for {:.0} HP!", heal_val));
                                        }
                                    }
                                    EffectType::InstantDamage => {
                                        let damage = effect.value;
                                        let mut hit = false;
                                        if let Some(boss) = enemy_boss {
                                            if boss.id == tid && boss.health > 0.0 {
                                                boss.health = (boss.health - damage).max(0.0);
                                                boss.add_threat("player", damage);
                                                *enemy_hp = boss.health; 
                                                combat_logs.push(format!("Hit Boss for {:.0}!", damage));
                                                if boss.health <= 0.0 {
                                                    turn_system.update_speed(&boss.id, 0);
                                                    combat_logs.push("Boss defeated!".to_string());
                                                }
                                                hit = true;
                                            }
                                        }
                                        if !hit {
                                            for e in enemies.iter_mut() {
                                                if e.id == tid && e.health > 0.0 {
                                                    e.health = (e.health - damage).max(0.0);
                                                    e.add_threat("player", damage);
                                                    combat_logs.push(format!("Hit {} for {:.0}!", e.name, damage));
                                                    if e.health <= 0.0 {
                                                        turn_system.update_speed(&e.id, 0);
                                                        combat_logs.push(format!("{} defeated!", e.name));
                                                    }
                                                    hit = true;
                                                }
                                            }
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                        *should_advance_turn = true;
                        *battle_ui_state = BattleUIState::Main;
                    }
                }
            }
            HUDAction::UseItem(item_type) => {
                if gs.inventory.use_item(*item_type) {
                    match item_type {
                        crate::inventory::ItemType::HealthPotion => {
                            gs.resources.current_hp = (gs.resources.current_hp + 50.0).min(gs.resources.max_hp);
                            if let Some(p) = player { p.health = gs.resources.current_hp; }
                        }
                        crate::inventory::ItemType::ManaPotion => { gs.resources.restore_mana(30); }
                        crate::inventory::ItemType::FullRestore => {
                            gs.resources.current_hp = gs.resources.max_hp;
                            gs.resources.mana = gs.resources.max_mana;
                            if let Some(p) = player { p.health = gs.resources.max_hp; }
                        }
                    }
                    combat_logs.push(format!("Used {}!", item_type.name()));
                    *should_advance_turn = true;
                    *battle_ui_state = BattleUIState::Main;
                }
            }
            HUDAction::EndTurn => {
                *should_advance_turn = true;
            }
            _ => {}
        }
    }

    pub fn handle_enemy_ai(
        current_turn_id: &str,
        enemies: &mut Vec<Enemy>,
        enemy_boss: &mut Option<Enemy>,
        gs: &mut GameState,
        combat_logs: &mut Vec<String>,
        battle_ui_state: &mut BattleUIState,
        enemy_attack_timer: &mut f64,
        should_advance_turn: &mut bool,
    ) {
        let mut active_enemy_idx = None;
        let mut is_boss_turn = false;

        for (i, e) in enemies.iter().enumerate() {
            if e.id == current_turn_id {
                active_enemy_idx = Some(i);
                break;
            }
        }
        if active_enemy_idx.is_none() {
            if let Some(boss) = enemy_boss {
                if boss.id == current_turn_id { is_boss_turn = true; }
            }
        }

        if active_enemy_idx.is_some() || is_boss_turn {
            if *enemy_attack_timer == 0.0 {
                *enemy_attack_timer = get_time() + 1.0;
            } else if get_time() > *enemy_attack_timer {
                let damage = if is_boss_turn {
                    enemy_boss.as_ref().unwrap().attack_damage
                } else {
                    enemies[active_enemy_idx.unwrap()].attack_damage
                };
                let name = if is_boss_turn { "BOSS".to_string() } else { enemies[active_enemy_idx.unwrap()].name.clone() };

                gs.resources.current_hp = (gs.resources.current_hp - damage).max(0.0);
                combat_logs.push(format!("{} hits you for {:.0}!", name, damage));

                if gs.resources.current_hp <= 0.0 {
                    *battle_ui_state = BattleUIState::Defeat;
                    combat_logs.push("You have been defeated!".to_string());
                }

                *should_advance_turn = true;
                *enemy_attack_timer = 0.0;
            }
        } else {
            // Turn of a dead entity?
            *should_advance_turn = true;
        }
    }

    pub fn update_turn_system(
        turn_system: &mut TurnSystem,
        player_profile: &PlayerProfile,
        gs: &Option<GameState>,
        other_players: &HashMap<String, RemotePlayer>,
        enemies: &mut Vec<Enemy>,
        enemy_boss: &mut Option<Enemy>,
        current_turn_id: &mut String,
        combat_logs: &mut Vec<String>,
    ) {
        let new_round = turn_system.advance_turn();
        *current_turn_id = turn_system.get_current_id().to_string();

        if new_round {
            enemies.retain(|e| e.health > 0.0);
            if let Some(boss) = enemy_boss {
                if boss.health <= 0.0 { *enemy_boss = None; }
            }

            turn_system.init_queue(
                &player_profile.vext_username,
                if let Some(g) = gs { g.resources.speed as u32 } else { 100 },
                other_players,
                enemies,
                enemy_boss.as_ref()
            );
            *current_turn_id = turn_system.get_current_id().to_string();
            combat_logs.push("🔁 New Round!".to_string());
        }
    }
}
