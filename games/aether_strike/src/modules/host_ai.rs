use macroquad::prelude::*;
use std::collections::HashMap;
use crate::server::NetworkManager;
use crate::game::GameState;
use crate::entities::Enemy;
use crate::menu_system::PlayerProfile;
use crate::modules::turn::TurnSystem;
use crate::network_protocol::{PlayerData, EnemyData};

pub struct HostAI {
    pub acted: bool,
    pub attack_timer: f64,
}

impl HostAI {
    pub fn new() -> Self {
        Self {
            acted: false,
            attack_timer: 0.0,
        }
    }

    pub fn reset_turn_flag(&mut self) {
        self.acted = false;
    }

    pub fn update(
        &mut self,
        current_turn_id: &mut String,
        player_profile: &PlayerProfile,
        game_state: &GameState,
        network_manager: &NetworkManager,
        enemies: &Vec<Enemy>,
        enemy: &Option<Enemy>,
        other_players: &HashMap<String, PlayerData>,
        turn_system: &mut TurnSystem,
        is_solo_mode: bool,
        lobby_host_id: &str,
    ) {
        // DEBUG: Log all conditions
        println!("HostAI: is_solo={}, lobby_host='{}', me='{}', current_turn='{}'", 
            is_solo_mode, lobby_host_id, player_profile.vext_username, current_turn_id);
        
        // Must be Multiplayer, Host, and not Solo
        if is_solo_mode || lobby_host_id != player_profile.vext_username {
            return;
        }

        // DEBUG: Trace Turn
        if network_manager.client.is_some() {
             println!("Host AI Active: Turn={}, Acted={}", current_turn_id, self.acted);
        }

        if let Some(client) = &network_manager.client {
            // DEBUG: Print available enemy IDs
            if !enemies.is_empty() {
                println!("HostAI: Looking for turn_id='{}' in {} enemies: {:?}", 
                    current_turn_id, 
                    enemies.len(),
                    enemies.iter().map(|e| e.id.clone()).collect::<Vec<_>>()
                );
            }
            
            // Check Minion
            if let Some(minion) = enemies.iter().find(|e| &e.id == current_turn_id) {
                if !self.acted {
                    self.attack_timer += get_frame_time() as f64;
                    if self.attack_timer > 0.2 { // WAS 0.6
                        self.attack_timer = 0.0;
                        
                        // --- SMART TARGET SELECTION ---
                        let mut targets: Vec<(String, f32)> = Vec::new();
                        targets.push((player_profile.vext_username.clone(), game_state.resources.current_hp));
                        for rp in other_players.values() {
                            targets.push((rp.user_id.clone(), rp.hp));
                        }
                        targets.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
                        
                        let target = if !targets.is_empty() { targets[0].0.clone() } else { player_profile.vext_username.clone() };
                        
                        // println!("Host AI: Minion {} SMART-attacks {}", minion.id, target);
                        client.admin_attack(minion.id.clone(), "Attack".to_string(), Some(target), minion.attack_damage);
                        
                        self.acted = true;
                        
                        let next = turn_system.peek_next_id();
                        // println!("Host AI: Minion Ending turn for {}. Next: '{}'", minion.id, next);
                        // --- OPTIMISTIC AI TURN ADVANCE ---
                        *current_turn_id = next.clone();
                        turn_system.sync_to_id(&next);

                        client.end_turn(next);
                    }
                }
            } 
            // Check Boss
            else if let Some(boss) = enemy {
                if &boss.id == current_turn_id {
                    if !self.acted {
                        self.attack_timer += get_frame_time() as f64;
                        if self.attack_timer > 0.5 { // WAS 1.0 (Boss acts slower, but not THAT slow)
                            self.attack_timer = 0.0;
                            
                            // --- SMART TARGET SELECTION ---
                            let mut targets: Vec<(String, f32)> = Vec::new();
                            targets.push((player_profile.vext_username.clone(), game_state.resources.current_hp));
                            for rp in other_players.values() {
                                targets.push((rp.user_id.clone(), rp.hp));
                            }
                            targets.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
                            
                            let target = if !targets.is_empty() { targets[0].0.clone() } else { player_profile.vext_username.clone() };

                            // println!("Host AI: Boss {} SMART-attacks {}", boss.id, target);
                            client.admin_attack(boss.id.clone(), "Smash".to_string(), Some(target), boss.attack_damage);
                            
                            self.acted = true;
                            
                            let next = turn_system.peek_next_id();
                            // println!("Host AI: Boss Ending turn for {}. Next: '{}'", boss.id, next);
                            
                            // Optimistic Update
                            *current_turn_id = next.clone();
                            turn_system.sync_to_id(&next);

                            client.end_turn(next);
                        }
                    }
                }
            }
        }
    }
}
