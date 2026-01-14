use macroquad::prelude::*;
use crate::game::GameState;

pub struct HUD;

impl HUD {
    pub fn draw(game_state: &GameState, screen_width: f32, screen_height: f32, character_name: &str, player_class: &str) {
        // --- CONSTANTS ---
        let bar_width = 300.0;
        let bar_height = 25.0;
        let padding = 20.0;
        let skill_size = 50.0;
        let skill_gap = 10.0;

        // --- TOP LEFT: PLAYER INFO ---
        let top_ui_h = 90.0;
        
        // Background gradient-ish fan 
        draw_rectangle(0.0, 0.0, 400.0, top_ui_h, Color::from_rgba(0, 0, 0, 160));
        draw_rectangle(0.0, top_ui_h, 380.0, 5.0, Color::from_rgba(0, 0, 0, 100)); // fade edge

        // Avatar Frame (Mockup)
        let avatar_size = 60.0;
        draw_rectangle(padding, padding, avatar_size, avatar_size, DARKGRAY);
        draw_rectangle_lines(padding, padding, avatar_size, avatar_size, 2.0, LIGHTGRAY);
        // First Letter as Avatar
        let initial = character_name.chars().next().unwrap_or('?').to_string();
        draw_text(&initial, padding + 18.0, padding + 42.0, 40.0, WHITE);

        // Name & Class
        let text_x = padding + avatar_size + 15.0;
        draw_text(character_name, text_x, padding + 22.0, 24.0, WHITE);
        draw_text(&format!("Lv.1 {}", player_class.to_uppercase()), text_x, padding + 45.0, 16.0, GOLD);

        // Health Bar (Red)
        let hp_percent = game_state.resources.current_hp / game_state.resources.max_hp;
        let bar_x = text_x;
        let bar_y = padding + 55.0;
        
        // Background
        draw_rectangle(bar_x, bar_y, 200.0, 12.0, Color::from_rgba(50, 0, 0, 255));
        // Fill
        draw_rectangle(bar_x, bar_y, 200.0 * hp_percent.clamp(0.0, 1.0), 12.0, RED);
        // Border
        draw_rectangle_lines(bar_x, bar_y, 200.0, 12.0, 1.0, BLACK);
        
        // Text HP
        let hp_text = format!("{:.0}/{:.0}", game_state.resources.current_hp, game_state.resources.max_hp);
        draw_text(&hp_text, bar_x + 80.0, bar_y + 10.0, 10.0, WHITE);

        // --- TOP RIGHT: GAME STATS (Wave, Gold) ---
        let stats_w = 250.0;
        let stats_x = screen_width - stats_w;
        draw_rectangle(stats_x, 0.0, stats_w, 60.0, Color::from_rgba(0, 0, 0, 160));
        
        // Wave
        draw_text(&format!("WAVE {}", game_state.current_wave), stats_x + 20.0, 35.0, 30.0, WHITE);
        
        // Gold
        let gold_text = format!("{} G", game_state.resources.gold);
        draw_text(&gold_text, screen_width - 100.0, 35.0, 24.0, GOLD);

        // --- BOTTOM CENTER: SKILL BAR ---
        let num_skills = 4;
        let toolbar_w = (skill_size + skill_gap) * num_skills as f32 + padding * 2.0;
        let toolbar_x = (screen_width - toolbar_w) / 2.0;
        let toolbar_y = screen_height - skill_size - padding * 2.0;

        // Background
        draw_rectangle(toolbar_x, toolbar_y, toolbar_w, skill_size + padding * 2.0, Color::from_rgba(20, 20, 20, 200));
        draw_rectangle_lines(toolbar_x, toolbar_y, toolbar_w, skill_size + padding * 2.0, 2.0, GOLD);

        for i in 0..num_skills {
            let sx = toolbar_x + padding + i as f32 * (skill_size + skill_gap);
            let sy = toolbar_y + padding;
            
            // Skill slot bg
            draw_rectangle(sx, sy, skill_size, skill_size, Color::from_rgba(50, 50, 50, 255));
            draw_rectangle_lines(sx, sy, skill_size, skill_size, 1.0, GRAY);
            
            // Hotkey text
            let key = match i { 0 => "Q", 1 => "W", 2 => "E", _ => "R" };
            draw_text(key, sx + 2.0, sy + 12.0, 10.0, LIGHTGRAY);
            
            // Placeholder Icon (Color based on index)
            let color = match i { 0 => RED, 1 => BLUE, 2 => GREEN, _ => YELLOW };
            draw_circle(sx + skill_size/2.0, sy + skill_size/2.0, 10.0, color);
        }

        // --- BOTTOM LEFT: CHAT/LOG ---
        draw_rectangle(10.0, screen_height - 150.0, 300.0, 140.0, Color::from_rgba(0, 0, 0, 120));
        draw_text("Combat Log", 20.0, screen_height - 130.0, 16.0, WHITE);
        draw_line(20.0, screen_height - 125.0, 300.0, screen_height - 125.0, 1.0, WHITE);
        
        // Mock logs
        draw_text("> Game started", 20.0, screen_height - 100.0, 14.0, LIGHTGRAY);
        draw_text("> Player joined", 20.0, screen_height - 80.0, 14.0, GREEN);
    }
}
