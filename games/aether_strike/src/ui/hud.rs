use macroquad::prelude::*;
use crate::game::GameState;

#[derive(Debug, Clone, PartialEq)]
pub enum BattleUIState {
    Main,
    AttackMenu, // Grid of 10 attacks
    BagMenu,    // Items list
    PassiveInfo,// Passive description
}

#[derive(Debug, Clone)]
pub enum HUDAction {
    UseAttack(String),
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
        player_class_enum: crate::class_system::PlayerClass,
        other_players: &std::collections::HashMap<String, crate::network_client::RemotePlayer>,
        enemy_hp_percent: f32,
        is_my_turn: bool,
        ui_state: &mut BattleUIState
    ) -> Option<HUDAction> {
        let mut result_action = None;
        let padding = 15.0;
        
        // ============================================================
        // TOP LEFT: PLAYER STATS
        // ============================================================
        let player_panel_w = 280.0;
        let player_panel_h = 100.0;
        
        // Background
        draw_rectangle(0.0, 0.0, player_panel_w, player_panel_h, Color::from_rgba(15, 15, 25, 230));
        draw_line(0.0, player_panel_h, player_panel_w, player_panel_h, 2.0, Color::from_rgba(80, 80, 120, 255));
        draw_line(player_panel_w, 0.0, player_panel_w, player_panel_h, 2.0, Color::from_rgba(80, 80, 120, 255));

        // Avatar Frame
        let avatar_size = 50.0;
        draw_rectangle(padding, padding, avatar_size, avatar_size, Color::from_rgba(40, 40, 60, 255));
        draw_rectangle_lines(padding, padding, avatar_size, avatar_size, 2.0, Color::from_rgba(100, 100, 140, 255));
        let initial = character_name.chars().next().unwrap_or('?').to_string();
        draw_text(&initial, padding + 14.0, padding + 36.0, 36.0, WHITE);

        // Name & Class
        let text_x = padding + avatar_size + 12.0;
        draw_text(character_name, text_x, padding + 18.0, 22.0, WHITE);
        draw_text(&format!("Lv.1 {}", player_class_enum.name().to_uppercase()), text_x, padding + 38.0, 14.0, GOLD);

        // Health Bar
        let hp_percent = game_state.resources.current_hp / game_state.resources.max_hp;
        let bar_w = 180.0;
        let bar_x = text_x;
        let bar_y = padding + 48.0;
        
        draw_rectangle(bar_x, bar_y, bar_w, 14.0, Color::from_rgba(40, 10, 10, 255));
        draw_rectangle(bar_x, bar_y, bar_w * hp_percent.clamp(0.0, 1.0), 14.0, Color::from_rgba(200, 50, 50, 255));
        draw_rectangle_lines(bar_x, bar_y, bar_w, 14.0, 1.0, Color::from_rgba(80, 80, 80, 255));
        
        let hp_text = format!("{:.0}/{:.0}", game_state.resources.current_hp, game_state.resources.max_hp);
        let hp_dims = measure_text(&hp_text, None, 11, 1.0);
        draw_text(&hp_text, bar_x + (bar_w - hp_dims.width) / 2.0, bar_y + 11.0, 11.0, WHITE);

        // Mana Bar
        let mp_percent = game_state.resources.mana as f32 / game_state.resources.max_mana as f32;
        let mp_bar_y = bar_y + 18.0;

        draw_rectangle(bar_x, mp_bar_y, bar_w, 10.0, Color::from_rgba(10, 10, 40, 255));
        draw_rectangle(bar_x, mp_bar_y, bar_w * mp_percent.clamp(0.0, 1.0), 10.0, Color::from_rgba(50, 80, 180, 255));
        draw_rectangle_lines(bar_x, mp_bar_y, bar_w, 10.0, 1.0, Color::from_rgba(60, 60, 80, 255));

        let mp_text = format!("{}/{}", game_state.resources.mana, game_state.resources.max_mana);
        let mp_dims = measure_text(&mp_text, None, 9, 1.0);
        draw_text(&mp_text, bar_x + (bar_w - mp_dims.width) / 2.0, mp_bar_y + 8.0, 9.0, WHITE);

        // ============================================================
        // TOP RIGHT: ENEMY STATS
        // ============================================================
        let enemy_panel_w = 320.0;
        let enemy_panel_h = 80.0;
        let enemy_panel_x = screen_width - enemy_panel_w;
        
        // Background
        draw_rectangle(enemy_panel_x, 0.0, enemy_panel_w, enemy_panel_h, Color::from_rgba(25, 15, 15, 230));
        draw_line(enemy_panel_x, enemy_panel_h, screen_width, enemy_panel_h, 2.0, Color::from_rgba(120, 60, 60, 255));
        draw_line(enemy_panel_x, 0.0, enemy_panel_x, enemy_panel_h, 2.0, Color::from_rgba(120, 60, 60, 255));
        
        // Boss name
        draw_text("BOSS: AETHER GUARDIAN", enemy_panel_x + padding, padding + 20.0, 20.0, Color::from_rgba(255, 100, 100, 255));
        
        // Wave counter (top right corner)
        let wave_text = format!("WAVE {}", game_state.current_wave);
        let wave_dims = measure_text(&wave_text, None, 16, 1.0);
        draw_text(&wave_text, screen_width - wave_dims.width - padding, padding + 16.0, 16.0, Color::from_rgba(180, 180, 180, 255));
        
        // Gold
        let gold_text = format!("{} G", game_state.resources.gold);
        let gold_dims = measure_text(&gold_text, None, 14, 1.0);
        draw_text(&gold_text, screen_width - gold_dims.width - padding, padding + 32.0, 14.0, GOLD);
        
        // Enemy HP bar
        let enemy_bar_x = enemy_panel_x + padding;
        let enemy_bar_y = padding + 40.0;
        let enemy_bar_w = enemy_panel_w - padding * 2.0;
        
        draw_text("HP", enemy_bar_x - 2.0, enemy_bar_y - 4.0, 12.0, Color::from_rgba(180, 180, 180, 255));
        draw_rectangle(enemy_bar_x, enemy_bar_y, enemy_bar_w, 18.0, Color::from_rgba(40, 10, 10, 255));
        draw_rectangle(enemy_bar_x, enemy_bar_y, enemy_bar_w * enemy_hp_percent.clamp(0.0, 1.0), 18.0, Color::from_rgba(180, 40, 40, 255));
        draw_rectangle_lines(enemy_bar_x, enemy_bar_y, enemy_bar_w, 18.0, 2.0, Color::from_rgba(100, 50, 50, 255));
        
        // HP percentage text
        let hp_pct_text = format!("{:.0}%", enemy_hp_percent * 100.0);
        let hp_pct_dims = measure_text(&hp_pct_text, None, 12, 1.0);
        draw_text(&hp_pct_text, enemy_bar_x + (enemy_bar_w - hp_pct_dims.width) / 2.0, enemy_bar_y + 14.0, 12.0, WHITE);

        // ============================================================
        // TOP CENTER: TURN INDICATOR (only if multiplayer)
        // ============================================================
        if !other_players.is_empty() {
            let indicator_w = 200.0;
            let indicator_x = (screen_width - indicator_w) / 2.0;
            let indicator_y = 10.0;
            
            draw_rectangle(indicator_x, indicator_y, indicator_w, 30.0, Color::from_rgba(0, 0, 0, 180));
            
            let turn_text = if is_my_turn { "YOUR TURN" } else { "WAITING..." };
            let turn_color = if is_my_turn { GREEN } else { GRAY };
            let turn_dims = measure_text(turn_text, None, 20, 1.0);
            draw_text(turn_text, indicator_x + (indicator_w - turn_dims.width) / 2.0, indicator_y + 22.0, 20.0, turn_color);
        }

        // ============================================================
        // BOTTOM: BATTLE MENU
        // ============================================================
        let menu_h = 180.0;
        let menu_y = screen_height - menu_h;
        
        // Background
        draw_rectangle(0.0, menu_y, screen_width, menu_h, Color::from_rgba(15, 15, 20, 245));
        draw_line(0.0, menu_y, screen_width, menu_y, 3.0, GOLD);

        // Turn status text (for solo)
        if other_players.is_empty() {
            let status_text = if is_my_turn { "YOUR TURN - Choose an action!" } else { "ENEMY TURN..." };
            let status_color = if is_my_turn { Color::from_rgba(100, 200, 100, 255) } else { Color::from_rgba(200, 100, 100, 255) };
            draw_text(status_text, padding, menu_y + 25.0, 18.0, status_color);
        }

        // Disable overlay if not player turn
        if !is_my_turn {
            draw_rectangle(0.0, menu_y + 35.0, screen_width, menu_h - 35.0, Color::from_rgba(0, 0, 0, 120));
        }

        // Mouse logic
        let mouse = mouse_position();
        let was_click = is_mouse_button_pressed(MouseButton::Left);

        match ui_state {
            BattleUIState::Main => {
                let actions = vec![("ATTAQUE", "⚔"), ("SAC", "🎒"), ("FUITE", "🏃"), ("PASSIF", "✨")];
                let btn_w = 180.0;
                let btn_h = 55.0;
                let gap = 15.0;
                
                let start_x = (screen_width - (2.0 * btn_w + gap)) / 2.0;
                let start_y = menu_y + 45.0;

                for (i, (action, icon)) in actions.iter().enumerate() {
                    let col = i % 2;
                    let row = i / 2;
                    let x = start_x + col as f32 * (btn_w + gap);
                    let y = start_y + row as f32 * (btn_h + gap);
                    
                    let is_hovered = is_my_turn && mouse.0 >= x && mouse.0 <= x + btn_w && mouse.1 >= y && mouse.1 <= y + btn_h;
                    
                    let (bg_color, border_color) = if !is_my_turn {
                        (Color::from_rgba(30, 30, 35, 255), Color::from_rgba(50, 50, 60, 255))
                    } else if is_hovered {
                        if *action == "FUITE" {
                            (Color::from_rgba(80, 30, 30, 255), Color::from_rgba(200, 80, 80, 255))
                        } else {
                            (Color::from_rgba(50, 50, 90, 255), Color::from_rgba(120, 120, 180, 255))
                        }
                    } else {
                        (Color::from_rgba(35, 35, 50, 255), Color::from_rgba(80, 80, 100, 255))
                    };
                    
                    let text_color = if *action == "FUITE" { 
                        if is_my_turn { Color::from_rgba(255, 100, 100, 255) } else { Color::from_rgba(100, 50, 50, 255) }
                    } else if !is_my_turn { 
                        Color::from_rgba(80, 80, 80, 255) 
                    } else { 
                        WHITE 
                    };

                    draw_rectangle(x, y, btn_w, btn_h, bg_color);
                    draw_rectangle_lines(x, y, btn_w, btn_h, 2.0, border_color);
                    
                    // Icon
                    draw_text(icon, x + 15.0, y + 35.0, 24.0, text_color);
                    // Text
                    let text_dims = measure_text(action, None, 24, 1.0);
                    draw_text(action, x + 45.0 + (btn_w - 60.0 - text_dims.width) / 2.0, y + 35.0, 24.0, text_color);

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
                draw_text("SKILLS - Select an attack", padding, menu_y + 28.0, 18.0, GOLD);
                
                let attacks = player_class_enum.get_attacks();
                let grid_cols = 5;
                let cell_w = 170.0;
                let cell_h = 50.0;
                let grid_start_x = padding;
                let grid_start_y = menu_y + 45.0;

                for (i, atk) in attacks.iter().enumerate() {
                    let col = i % grid_cols;
                    let row = i / grid_cols;
                    let x = grid_start_x + col as f32 * (cell_w + 8.0);
                    let y = grid_start_y + row as f32 * (cell_h + 8.0);

                    let can_afford = game_state.resources.can_afford_mana(atk.mana_cost);
                    let is_hovered = is_my_turn && can_afford && mouse.0 >= x && mouse.0 <= x + cell_w && mouse.1 >= y && mouse.1 <= y + cell_h;
                    
                    let bg_color = if !can_afford {
                        Color::from_rgba(40, 20, 20, 200)
                    } else if is_hovered {
                        Color::from_rgba(70, 50, 50, 255)
                    } else {
                        Color::from_rgba(45, 35, 35, 255)
                    };
                    
                    let border_color = if is_hovered { GOLD } else if can_afford { Color::from_rgba(80, 60, 60, 255) } else { Color::from_rgba(60, 30, 30, 255) };
                    let text_color = if can_afford { WHITE } else { Color::from_rgba(100, 100, 100, 255) };
                    let mp_color = if can_afford { SKYBLUE } else { Color::from_rgba(150, 80, 80, 255) };

                    draw_rectangle(x, y, cell_w, cell_h, bg_color);
                    draw_rectangle_lines(x, y, cell_w, cell_h, 1.5, border_color);
                    
                    draw_text(&atk.name, x + 8.0, y + 20.0, 16.0, text_color);
                    draw_text(&format!("MP: {}  DMG: {}", atk.mana_cost, atk.damage), x + 8.0, y + 40.0, 12.0, mp_color);

                    if was_click && is_hovered && is_my_turn {
                        result_action = Some(HUDAction::UseAttack(atk.name.clone()));
                    }
                }

                if draw_back_button(screen_width, menu_y, mouse, was_click) {
                    *ui_state = BattleUIState::Main;
                }
            }

            BattleUIState::BagMenu => {
                draw_text("INVENTORY", padding, menu_y + 28.0, 18.0, GOLD);
                let items = vec![("Potion", "+50 HP", 3), ("Ether", "+20 MP", 2), ("Elixir", "Full Restore", 1)];
                
                for (i, (name, desc, count)) in items.iter().enumerate() {
                    let y = menu_y + 55.0 + i as f32 * 35.0;
                    draw_text(&format!("• {} (x{}) - {}", name, count, desc), padding + 20.0, y, 18.0, WHITE);
                }

                if draw_back_button(screen_width, menu_y, mouse, was_click) {
                    *ui_state = BattleUIState::Main;
                }
            }
            
            BattleUIState::PassiveInfo => {
                draw_text("CLASS PASSIVE ABILITIES", padding, menu_y + 28.0, 18.0, GOLD);
                let passives = crate::class_system::Passive::get_for_class(player_class_enum);
                
                for (i, p) in passives.iter().enumerate() {
                    let y = menu_y + 60.0 + i as f32 * 35.0;
                    draw_text(&format!("★ {}", p.name), padding + 20.0, y, 18.0, Color::from_rgba(255, 200, 100, 255));
                    draw_text(&p.description, padding + 40.0, y + 20.0, 14.0, LIGHTGRAY);
                }

                if draw_back_button(screen_width, menu_y, mouse, was_click) {
                    *ui_state = BattleUIState::Main;
                }
            }
        }
        result_action
    }
}

// Helper for BACK button
fn draw_back_button(screen_width: f32, menu_y: f32, mouse: (f32, f32), clicked: bool) -> bool {
    let btn_w = 90.0;
    let btn_h = 35.0;
    let x = screen_width - btn_w - 15.0;
    let y = menu_y + 15.0;

    let is_hovered = mouse.0 >= x && mouse.0 <= x + btn_w && mouse.1 >= y && mouse.1 <= y + btn_h;
    let bg = if is_hovered { Color::from_rgba(70, 70, 80, 255) } else { Color::from_rgba(50, 50, 60, 255) };

    draw_rectangle(x, y, btn_w, btn_h, bg);
    draw_rectangle_lines(x, y, btn_w, btn_h, 1.0, Color::from_rgba(100, 100, 120, 255));
    
    let text = "← BACK";
    let dims = measure_text(text, None, 16, 1.0);
    draw_text(text, x + (btn_w - dims.width) / 2.0, y + 23.0, 16.0, WHITE);

    clicked && is_hovered
}
