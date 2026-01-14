use macroquad::prelude::*;
use crate::game::GameState;

#[derive(Debug, Clone, PartialEq)]
pub enum BattleUIState {
    Main,
    AttackMenu, // Grid of 10 attacks
    BagMenu,    // Items list
    PassiveInfo,// Passive description
}

pub struct HUD;

impl HUD {
    pub fn draw(
        game_state: &GameState, 
        screen_width: f32, 
        screen_height: f32, 
        character_name: &str, 
        player_class: &str,
        player_class_enum: crate::class_system::PlayerClass,
        ui_state: &mut BattleUIState
    ) {
        // --- CONSTANTS ---
        let padding = 20.0;
        
        // ... (Top UI remains same)
        let top_ui_h = 90.0;
        
        // Background gradient-ish fan 
        draw_rectangle(0.0, 0.0, 400.0, top_ui_h, Color::from_rgba(0, 0, 0, 160));
        draw_rectangle(0.0, top_ui_h, 380.0, 5.0, Color::from_rgba(0, 0, 0, 100)); // fade edge

        // Avatar Frame
        let avatar_size = 60.0;
        draw_rectangle(padding, padding, avatar_size, avatar_size, DARKGRAY);
        draw_rectangle_lines(padding, padding, avatar_size, avatar_size, 2.0, LIGHTGRAY);
        let initial = character_name.chars().next().unwrap_or('?').to_string();
        draw_text(&initial, padding + 18.0, padding + 42.0, 40.0, WHITE);

        // Name & Class
        let text_x = padding + avatar_size + 15.0;
        draw_text(character_name, text_x, padding + 22.0, 24.0, WHITE);
        draw_text(&format!("Lv.1 {}", player_class.to_uppercase()), text_x, padding + 45.0, 16.0, GOLD);

        // Health Bar
        let hp_percent = game_state.resources.current_hp / game_state.resources.max_hp;
        let bar_x = text_x;
        let bar_y = padding + 55.0;
        
        draw_rectangle(bar_x, bar_y, 200.0, 12.0, Color::from_rgba(50, 0, 0, 255));
        draw_rectangle(bar_x, bar_y, 200.0 * hp_percent.clamp(0.0, 1.0), 12.0, RED);
        draw_rectangle_lines(bar_x, bar_y, 200.0, 12.0, 1.0, BLACK);
        
        let hp_text = format!("{:.0}/{:.0}", game_state.resources.current_hp, game_state.resources.max_hp);
        draw_text(&hp_text, bar_x + 80.0, bar_y + 10.0, 10.0, WHITE);

        // --- TOP RIGHT: GAME STATS ---
        let stats_w = 250.0;
        let stats_x = screen_width - stats_w;
        draw_rectangle(stats_x, 0.0, stats_w, 60.0, Color::from_rgba(0, 0, 0, 160));
        draw_text(&format!("WAVE {}", game_state.current_wave), stats_x + 20.0, 35.0, 30.0, WHITE);
        let gold_text = format!("{} G", game_state.resources.gold);
        draw_text(&gold_text, screen_width - 100.0, 35.0, 24.0, GOLD);

        // ============================================================
        //              BATTLE MENU SYSTEM
        // ============================================================
        let menu_h = 200.0;
        let menu_y = screen_height - menu_h;
        
        // Background for entire bottom area
        draw_rectangle(0.0, menu_y, screen_width, menu_h, Color::from_rgba(20, 20, 25, 240));
        draw_line(0.0, menu_y, screen_width, menu_y, 2.0, GOLD);

        // Mouse logic
        let mouse = mouse_position();
        let was_click = is_mouse_button_pressed(MouseButton::Left);

        match ui_state {
            BattleUIState::Main => {
                // Main Actions: ATTAQUE, SAC, FUITE, PASSIF
                let actions = vec!["ATTAQUE", "SAC", "FUITE", "PASSIF"];
                let btn_w = 200.0;
                let btn_h = 60.0;
                let gap = 20.0;
                
                let start_x = (screen_width - (2.0 * btn_w + gap)) / 2.0;
                let start_y = menu_y + 40.0;

                for (i, action) in actions.iter().enumerate() {
                    // Grid layout 2x2
                    let col = i % 2;
                    let row = i / 2;
                    let x = start_x + col as f32 * (btn_w + gap);
                    let y = start_y + row as f32 * (btn_h + gap);
                    
                    let is_hovered = mouse.0 >= x && mouse.0 <= x + btn_w && mouse.1 >= y && mouse.1 <= y + btn_h;
                    let color = if is_hovered { Color::from_rgba(80, 80, 150, 255) } else { Color::from_rgba(50, 50, 70, 255) };
                    let text_color = if action == &"FUITE" { RED } else { WHITE };

                    draw_rectangle(x, y, btn_w, btn_h, color);
                    draw_rectangle_lines(x, y, btn_w, btn_h, 2.0, LIGHTGRAY);
                    let text_dims = measure_text(action, None, 30, 1.0);
                    draw_text(action, x + (btn_w - text_dims.width)/2.0, y + (btn_h - text_dims.height)/2.0 + text_dims.offset_y, 30.0, text_color);

                    if was_click && is_hovered {
                        match i {
                            0 => *ui_state = BattleUIState::AttackMenu,
                            1 => *ui_state = BattleUIState::BagMenu,
                            2 => { /* Flee Logic (Print for now) */ println!("Player fled!"); },
                            3 => *ui_state = BattleUIState::PassiveInfo,
                            _ => {}
                        }
                    }
                }
            }

            BattleUIState::AttackMenu => {
                // 10 ATTACKS GRID
                draw_text("SKILLS / MAGIC - Select an attack", 20.0, menu_y + 30.0, 20.0, GOLD);
                
                let attacks = player_class_enum.get_attacks();
                let grid_cols = 5;
                let cell_w = 180.0;
                let cell_h = 50.0;
                let grid_start_x = 20.0;
                let grid_start_y = menu_y + 50.0;

                for (i, atk) in attacks.iter().enumerate() {
                    let col = i % grid_cols;
                    let row = i / grid_cols;
                    let x = grid_start_x + col as f32 * (cell_w + 10.0);
                    let y = grid_start_y + row as f32 * (cell_h + 10.0);

                    let is_hovered = mouse.0 >= x && mouse.0 <= x + cell_w && mouse.1 >= y && mouse.1 <= y + cell_h;
                    let color = if is_hovered { Color::from_rgba(100, 50, 50, 255) } else { Color::from_rgba(60, 30, 30, 255) };
                    
                    draw_rectangle(x, y, cell_w, cell_h, color);
                    draw_rectangle_lines(x, y, cell_w, cell_h, 1.0, GRAY);
                    
                    draw_text(&atk.name, x + 10.0, y + 20.0, 18.0, WHITE);
                    draw_text(&format!("MP: {}", atk.mana_cost), x + 10.0, y + 40.0, 14.0, SKYBLUE);
                }

                // BACK Button
                if draw_back_button(screen_width, menu_y, mouse, was_click) {
                    *ui_state = BattleUIState::Main;
                }
            }

            BattleUIState::BagMenu => {
                draw_text("INVENTORY (Items)", 20.0, menu_y + 30.0, 20.0, GOLD);
                // Mock Items
                let items = vec!["Potion (50 HP)", "Ether (20 MP)", "Elixir", "Antidote"];
                for (i, item) in items.iter().enumerate() {
                    draw_text(&format!("- {}", item), 40.0, menu_y + 60.0 + i as f32 * 30.0, 20.0, WHITE);
                }

                if draw_back_button(screen_width, menu_y, mouse, was_click) {
                    *ui_state = BattleUIState::Main;
                }
            }
            
            BattleUIState::PassiveInfo => {
                draw_text("CLASS PASSIVE SKILLS", 20.0, menu_y + 30.0, 20.0, GOLD);
                let passives = crate::class_system::Passive::get_for_class(player_class_enum);
                
                for (i, p) in passives.iter().enumerate() {
                    let y = menu_y + 70.0 + i as f32 * 40.0;
                    draw_text(&format!("• {}: {}", p.name, p.description), 40.0, y, 20.0, WHITE);
                }

                if draw_back_button(screen_width, menu_y, mouse, was_click) {
                    *ui_state = BattleUIState::Main;
                }
            }
        }
    }
}

// Helper for BACK button
fn draw_back_button(screen_width: f32, menu_y: f32, mouse: (f32, f32), clicked: bool) -> bool {
    let btn_w = 100.0;
    let btn_h = 40.0;
    let x = screen_width - btn_w - 20.0;
    let y = menu_y + 20.0;

    let is_hovered = mouse.0 >= x && mouse.0 <= x + btn_w && mouse.1 >= y && mouse.1 <= y + btn_h;
    let color = if is_hovered { GRAY } else { DARKGRAY };

    draw_rectangle(x, y, btn_w, btn_h, color);
    draw_rectangle_lines(x, y, btn_w, btn_h, 1.0, WHITE);
    draw_text("BACK", x + 25.0, y + 25.0, 20.0, WHITE);

    clicked && is_hovered
}
