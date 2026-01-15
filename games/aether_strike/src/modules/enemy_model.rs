use macroquad::prelude::*;
use crate::entities::Enemy;
use crate::network_client::EnemyData;


pub fn from_server_data(data: &[EnemyData], screen_width: f32, screen_height: f32) -> (Vec<Enemy>, Option<Enemy>) {
    let mut enemies = Vec::new();
    let mut boss_ref: Option<Enemy> = None;
    
    // Determine positions based on count to avoid overlap
    // Simple vertical stack for now, matching main.rs logic
    let mut minion_count = 0;

    for e_data in data {
        // Infer Type
        let kind = if e_data.name.contains("Boss") {
            crate::entities::enemy::EnemyType::Boss
        } else {
            crate::entities::enemy::EnemyType::Minion
        };
        
        let mut stats = crate::entities::enemy::EnemyStats {
            name: e_data.name.clone(),
            hp: e_data.hp,
            damage: 10.0, // Default/Placeholder
            speed: e_data.speed,
            attack_range: 50.0,
            attack_cooldown: 2.0,
            gold_reward: 10,
            color: if kind == crate::entities::enemy::EnemyType::Boss { RED } else { Color::from_rgba(200, 50, 50, 255) },
            scale: if kind == crate::entities::enemy::EnemyType::Boss { 2.0 } else { 1.0 },
        };
        
        let enemy_pos = vec2(e_data.position.0, e_data.position.1);

        let mut new_entity = Enemy::new(enemy_pos, kind.clone(), stats);
        new_entity.id = e_data.id.clone();
        new_entity.health = e_data.hp;
        new_entity.max_health = e_data.max_hp;

        if kind == crate::entities::enemy::EnemyType::Boss {
            boss_ref = Some(new_entity.clone());
        }
        
        enemies.push(new_entity);
    }
    
    (enemies, boss_ref)
}
