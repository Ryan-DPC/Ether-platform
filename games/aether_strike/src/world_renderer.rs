use macroquad::prelude::*;
use crate::draw::Renderer;
use crate::entities::{StickFigure, Enemy};
use crate::network_client::RemotePlayer;
use crate::game::GameState;
use crate::menu_system::PlayerProfile;
use crate::modules::button::MenuButton;
use std::collections::HashMap;

pub struct WorldRenderer;

impl WorldRenderer {
    pub fn draw_environment(screen_width: f32, screen_height: f32) {
        // Simple tiled floor
        for x in 0..((screen_width / 50.0) as i32 + 1) {
            for y in 0..((screen_height / 50.0) as i32 + 1) {
                 let color = if (x + y) % 2 == 0 {
                     Color::from_rgba(30, 30, 45, 255)
                 } else {
                     Color::from_rgba(35, 35, 50, 255)
                 };
                 draw_rectangle(x as f32 * 50.0, y as f32 * 50.0, 50.0, 50.0, color);
            }
        }
        
        // Ground line
        draw_rectangle(0.0, 500.0, screen_width, 20.0, Color::from_rgba(50, 40, 30, 255));
    }

    pub fn draw_game(
        renderer: &Renderer,
        player: &Option<StickFigure>,
        teammates: &[StickFigure],
        other_players: &HashMap<String, RemotePlayer>,
        enemies: &[Enemy],
        enemy_boss: Option<&Enemy>,
        game_state: &Option<GameState>,
        screen_width: f32,
        screen_height: f32,
    ) {
        clear_background(Color::from_rgba(20, 20, 30, 255));
        Self::draw_environment(screen_width, screen_height);

        let player_class_name = if let Some(gs) = game_state {
            gs.character_class.name.as_str()
        } else {
            "Warrior"
        };

        renderer.draw_game_scene(
            player.as_ref(),
            teammates,
            other_players,
            enemies,
            enemy_boss,
            player_class_name,
        );
    }
}
