use macroquad::prelude::*;
use crate::entities::Enemy;

pub struct EnemySpawner {
    pub spawn_timer: f32,
    pub spawn_interval: f32,
    pub enemies_per_wave: u32,
    pub enemies_spawned_this_wave: u32,
    pub current_wave: u32,
}

impl EnemySpawner {
    pub fn new() -> Self {
        EnemySpawner {
            spawn_timer: 0.0,
            spawn_interval: 2.0, // Spawn un ennemi toutes les 2 secondes
            enemies_per_wave: 5,
            enemies_spawned_this_wave: 0,
            current_wave: 1,
        }
    }

    pub fn update(&mut self, delta_time: f32, enemies: &mut Vec<Enemy>, screen_width: f32, screen_height: f32) {
        self.spawn_timer += delta_time;

        if self.spawn_timer >= self.spawn_interval && self.enemies_spawned_this_wave < self.enemies_per_wave {
            // Spawn un nouvel ennemi du côté droit de l'écran
            let spawn_x = screen_width - 50.0;
            let spawn_y = rand::gen_range(100.0, screen_height - 100.0);
            
            enemies.push(Enemy::new(vec2(spawn_x, spawn_y)));
            
            self.enemies_spawned_this_wave += 1;
            self.spawn_timer = 0.0;
        }
    }

    pub fn start_next_wave(&mut self) {
        self.current_wave += 1;
        self.enemies_spawned_this_wave = 0;
        
        // Augmenter la difficulté
        self.enemies_per_wave += 2; // 2 ennemis de plus par vague
        self.spawn_interval = (self.spawn_interval * 0.9).max(0.5); // Spawn plus rapide (min 0.5s)
    }

    pub fn is_wave_complete(&self, enemies: &Vec<Enemy>) -> bool {
        self.enemies_spawned_this_wave >= self.enemies_per_wave && enemies.is_empty()
    }
}
