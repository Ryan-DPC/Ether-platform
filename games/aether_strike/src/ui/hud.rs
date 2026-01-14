use macroquad::prelude::*;
use crate::game::GameState;

#[derive(Debug, Clone, PartialEq)]
pub enum BattleUIState {
    Main,
    AttackMenu,
    BagMenu,
    PassiveInfo,
}

#[derive(Debug, Clone)]
pub enum HUDAction {
    UseAttack(String),
    Flee,
    EndTurn,
}

// Mock team member for UI prototyping
#[derive(Debug, Clone)]
pub struct MockTeamMember {
    pub name: String,
    pub class: String,
    pub hp: f32,
    pub max_hp: f32,
    pub is_player: bool,
}

// Mock enemy for UI prototyping
#[derive(Debug, Clone)]
pub struct MockEnemy {
    pub name: String,
    pub hp: f32,
    pub max_hp: f32,
    pub is_boss: bool,
}

pub struct HUD;

impl HUD {
    pub fn draw(
        game_state: &GameState, 
        screen_width: f32, 
        screen_height: f32, 
        character_name: &str, 
        player_class_enum: crate::class_system::PlayerClass,
        other_players: &std::collections::HashMap<String, crate::network_client::RemotePlayer>,
        enemy_hp_percent: f32,
        is_my_turn: bool,
        ui_state: &mut BattleUIState,
        combat_logs: &[String],
    ) -> Option<HUDAction> {
        let mut result_action = None;
        let padding = 12.0;
        
        // ============================================================
        // MOCK DATA FOR TEAM UI PROTOTYPE
        // ============================================================
        let mock_team: Vec<MockTeamMember> = vec![
            MockTeamMember {
                name: character_name.to_string(),
                class: player_class_enum.name().to_string(),
                hp: game_state.resources.current_hp,
                max_hp: game_state.resources.max_hp,
                is_player: true,
            },
            MockTeamMember {
                name: "DarkKnight".to_string(),
                class: "Warrior".to_string(),
                hp: 120.0,
                max_hp: 150.0,
                is_player: false,
            },
            MockTeamMember {
                name: "Elara".to_string(),
                class: "Mage".to_string(),
                hp: 45.0,
                max_hp: 80.0,
                is_player: false,
            },
            MockTeamMember {
                name: "SwiftArrow".to_string(),
                class: "Archer".to_string(),
                hp: 85.0,
                max_hp: 100.0,
                is_player: false,
            },
        ];

        let mock_enemies: Vec<MockEnemy> = vec![
            MockEnemy {
                name: "Aether Guardian".to_string(),
                hp: enemy_hp_percent * 500.0,
                max_hp: 500.0,
                is_boss: true,
            },
            MockEnemy {
                name: "Shadow Minion".to_string(),
                hp: 80.0,
                max_hp: 100.0,
                is_boss: false,
            },
            MockEnemy {
                name: "Dark Spirit".to_string(),
                hp: 60.0,
                max_hp: 80.0,
                is_boss: false,
            },
            MockEnemy {
                name: "Void Crawler".to_string(),
                hp: 40.0,
                max_hp: 120.0,
                is_boss: false,
            },
        ];

        // ============================================================
        // LEFT SIDE: TEAM PANEL
        // ============================================================
        let team_panel_w = 220.0;
        let team_panel_h = 30.0 + mock_team.len() as f32 * 55.0;
        
        draw_rectangle(0.0, 0.0, team_panel_w, team_panel_h, Color::from_rgba(15, 20, 30, 240));
        draw_line(team_panel_w, 0.0, team_panel_w, team_panel_h, 2.0, Color::from_rgba(60, 80, 120, 255));
        draw_line(0.0, team_panel_h, team_panel_w, team_panel_h, 2.0, Color::from_rgba(60, 80, 120, 255));
        
        draw_text("TEAM", padding, 20.0, 16.0, Color::from_rgba(100, 150, 255, 255));
        
        for (i, member) in mock_team.iter().enumerate() {
            // Player is bigger
            let (height, font_size_name, font_size_small) = if member.is_player {
                (80.0, 16.0, 12.0)
            } else {
                (50.0, 12.0, 10.0)
            };
            
            let y_offset_base = if i == 0 { 35.0 } else { 35.0 + 85.0 + (i as f32 - 1.0) * 55.0 }; // Offset for first item (bigger)
            let y = y_offset_base;

            // Background for each member
            let bg_color = if member.is_player {
                Color::from_rgba(50, 60, 80, 220)
            } else {
                Color::from_rgba(25, 30, 40, 200)
            };
            draw_rectangle(padding - 5.0, y - 5.0, team_panel_w - padding * 2.0 + 10.0, height, bg_color);
            
            // Class color indicator
            let class_color = match member.class.to_lowercase().as_str() {
                "warrior" => Color::from_rgba(200, 60, 60, 255),
                "mage" => Color::from_rgba(60, 100, 200, 255),
                "archer" => Color::from_rgba(60, 200, 100, 255),
                _ => GRAY,
            };
            draw_rectangle(padding - 5.0, y - 5.0, 4.0, height, class_color);
            
            // Name
            let name_color = if member.is_player { GOLD } else { WHITE };
            let display_name = if member.is_player { 
                format!("{} (You)", member.name) 
            } else { 
                member.name.clone() 
            };
            draw_text(&display_name, padding + 5.0, y + 14.0, font_size_name, name_color);
            
            // Class text
            draw_text(&member.class, padding + 5.0, y + 14.0 + font_size_name, font_size_small, class_color);
            
            // HP Bar
            let hp_bar_w = team_panel_w - padding * 2.0 - 10.0;
            let hp_percent = (member.hp / member.max_hp).clamp(0.0, 1.0);
            let hp_bar_y = y + 18.0 + font_size_name + 4.0;
            let hp_bar_h = if member.is_player { 12.0 } else { 8.0 };
            
            draw_rectangle(padding + 5.0, hp_bar_y, hp_bar_w, hp_bar_h, Color::from_rgba(40, 15, 15, 255));
            
            let hp_color = if hp_percent > 0.5 {
                Color::from_rgba(80, 180, 80, 255)
            } else if hp_percent > 0.25 {
                Color::from_rgba(200, 180, 60, 255)
            } else {
                Color::from_rgba(200, 60, 60, 255)
            };
            draw_rectangle(padding + 5.0, hp_bar_y, hp_bar_w * hp_percent, hp_bar_h, hp_color);
            draw_rectangle_lines(padding + 5.0, hp_bar_y, hp_bar_w, hp_bar_h, 1.0, Color::from_rgba(60, 60, 60, 255));
            
            // HP text (only for player or on mouse hover? Let's keep for player)
            if member.is_player {
                let hp_text = format!("{:.0}/{:.0}", member.hp, member.max_hp);
                let hp_dims = measure_text(&hp_text, None, 10, 1.0);
                draw_text(&hp_text, padding + 5.0 + (hp_bar_w - hp_dims.width) / 2.0, hp_bar_y + 10.0, 10.0, WHITE);
            }

            // Mana Bar (Only for Player)
            if member.is_player {
                let mp_percent = game_state.resources.mana as f32 / game_state.resources.max_mana as f32;
                let mp_bar_y = hp_bar_y + hp_bar_h + 4.0;
                let mp_bar_h = 8.0;

                draw_rectangle(padding + 5.0, mp_bar_y, hp_bar_w, mp_bar_h, Color::from_rgba(10, 10, 40, 255));
                draw_rectangle(padding + 5.0, mp_bar_y, hp_bar_w * mp_percent.clamp(0.0, 1.0), mp_bar_h, Color::from_rgba(50, 100, 250, 255)); // Blue
                draw_rectangle_lines(padding + 5.0, mp_bar_y, hp_bar_w, mp_bar_h, 1.0, Color::from_rgba(60, 60, 100, 255));
                
                let mp_text = format!("{}/{}", game_state.resources.mana, game_state.resources.max_mana);
                let mp_dims = measure_text(&mp_text, None, 8, 1.0);
                draw_text(&mp_text, padding + 5.0 + (hp_bar_w - mp_dims.width) / 2.0, mp_bar_y + 7.0, 8.0, WHITE);
            }
        }

        // ============================================================
        // RIGHT SIDE: ENEMIES PANEL
        // ============================================================
        let enemy_panel_w = 240.0;
        let enemy_panel_h = 30.0 + mock_enemies.len() as f32 * 50.0;
        let enemy_panel_x = screen_width - enemy_panel_w;
        
        draw_rectangle(enemy_panel_x, 0.0, enemy_panel_w, enemy_panel_h, Color::from_rgba(30, 15, 15, 240));
        draw_line(enemy_panel_x, 0.0, enemy_panel_x, enemy_panel_h, 2.0, Color::from_rgba(120, 60, 60, 255));
        draw_line(enemy_panel_x, enemy_panel_h, screen_width, enemy_panel_h, 2.0, Color::from_rgba(120, 60, 60, 255));
        
        // Wave and Gold in top right corner (Removed from top, moved down)
        
        draw_text("ENEMIES", enemy_panel_x + padding, 20.0, 16.0, Color::from_rgba(255, 100, 100, 255));
        
        for (i, enemy) in mock_enemies.iter().enumerate() {
            // Boss is bigger
            let (height, font_size) = if enemy.is_boss { (60.0, 14.0) } else { (40.0, 12.0) };
            
            let y_offset_base = if i == 0 { 35.0 } else { 35.0 + 65.0 + (i as f32 - 1.0) * 45.0 };
            let y = y_offset_base;
            
            // Background
            let bg_color = if enemy.is_boss {
                Color::from_rgba(60, 20, 20, 220)
            } else {
                Color::from_rgba(35, 20, 20, 200)
            };
            draw_rectangle(enemy_panel_x + padding - 5.0, y - 3.0, enemy_panel_w - padding * 2.0 + 10.0, height, bg_color);
            
            // Boss indicator
            if enemy.is_boss {
                draw_text("★", enemy_panel_x + padding - 2.0, y + 14.0, 16.0, GOLD);
            }
            
            // Name
            let name_x = if enemy.is_boss { enemy_panel_x + padding + 15.0 } else { enemy_panel_x + padding };
            let name_color = if enemy.is_boss { Color::from_rgba(255, 150, 100, 255) } else { WHITE };
            draw_text(&enemy.name, name_x, y + 14.0, font_size, name_color);
            
            // HP Bar
            let hp_bar_w = enemy_panel_w - padding * 2.0 - 10.0;
            let hp_percent = (enemy.hp / enemy.max_hp).clamp(0.0, 1.0);
            let hp_bar_y = y + 18.0 + (if enemy.is_boss { 10.0 } else { 4.0 });
            let hp_bar_h = if enemy.is_boss { 14.0 } else { 8.0 };
            
            draw_rectangle(enemy_panel_x + padding, hp_bar_y, hp_bar_w, hp_bar_h, Color::from_rgba(40, 15, 15, 255));
            
            let hp_color = if enemy.is_boss {
                Color::from_rgba(180, 50, 50, 255)
            } else {
                Color::from_rgba(150, 60, 60, 255)
            };
            draw_rectangle(enemy_panel_x + padding, hp_bar_y, hp_bar_w * hp_percent, hp_bar_h, hp_color);
            draw_rectangle_lines(enemy_panel_x + padding, hp_bar_y, hp_bar_w, hp_bar_h, 1.0, Color::from_rgba(80, 40, 40, 255));
            
            // HP percentage (only for Boss)
            if enemy.is_boss {
                let hp_pct_text = format!("{:.0}%", hp_percent * 100.0);
                let hp_dims = measure_text(&hp_pct_text, None, 10, 1.0);
                draw_text(&hp_pct_text, enemy_panel_x + padding + (hp_bar_w - hp_dims.width) / 2.0, hp_bar_y + 11.0, 10.0, WHITE);
            }
        }

        // WAVE AND GOLD INFO (Incrusted at bottom of enemy panel)
        let info_y = enemy_panel_h + 10.0;
        draw_rectangle(enemy_panel_x, info_y, enemy_panel_w, 40.0, Color::from_rgba(20, 20, 30, 220));
        draw_line(enemy_panel_x, info_y, enemy_panel_x, info_y + 40.0, 2.0, Color::from_rgba(80, 80, 100, 255)); // Left border
        draw_line(enemy_panel_x, info_y + 40.0, screen_width, info_y + 40.0, 2.0, Color::from_rgba(80, 80, 100, 255)); // Bottom border
        
        let wave_text = format!("WAVE {}", game_state.current_wave);
        draw_text(&wave_text, enemy_panel_x + 20.0, info_y + 26.0, 18.0, WHITE);
        
        let gold_text = format!("{} G", game_state.resources.gold);
        let gold_dims = measure_text(&gold_text, None, 18, 1.0);
        draw_text(&gold_text, screen_width - gold_dims.width - 20.0, info_y + 26.0, 18.0, GOLD);

        // ============================================================
        // BOTTOM: BATTLE MENU WITH INTEGRATED COMBAT LOG
        // ============================================================
        let menu_h = 220.0;
        let menu_y = screen_height - menu_h;
        
        // Background
        draw_rectangle(0.0, menu_y, screen_width, menu_h, Color::from_rgba(12, 12, 18, 250));
        draw_line(0.0, menu_y, screen_width, menu_y, 3.0, GOLD);

        // Turn status
        let status_text = if is_my_turn { "YOUR TURN - Choose an action!" } else { "ENEMY TURN..." };
        let status_color = if is_my_turn { Color::from_rgba(100, 220, 100, 255) } else { Color::from_rgba(220, 100, 100, 255) };
        draw_text(status_text, padding, menu_y + 22.0, 16.0, status_color);

        // === COMBAT LOG (Below turn status) ===
        let log_x = padding;
        let log_y = menu_y + 32.0;
        let log_w = 350.0;
        let log_h = 75.0;
        
        draw_rectangle(log_x, log_y, log_w, log_h, Color::from_rgba(8, 8, 12, 220));
        draw_rectangle_lines(log_x, log_y, log_w, log_h, 1.0, Color::from_rgba(50, 50, 70, 255));
        
        // Combat log entries
        for (i, log) in combat_logs.iter().rev().take(4).enumerate() {
            let text_y = log_y + 16.0 + (i as f32 * 16.0);
            let alpha = 255 - (i as u8 * 40);
            draw_text(log, log_x + 8.0, text_y, 12.0, Color::from_rgba(200, 200, 200, alpha));
        }

        // Disable overlay if not player turn
        if !is_my_turn {
            draw_rectangle(log_w + padding * 2.0, menu_y + 30.0, screen_width - log_w - padding * 3.0, menu_h - 35.0, Color::from_rgba(0, 0, 0, 120));
        }

        // Mouse logic
        let mouse = mouse_position();
        let was_click = is_mouse_button_pressed(MouseButton::Left);

        // Action buttons positioned to the right of combat log
        let buttons_start_x = log_x + log_w + 20.0;
        let buttons_start_y = menu_y + 35.0;

        match ui_state {
            BattleUIState::Main => {
                let actions = vec![("ATTAQUE", "⚔"), ("SAC", "🎒"), ("FUITE", "🏃"), ("PASSIF", "✨")];
                let btn_w = 160.0;
                let btn_h = 50.0;
                let gap = 12.0;

                for (i, (action, icon)) in actions.iter().enumerate() {
                    let col = i % 2;
                    let row = i / 2;
                    let x = buttons_start_x + col as f32 * (btn_w + gap);
                    let y = buttons_start_y + row as f32 * (btn_h + gap);
                    
                    let is_hovered = is_my_turn && mouse.0 >= x && mouse.0 <= x + btn_w && mouse.1 >= y && mouse.1 <= y + btn_h;
                    
                    let (bg_color, border_color) = if !is_my_turn {
                        (Color::from_rgba(25, 25, 30, 255), Color::from_rgba(40, 40, 50, 255))
                    } else if is_hovered {
                        if *action == "FUITE" {
                            (Color::from_rgba(80, 30, 30, 255), Color::from_rgba(200, 80, 80, 255))
                        } else {
                            (Color::from_rgba(45, 45, 80, 255), Color::from_rgba(100, 100, 160, 255))
                        }
                    } else {
                        (Color::from_rgba(30, 30, 45, 255), Color::from_rgba(70, 70, 90, 255))
                    };
                    
                    let text_color = if *action == "FUITE" { 
                        if is_my_turn { Color::from_rgba(255, 100, 100, 255) } else { Color::from_rgba(80, 40, 40, 255) }
                    } else if !is_my_turn { 
                        Color::from_rgba(60, 60, 60, 255) 
                    } else { 
                        WHITE 
                    };

                    draw_rectangle(x, y, btn_w, btn_h, bg_color);
                    draw_rectangle_lines(x, y, btn_w, btn_h, 2.0, border_color);
                    
                    draw_text(icon, x + 12.0, y + 32.0, 20.0, text_color);
                    let text_dims = measure_text(action, None, 20, 1.0);
                    draw_text(action, x + 38.0 + (btn_w - 50.0 - text_dims.width) / 2.0, y + 32.0, 20.0, text_color);

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
                
                let attacks = player_class_enum.get_attacks();
                let grid_cols = 4;
                let cell_w = 150.0;
                let cell_h = 45.0;
                let grid_start_x = buttons_start_x;
                let grid_start_y = menu_y + 40.0;

                for (i, atk) in attacks.iter().enumerate() {
                    let col = i % grid_cols;
                    let row = i / grid_cols;
                    let x = grid_start_x + col as f32 * (cell_w + 6.0);
                    let y = grid_start_y + row as f32 * (cell_h + 6.0);

                    if y > screen_height - 20.0 { continue; }

                    let can_afford = game_state.resources.can_afford_mana(atk.mana_cost);
                    let is_hovered = is_my_turn && can_afford && mouse.0 >= x && mouse.0 <= x + cell_w && mouse.1 >= y && mouse.1 <= y + cell_h;
                    
                    let bg_color = if !can_afford {
                        Color::from_rgba(35, 15, 15, 200)
                    } else if is_hovered {
                        Color::from_rgba(60, 45, 45, 255)
                    } else {
                        Color::from_rgba(40, 30, 30, 255)
                    };
                    
                    let border_color = if is_hovered { GOLD } else if can_afford { Color::from_rgba(70, 50, 50, 255) } else { Color::from_rgba(50, 25, 25, 255) };
                    let text_color = if can_afford { WHITE } else { Color::from_rgba(80, 80, 80, 255) };
                    let mp_color = if can_afford { SKYBLUE } else { Color::from_rgba(120, 60, 60, 255) };

                    draw_rectangle(x, y, cell_w, cell_h, bg_color);
                    draw_rectangle_lines(x, y, cell_w, cell_h, 1.5, border_color);
                    
                    draw_text(&atk.name, x + 6.0, y + 16.0, 13.0, text_color);
                    draw_text(&format!("MP:{} DMG:{}", atk.mana_cost, atk.damage), x + 6.0, y + 34.0, 10.0, mp_color);

                    if was_click && is_hovered && is_my_turn {
                        result_action = Some(HUDAction::UseAttack(atk.name.clone()));
                    }
                }

                if draw_back_button(screen_width, menu_y, mouse, was_click) {
                    *ui_state = BattleUIState::Main;
                }
            }

            BattleUIState::BagMenu => {
                draw_text("INVENTORY", buttons_start_x, menu_y + 25.0, 16.0, GOLD);
                let items = vec![("Potion", "+50 HP", 3), ("Ether", "+20 MP", 2), ("Elixir", "Full", 1)];
                
                for (i, (name, desc, count)) in items.iter().enumerate() {
                    let y = menu_y + 50.0 + i as f32 * 28.0;
                    draw_text(&format!("• {} (x{}) - {}", name, count, desc), buttons_start_x, y, 15.0, WHITE);
                }

                if draw_back_button(screen_width, menu_y, mouse, was_click) {
                    *ui_state = BattleUIState::Main;
                }
            }
            
            BattleUIState::PassiveInfo => {
                draw_text("PASSIVES", buttons_start_x, menu_y + 25.0, 16.0, GOLD);
                let passives = crate::class_system::Passive::get_for_class(player_class_enum);
                
                for (i, p) in passives.iter().enumerate() {
                    let y = menu_y + 50.0 + i as f32 * 30.0;
                    draw_text(&format!("★ {}: {}", p.name, p.description), buttons_start_x, y, 13.0, Color::from_rgba(255, 200, 100, 255));
                }

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
    let bg = if is_hovered { Color::from_rgba(60, 60, 70, 255) } else { Color::from_rgba(40, 40, 50, 255) };

    draw_rectangle(x, y, btn_w, btn_h, bg);
    draw_rectangle_lines(x, y, btn_w, btn_h, 1.0, Color::from_rgba(80, 80, 100, 255));
    
    let text = "← BACK";
    let dims = measure_text(text, None, 14, 1.0);
    draw_text(text, x + (btn_w - dims.width) / 2.0, y + 20.0, 14.0, WHITE);

    clicked && is_hovered
}
