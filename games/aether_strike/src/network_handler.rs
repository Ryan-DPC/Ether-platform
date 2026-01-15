use std::collections::HashMap;
use crate::network_client::{GameClient, GameEvent, RemotePlayer, EnemyData};
use crate::menu_system::PlayerProfile;
use crate::class_system::CharacterClass;
use crate::game::GameState;
use crate::entities::Enemy;
use crate::modules::online;
use crate::modules::enemy_model;
use crate::modules::turn::TurnSystem;

pub struct NetworkHandler;

impl NetworkHandler {
    pub fn handle_events(
        client: &GameClient,
        player_profile: &PlayerProfile,
        all_classes: &[CharacterClass],
        other_players: &mut HashMap<String, RemotePlayer>,
        game_state: &mut Option<GameState>,
        enemies: &mut Vec<Enemy>,
        enemy_boss: &mut Option<Enemy>,
        turn_system: &mut TurnSystem,
        current_turn_id: &mut String,
        combat_logs: &mut Vec<String>,
        last_network_log: &mut String,
        lobby_host_id: &mut String,
        selected_class: &mut Option<CharacterClass>,
        screen_width: f32,
        screen_height: f32,
        enemy_hp: &mut f32,
    ) -> Option<String> { // Returns Some(new_screen) if we need to switch screen
        let mut next_screen = None;
        let events = client.poll_updates();
        for event in events {
            match event {
                GameEvent::GameState { players, host_id } => {
                    let (msg, updated_class) = online::sync_game_state(
                        players,
                        &player_profile.vext_username,
                        other_players,
                        all_classes
                    );
                    *last_network_log = msg;
                    if let Some(cls) = updated_class {
                        *selected_class = Some(cls);
                    }
                    *lobby_host_id = host_id;
                }
                GameEvent::PlayerJoined { player_id, username, class } => {
                    let msg = online::handle_player_joined(
                        &username,
                        &player_id,
                        &class,
                        &player_profile.vext_username,
                        other_players
                    );
                    *last_network_log = msg;
                }
                GameEvent::PlayerLeft { player_id } => {
                    let msg = online::handle_player_left(&player_id, other_players);
                    *last_network_log = msg;
                }
                GameEvent::NewHost { host_id } => {
                    *lobby_host_id = host_id.clone();
                    *last_network_log = format!("New Host: {}", host_id);
                }
                GameEvent::PlayerUpdated { player_id, class } => {
                    println!("NET-RX: Player Updated {} -> {}", player_id, class);
                    let display_class = class.clone();
                    *last_network_log = format!("Update: {} -> {}", &player_id[..4], display_class);
                    if let Some(player) = other_players.get_mut(&player_id) {
                        player.class = display_class;
                    }
                }
                GameEvent::GameStarted { enemies: server_enemies } => {
                    println!("NET-RX: GameStarted Event received with {} enemies", server_enemies.len());
                    *last_network_log = "Game start received! Launching...".to_string();
                    
                    let p_class = selected_class.clone().unwrap_or_else(|| all_classes[0].clone());
                    *selected_class = Some(p_class.clone());
                    *game_state = Some(GameState::new(p_class.clone()));
                    
                    if !server_enemies.is_empty() {
                        enemies.clear();
                        *enemy_boss = None;
                        let (synced_enemies, boss_ref) = enemy_model::from_server_data(&server_enemies, screen_width, screen_height);
                        *enemies = synced_enemies;
                        *enemy_boss = boss_ref;
                    } else if !enemies.is_empty() {
                         println!("NET-RX: Server sent EMPTY enemies. Using LOCAL BACKUP ({} enemies).", enemies.len());
                    } else {
                         println!("NET-RX: No enemies source found. Attempting EMERGENCY GENERATION...");
                         let temp_wm = crate::waves::WaveManager::new();
                         if let Some(wave) = temp_wm.waves.get(0) {
                             for (stats, kind, _pos) in &wave.enemies {
                                 let e = Enemy::new(*_pos, kind.clone(), stats.clone());
                                 enemies.push(e);
                             }
                             println!("NET-RX: Generated {} emergency enemies. Multiplayer sync might be imperfect.", enemies.len());
                         } else {
                             println!("NET-RX: Fatal - Could not generate enemies.");
                         }
                    }

                    turn_system.init_queue(
                        &player_profile.vext_username,
                        game_state.as_ref().unwrap().resources.speed as u32,
                        other_players,
                        enemies,
                        enemy_boss.as_ref()
                    );
                    *current_turn_id = turn_system.get_current_id().to_string();
                    
                    combat_logs.clear();
                    combat_logs.push("Multiplayer Battle started!".to_string());
                    next_screen = Some("InGame".to_string());
                }
                GameEvent::PlayerUpdate(update) => {
                    if let Some(player) = other_players.get_mut(&update.player_id) {
                        if let Some(pos) = update.position {
                            player.position = pos;
                        }
                    }
                }
                GameEvent::TurnChanged { current_turn_id: next_id } => {
                    *current_turn_id = next_id;
                    combat_logs.push(format!("Turn: {}", if *current_turn_id == "enemy" { "ENEMY" } else if current_turn_id == &player_profile.vext_username { "YOU" } else { &current_turn_id[..4] }));
                }
                GameEvent::CombatAction { actor_id, target_id, action_name, damage, mana_cost, .. } => {
                    let actor_name = if actor_id == "enemy" { "ENEMY" } else { 
                        if actor_id == player_profile.vext_username { "YOU" } else { 
                           // Find in other players
                           other_players.get(&actor_id).map(|p| p.username.as_str()).unwrap_or(&actor_id[..4])
                        }
                    };
                    combat_logs.push(format!("{} used {} ({} dmg)", actor_name, action_name, damage));
                    
                    if let Some(tid) = target_id {
                        if tid == "enemy" {
                            *enemy_hp = (*enemy_hp - damage).max(0.0);
                            // Also update boss health if it exists
                            if let Some(boss) = enemy_boss {
                                boss.health = *enemy_hp;
                            }
                        } else if tid == player_profile.vext_username {
                            if let Some(gs) = game_state {
                                gs.resources.current_hp = (gs.resources.current_hp - damage).max(0.0);
                            }
                        }
                    } else if actor_id == "enemy" {
                         // Area attack by enemy
                         if let Some(gs) = game_state {
                             gs.resources.current_hp = (gs.resources.current_hp - damage).max(0.0);
                         }
                    }

                    if actor_id == player_profile.vext_username {
                        if let Some(gs) = game_state {
                            gs.resources.mana = gs.resources.mana.saturating_sub(mana_cost);
                        }
                    }
                }
                GameEvent::Error(e) => {
                    *last_network_log = format!("Error: {}", e);
                }
                _ => {}
            }
        }
        next_screen
    }
}
