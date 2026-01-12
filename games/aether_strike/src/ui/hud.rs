use macroquad::prelude::*;
use crate::game::GameState;

pub struct HUD;

impl HUD {
    pub fn draw(game_state: &GameState, screen_width: f32) {
        let padding = 10.0;
        let font_size = 24.0;
        let y_offset = padding + font_size;

        // Background semi-transparent pour l'UI du haut
        draw_rectangle(0.0, 0.0, screen_width, 50.0, Color::from_rgba(0, 0, 0, 180));

        // Or (avec icône dorée)
        draw_circle(padding + 15.0, y_offset - 5.0, 12.0, GOLD);
        draw_text(
            &format!("{}", game_state.resources.gold),
            padding + 35.0,
            y_offset,
            font_size,
            WHITE,
        );

        // Mana (avec icône bleue)
        let mana_x = screen_width / 3.0;
        draw_circle(mana_x + 15.0, y_offset - 5.0, 12.0, SKYBLUE);
        draw_text(
            &format!("{} / {}", game_state.resources.mana, game_state.resources.max_mana),
            mana_x + 35.0,
            y_offset,
            font_size,
            WHITE,
        );

        // Vague actuelle
        let wave_x = screen_width * 2.0 / 3.0;
        draw_text(
            &format!("Wave {}", game_state.current_wave),
            wave_x,
            y_offset,
            font_size,
            WHITE,
        );

        // Score
        let score_x = screen_width - 150.0;
        draw_text(
            &format!("Score: {}", game_state.score),
            score_x,
            y_offset,
            font_size,
            WHITE,
        );
    }
}
