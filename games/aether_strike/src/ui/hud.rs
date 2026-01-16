use macroquad::prelude::*;
use crate::game::GameState;
use crate::class_system::CharacterClass;

#[derive(Debug, Clone, PartialEq)]
pub enum BattleUIState {
    Main,
    AttackMenu,
    BagMenu,
    PassiveInfo,
    Defeat,
    Targeting(usize), // Selected Skill Index
}

#[derive(Debug, Clone)]
pub enum HUDAction {
    UseAttack(String, String), // SkillName, TargetID
    UseItem(crate::inventory::ItemType),
    Resurrect,
    GiveUp,
    Flee,
    EndTurn,
}

pub struct HUD;

impl HUD {


    pub fn draw(
        game_state: &GameState, 
        screen_width: f32, 
        screen_height: f32, 
        character_name: &str, 
        character_class: &CharacterClass,
        other_players: &std::collections::HashMap<String, crate::network_client::RemotePlayer>,
        enemies: &[crate::entities::Enemy],
        start_enemy: Option<&crate::entities::Enemy>, // For multiplayer Boss fallback
        current_turn_id: &str,
        is_my_turn: bool,
        ui_state: &mut BattleUIState,
        combat_logs: &[String],
    ) -> Option<HUDAction> {
        let mut result_action = None;
        let padding = 12.0;
        
        // ============================================================
        // DYNAMIC TEAM DATA
        // ============================================================
        struct DisplayMember {
            name: String,
            class: String,
            hp: f32,
            max_hp: f32,
            is_player: bool,
            mana: Option<(f32, f32)>, // current, max
        }

        let mut team: Vec<DisplayMember> = Vec::new();

        // 1. Add Local Player
        team.push(DisplayMember {
            name: character_name.to_string(),
            class: character_class.name.clone(),
            hp: game_state.resources.current_hp,
            max_hp: game_state.resources.max_hp,
            is_player: true,
            mana: Some((game_state.resources.mana as f32, game_state.resources.max_mana as f32)),
        });

        // 2. Add Remote Players
        // Sort by ID or something stable so they don't jump around
        let mut sorted_others: Vec<_> = other_players.values().collect();
        sorted_others.sort_by(|a, b| a.username.cmp(&b.username));

        for p in sorted_others {
            team.push(DisplayMember {
                name: p.username.clone(),
                class: p.class.clone(),
                hp: 100.0, // Placeholder: Remote HP not yet synced
                max_hp: 100.0,
                is_player: false,
                mana: None,
            });
        }

        // ============================================================
        // DYNAMIC ENEMY DATA
        // ============================================================
        let mut display_enemies: Vec<&crate::entities::Enemy> = Vec::new();
        if let Some(boss) = start_enemy {
            display_enemies.push(boss);
        }
        for e in enemies {
            display_enemies.push(e);
        }


        // ============================================================
        // TOP: TIMELINE (Turn Order)
        // ============================================================
        let timeline_y = 10.0;
        let center_x = screen_width / 2.0;
        
        // Build dynamic turn order list for checking
        // (Label, Color, IsActive)
        let mut timeline_icons: Vec<(String, Color, bool)> = Vec::new();

        // Add Team
        for member in &team {
            let color = if member.is_player { 
                Color::from_rgba(50, 100, 200, 255) 
            } else { 
                Color::from_rgba(50, 200, 100, 255) 
            };
            
            let is_active = if member.is_player {
                is_my_turn
            } else {
                current_turn_id == member.name
            };

            timeline_icons.push((member.name.clone(), color, is_active));
        }

        // Add Enemies
        for enemy in &display_enemies {
            let is_active = !is_my_turn && (current_turn_id == "enemy" || current_turn_id.is_empty()); 
            // In solo, empty turn_id usually implies enemy turn if !is_my_turn
            
            timeline_icons.push((enemy.name.clone(), Color::from_rgba(200, 50, 50, 255), is_active));
        }

        let icon_size = 30.0;
        let gap = 10.0;
        let total_w = timeline_icons.len() as f32 * (icon_size + gap) - gap;
        let start_x = center_x - total_w / 2.0;

        for (i, (label, color, is_active)) in timeline_icons.iter().enumerate() {
            let x = start_x + i as f32 * (icon_size + gap);
            let y = timeline_y + 5.0;
            
            if *is_active {
                draw_rectangle(x - 2.0, y - 2.0, icon_size + 4.0, icon_size + 4.0, GOLD);
            }

            draw_rectangle(x, y, icon_size, icon_size, *color);
            draw_rectangle_lines(x, y, icon_size, icon_size, 1.0, WHITE);
            let short_label = if label.len() > 0 { &label[0..1] } else { "?" };
            draw_text(short_label, x + 8.0, y + 20.0, 20.0, WHITE);
        }

        // ============================================================
        // TEAM PANEL
        // ============================================================
        let team_panel_w = 180.0;
        // Height dynamic based on member count
        let team_panel_h = 10.0 + (team.len() as f32 * 75.0); 
        
        draw_rectangle(0.0, 0.0, team_panel_w, team_panel_h, Color::from_rgba(15, 20, 30, 240));
        draw_line(team_panel_w, 0.0, team_panel_w, team_panel_h, 2.0, Color::from_rgba(60, 80, 120, 255));
        
        for (i, member) in team.iter().enumerate() {
            let height = 65.0;
            let font_size_name = 14.0;
            let font_size_small = 11.0;
            
            let y = 5.0 + i as f32 * (height + 10.0);

            let bg_color = if member.is_player {
                Color::from_rgba(50, 60, 80, 220)
            } else {
                Color::from_rgba(25, 30, 40, 200)
            };
            draw_rectangle(padding - 5.0, y - 5.0, team_panel_w - padding * 2.0 + 10.0, height, bg_color);
            
            let class_color = if member.is_player { character_class.color() } else { GRAY };
            
            let name_color = if member.is_player { GOLD } else { WHITE };
            let display_name = if member.is_player { 
                format!("{} (You)", member.name) 
            } else { 
                member.name.clone() 
            };
            draw_text(&display_name, padding + 5.0, y + 10.0, font_size_name, name_color);
            draw_text(&member.class, padding + 5.0, y + 10.0 + font_size_name, font_size_small, class_color);
            
            let hp_bar_w = team_panel_w - padding * 2.0 - 10.0;
            let hp_percent = (member.hp / member.max_hp).clamp(0.0, 1.0);
            let hp_bar_y = y + 12.0 + font_size_name + 4.0;
            let hp_bar_h = 10.0;
            
            draw_rectangle(padding + 5.0, hp_bar_y, hp_bar_w, hp_bar_h, Color::from_rgba(40, 15, 15, 255));
            let hp_color = if hp_percent > 0.5 { GREEN } else if hp_percent > 0.25 { YELLOW } else { RED };
            draw_rectangle(padding + 5.0, hp_bar_y, hp_bar_w * hp_percent, hp_bar_h, hp_color);
            
            if let Some((mana, max_mana)) = member.mana {
                let mp_percent = mana / max_mana;
                let mp_bar_y = hp_bar_y + hp_bar_h + 4.0;
                let mp_bar_h = 6.0;

                draw_rectangle(padding + 5.0, mp_bar_y, hp_bar_w, mp_bar_h, Color::from_rgba(10, 10, 40, 255));
                draw_rectangle(padding + 5.0, mp_bar_y, hp_bar_w * mp_percent.clamp(0.0, 1.0), mp_bar_h, Color::from_rgba(50, 100, 250, 255));
            }
        }

        // ============================================================
        // ENEMIES PANEL
        // ============================================================
        let enemy_panel_w = 200.0;
        let enemy_panel_x = screen_width - enemy_panel_w;
        let enemy_panel_h = 10.0 + (display_enemies.len() as f32 * 65.0).max(100.0);
        
        draw_rectangle(enemy_panel_x, 0.0, enemy_panel_w, enemy_panel_h, Color::from_rgba(30, 15, 15, 240));
        
        for (i, enemy) in display_enemies.iter().enumerate() {
            let y = 15.0 + i as f32 * 60.0;
            draw_text(&enemy.name, enemy_panel_x + padding, y + 14.0, 13.0, RED);
            
            let hp_bar_w = enemy_panel_w - padding * 2.0 - 10.0;
            let hp_percent = (enemy.health / enemy.max_health).clamp(0.0, 1.0);
            let hp_bar_y = y + 24.0;
            draw_rectangle(enemy_panel_x + padding, hp_bar_y, hp_bar_w, 14.0, Color::from_rgba(40, 15, 15, 255));
            draw_rectangle(enemy_panel_x + padding, hp_bar_y, hp_bar_w * hp_percent, 14.0, RED);
        }

        // ============================================================
        // BOTTOM MENU
        // ============================================================
        let menu_h = 220.0;
        let menu_y = screen_height - menu_h;
        
        draw_rectangle(0.0, menu_y, screen_width, menu_h, Color::from_rgba(12, 12, 18, 250));
        draw_line(0.0, menu_y, screen_width, menu_y, 3.0, GOLD);

        let status_text = if is_my_turn {
            "YOUR TURN".to_string()
        } else {
            // Try to find the name of the current turn owner
            let mut name = "ENEMY TURN".to_string(); // Default to enemy
            
            // Check other players
            if let Some(p) = other_players.get(current_turn_id) {
                name = format!("{}'S TURN", p.username.to_uppercase());
            } 
            // Check enemies (standard list)
            else if let Some(e) = enemies.iter().find(|e| &e.id == current_turn_id) {
                name = format!("{} TURN", e.name.to_uppercase());
            }
            // Check boss
            else if let Some(boss) = start_enemy {
                if &boss.id == current_turn_id {
                    name = format!("BOSS {} TURNS", boss.name.to_uppercase());
                }
            }
            
            name
        };
        
        let status_color = if is_my_turn { GREEN } else { RED };
        draw_text(&status_text, padding, menu_y + 22.0, 16.0, status_color);

        // Combat Log
        let log_x = padding;
        let log_y = menu_y + 32.0;
        let log_w = 350.0;
        let log_h = 75.0;
        draw_rectangle(log_x, log_y, log_w, log_h, Color::from_rgba(8, 8, 12, 220));
        for (i, log) in combat_logs.iter().rev().take(4).enumerate() {
            draw_text(log, log_x + 8.0, log_y + 16.0 + (i as f32 * 16.0), 12.0, GRAY);
        }

        let mouse = mouse_position();
        let was_click = is_mouse_button_pressed(MouseButton::Left);
        let buttons_start_x = log_x + log_w + 20.0;
        let buttons_start_y = menu_y + 35.0;

        match ui_state {
            BattleUIState::Main => {
                let actions = vec![("SKILLS", "⚔"), ("BAG", "🎒"), ("FLEE", "🏃"), ("STATS", "✨")];
                let btn_w = 160.0;
                let btn_h = 50.0;
                let gap = 12.0;

                for (i, (action, icon)) in actions.iter().enumerate() {
                    let x = buttons_start_x + (i % 2) as f32 * (btn_w + gap);
                    let y = buttons_start_y + (i / 2) as f32 * (btn_h + gap);
                    
                    let is_hovered = is_my_turn && mouse.0 >= x && mouse.0 <= x + btn_w && mouse.1 >= y && mouse.1 <= y + btn_h;
                    let bg_color = if is_hovered { Color::from_rgba(45, 45, 80, 255) } else { Color::from_rgba(30, 30, 45, 255) };

                    draw_rectangle(x, y, btn_w, btn_h, bg_color);
                    draw_rectangle_lines(x, y, btn_w, btn_h, 2.0, if is_hovered { GOLD } else { GRAY });
                    draw_text(icon, x + 12.0, y + 32.0, 20.0, WHITE);
                    draw_text(action, x + 38.0, y + 32.0, 20.0, WHITE);

                    if was_click && is_hovered {
                        match i {
                            0 => *ui_state = BattleUIState::AttackMenu,
                            1 => *ui_state = BattleUIState::BagMenu,
                            2 => { result_action = Some(HUDAction::Flee); },
                            3 => *ui_state = BattleUIState::PassiveInfo,
                            _ => {}
                        }
                    }
                }
            }

            BattleUIState::AttackMenu => {
                draw_text("SKILLS", buttons_start_x, menu_y + 25.0, 16.0, GOLD);
                
                let grid_cols = 4;
                let cell_w = 150.0;
                let cell_h = 45.0;

                for (i, atk) in character_class.skills.iter().enumerate() {
                    let x = buttons_start_x + (i % grid_cols) as f32 * (cell_w + 6.0);
                    let y = menu_y + 40.0 + (i / grid_cols) as f32 * (cell_h + 6.0);

                    let can_afford = game_state.resources.can_afford_mana(atk.mana_cost);
                    let is_hovered = is_my_turn && can_afford && mouse.0 >= x && mouse.0 <= x + cell_w && mouse.1 >= y && mouse.1 <= y + cell_h;
                    
                    let bg_color = if is_hovered { DARKGRAY } else { BLACK };
                    draw_rectangle(x, y, cell_w, cell_h, bg_color);
                    draw_rectangle_lines(x, y, cell_w, cell_h, 1.5, if is_hovered { GOLD } else { GRAY });
                    
                    draw_text(&atk.name, x + 6.0, y + 16.0, 13.0, if can_afford { WHITE } else { GRAY });
                    draw_text(&format!("MP:{} DMG:{}", atk.mana_cost, atk.base_damage), x + 6.0, y + 34.0, 10.0, SKYBLUE);

                    if was_click && is_hovered && is_my_turn {
                        // Go to Targeting
                        *ui_state = BattleUIState::Targeting(i);
                    }
                }

                if draw_back_button(screen_width, menu_y, mouse, was_click) {
                    *ui_state = BattleUIState::Main;
                }
            }

            BattleUIState::Targeting(skill_idx) => {
                 let skill = &character_class.skills[*skill_idx];
                 draw_text(&format!("SELECT TARGET :: {}", skill.name), buttons_start_x, menu_y + 25.0, 16.0, YELLOW);
                 draw_text("Click an Enemy or Player panel", buttons_start_x + 200.0, menu_y + 25.0, 14.0, WHITE);

                 if draw_back_button(screen_width, menu_y, mouse, was_click) {
                    *ui_state = BattleUIState::AttackMenu;
                 } else if was_click {
                      // Check for click on Enemy Panel
                      let enemy_panel_w = 200.0;
                      let enemy_panel_x = screen_width - enemy_panel_w;
                      
                      // Check Boss first (at index 0 of display_enemies if present)
                      // Logic matches draw loop: y = 15.0 + i * 60.0
                      
                      for (i, enemy) in display_enemies.iter().enumerate() {
                          let y = 15.0 + i as f32 * 60.0;
                          let h = 55.0; // aprox height per enemy slot
                          
                          if mouse.0 > enemy_panel_x && mouse.0 < screen_width && mouse.1 > y && mouse.1 < y + h {
                              // Clicked Enemy i
                              result_action = Some(HUDAction::UseAttack(skill.name.clone(), enemy.id.clone()));
                              *ui_state = BattleUIState::Main;
                          }
                      }
                      
                      // Check Self (Click on Team Panel, first member)
                      let team_panel_w = 180.0;
                      if mouse.0 < team_panel_w && mouse.1 < 65.0 + 10.0 { // First member slot
                          result_action = Some(HUDAction::UseAttack(skill.name.clone(), "player".to_string()));
                          *ui_state = BattleUIState::Main;
                      }
                 }
            }

            BattleUIState::BagMenu => {
                if draw_back_button(screen_width, menu_y, mouse, was_click) {
                    *ui_state = BattleUIState::Main;
                }
            }
            
            BattleUIState::Defeat => {
                draw_rectangle(0.0, 0.0, screen_width, screen_height, Color::from_rgba(0, 0, 0, 200));
                draw_text("DEFEAT", screen_width/2.0 - 100.0, screen_height/2.0, 60.0, RED);
                if was_click { result_action = Some(HUDAction::GiveUp); }
            }
            
            BattleUIState::PassiveInfo => {
                draw_text("STATS & PASSIVES", buttons_start_x, menu_y + 25.0, 16.0, GOLD);
                draw_text(&format!("HP: {} | MP: {} | SPD: {}", character_class.hp, character_class.mana, character_class.speed), buttons_start_x, menu_y + 50.0, 14.0, WHITE);
                
                if draw_back_button(screen_width, menu_y, mouse, was_click) {
                    *ui_state = BattleUIState::Main;
                }
            }
        }
        result_action
    }
}

fn draw_back_button(screen_width: f32, menu_y: f32, mouse: (f32, f32), clicked: bool) -> bool {
    let btn_w = 80.0;
    let btn_h = 30.0;
    let x = screen_width - btn_w - 12.0;
    let y = menu_y + 10.0;

    let is_hovered = mouse.0 >= x && mouse.0 <= x + btn_w && mouse.1 >= y && mouse.1 <= y + btn_h;
    let bg = if is_hovered { GRAY } else { DARKGRAY };

    draw_rectangle(x, y, btn_w, btn_h, bg);
    draw_text("BACK", x + 20.0, y + 20.0, 14.0, WHITE);
    clicked && is_hovered
}
