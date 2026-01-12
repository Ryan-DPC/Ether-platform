use macroquad::prelude::*;

mod game;
mod entities;
mod systems;
mod ui;
mod class_system;
mod inventory;
mod menu_system;
mod menu_ui;

use game::GameState;
use entities::{StickFigure, Enemy, Entity};
use ui::{MenuState, MenuButton, AttackButton, get_mock_attacks, ItemButton, PassiveDisplay};
use class_system::PlayerClass;
use inventory::ItemType;

const SCREEN_WIDTH: f32 = 800.0;
const SCREEN_HEIGHT: f32 = 600.0;

// Position des combattants (vue de côté)
const PLAYER_X: f32 = 200.0;
const PLAYER_Y: f32 = 350.0;
const ENEMY_X: f32 = 600.0;
const ENEMY_Y: f32 = 350.0;

#[macroquad::main("Aether Strike - RPG Stick War")]
async fn main() {
    // Choix de la classe (pour l'instant Warrior par défaut)
    let player_class = PlayerClass::Warrior; // TODO: Ajouter un menu de sélection de classe
    
    // Initialisation
    let mut game_state = GameState::new(player_class);
    let mut player = StickFigure::new(vec2(PLAYER_X, PLAYER_Y));
    player.max_health = game_state.get_max_hp();
    player.health = player.max_health;
    player.color = player_class.color();
    
    let mut enemy = Enemy::new(vec2(ENEMY_X, ENEMY_Y));
    
    // Menu state
    let mut menu_state = MenuState::Main;
    
    // Attaques mock
    let attacks = get_mock_attacks();
    
    // Boutons du menu principal (en bas de l'écran)
    let menu_y = SCREEN_HEIGHT - 80.0;
    let button_width = 180.0;
    let button_height = 60.0;
    let spacing = 10.0;
    let start_x = (SCREEN_WIDTH - (button_width * 4.0 + spacing * 3.0)) / 2.0;
    
    let main_buttons = vec![
        MenuButton::new("ATTACK", start_x, menu_y, button_width, button_height),
        MenuButton::new("BAG", start_x + button_width + spacing, menu_y, button_width, button_height),
        MenuButton::new("FLEE", start_x + (button_width + spacing) * 2.0, menu_y, button_width, button_height),
        MenuButton::new("PASSIF", start_x + (button_width + spacing) * 3.0, menu_y, button_width, button_height),
    ];
    
    // Boutons d'attaque (10 attaques en 2 lignes de 5)
    let attack_button_width = 140.0;
    let attack_button_height = 50.0;
    let attack_spacing = 10.0;
    let attack_start_x = (SCREEN_WIDTH - (attack_button_width * 5.0 + attack_spacing * 4.0)) / 2.0;
    let attack_start_y = SCREEN_HEIGHT - 180.0;
    
    let mut attack_buttons = Vec::new();
    for (i, attack) in attacks.iter().enumerate() {
        let row = i / 5;
        let col = i % 5;
        let x = attack_start_x + col as f32 * (attack_button_width + attack_spacing);
        let y = attack_start_y + row as f32 * (attack_button_height + attack_spacing);
        
        attack_buttons.push(AttackButton::new(
            attack.clone(),
            x,
            y,
            attack_button_width,
            attack_button_height,
        ));
    }

    // Boutons d'items (BAG)
    let item_button_width = 250.0;
    let item_button_height = 60.0;
    let item_start_y = SCREEN_HEIGHT - 220.0;
    
    let item_buttons = vec![
        ItemButton::new(ItemType::HealthPotion, SCREEN_WIDTH / 2.0 - item_button_width / 2.0, item_start_y, item_button_width, item_button_height),
        ItemButton::new(ItemType::ManaPotion, SCREEN_WIDTH / 2.0 - item_button_width / 2.0, item_start_y + item_button_height + 10.0, item_button_width, item_button_height),
        ItemButton::new(ItemType::FullRestore, SCREEN_WIDTH / 2.0 - item_button_width / 2.0, item_start_y + (item_button_height + 10.0) * 2.0, item_button_width, item_button_height),
    ];

    // Affichage des passifs
    let passive_displays: Vec<PassiveDisplay> = game_state.active_passives.iter().enumerate().map(|(i, passive)| {
        PassiveDisplay::new(
            passive.clone(),
            SCREEN_WIDTH / 2.0 - 200.0,
            150.0 + i as f32 * 70.0,
            400.0,
            60.0,
        )
    }).collect();

    loop {
        let delta_time = get_frame_time();

        // ----- UPDATE -----
        game_state.update(delta_time);
        player.update(delta_time);
        enemy.update(delta_time);

        // Auto-attack si activé
        if game_state.can_auto_attack() && enemy.is_alive() && attacks.len() > 0 {
            // Utiliser la première attaque disponible (Basic Attack)
            let attack = &attacks[0];
            if game_state.resources.can_afford_mana(attack.mana_cost) {
                game_state.resources.spend_mana(attack.mana_cost);
                
                // Calculer les dégâts (utiliser dégâts de base du niveau pour Basic Attack)
                let base_damage = if attack.name == "Basic Attack" {
                    game_state.get_basic_attack_damage()
                } else {
                    attack.damage
                };
                let damage = game_state.calculate_damage(base_damage);
                enemy.take_damage(damage);
                
                // Vol de vie
                let life_steal = game_state.calculate_life_steal(damage);
                if life_steal > 0.0 {
                    player.restore_health(life_steal);
                }
                
                game_state.trigger_auto_attack();
                
                // Tour de l'ennemi
                if enemy.is_alive() && enemy.can_attack() {
                    let incoming_damage = game_state.calculate_damage_reduction(enemy.attack_damage);
                    player.take_damage(incoming_damage);
                    enemy.attack();
                }
            }
        }

        // Respawn ennemi si mort
        if !enemy.is_alive() {
            let should_restore = game_state.on_enemy_killed();
            
            // Mettre à jour le HP max du joueur avec le nouveau niveau
            player.max_health = game_state.get_max_hp();
            
            // Full restore HP si level up jusqu'au niveau 10
            if should_restore {
                player.health = player.max_health;
            }
            
            enemy = Enemy::new(vec2(ENEMY_X, ENEMY_Y));
        }

        // Gestion des clics
        if is_mouse_button_pressed(MouseButton::Left) {
            let mouse_pos = vec2(mouse_position().0, mouse_position().1);

            // Clics sur le menu principal
            if menu_state == MenuState::Main {
                if main_buttons[0].is_clicked(mouse_pos) {
                    menu_state = MenuState::Attack;
                } else if main_buttons[1].is_clicked(mouse_pos) {
                    menu_state = MenuState::Bag;
                } else if main_buttons[2].is_clicked(mouse_pos) {
                    // FLEE - pour l'instant rien
                } else if main_buttons[3].is_clicked(mouse_pos) {
                    menu_state = MenuState::Passif;
                }
            }
            // Clics sur les attaques
            else if menu_state == MenuState::Attack {
                for attack_btn in attack_buttons.iter() {
                    if attack_btn.is_clicked(mouse_pos) {
                        if game_state.resources.can_afford_mana(attack_btn.attack.mana_cost) {
                            game_state.resources.spend_mana(attack_btn.attack.mana_cost);
                            
                            // Calculer les dégâts (utiliser dégâts de base du niveau pour Basic Attack)
                            let base_damage = if attack_btn.attack.name == "Basic Attack" {
                                game_state.get_basic_attack_damage()
                            } else {
                                attack_btn.attack.damage
                            };
                            let damage = game_state.calculate_damage(base_damage);
                            enemy.take_damage(damage);
                            
                            // Vol de vie
                            let life_steal = game_state.calculate_life_steal(damage);
                            if life_steal > 0.0 {
                                player.restore_health(life_steal);
                            }
                            
                            println!("Used attack: {} (damage: {})", attack_btn.attack.name, damage);
                            
                            menu_state = MenuState::Main;
                            
                            // Tour de l'ennemi
                            if enemy.is_alive() && enemy.can_attack() {
                                let incoming_damage = game_state.calculate_damage_reduction(enemy.attack_damage);
                                player.take_damage(incoming_damage);
                                enemy.attack();
                                println!("Enemy attacks! Damage: {}", incoming_damage);
                            }
                        } else {
                            println!("Not enough mana!");
                        }
                        break;
                    }
                }
            }
            // Clics sur les items (BAG)
            else if menu_state == MenuState::Bag {
                for item_btn in &item_buttons {
                    if item_btn.is_clicked(mouse_pos) {
                        if game_state.inventory.use_item(item_btn.item_type) {
                            match item_btn.item_type {
                                ItemType::HealthPotion => {
                                    player.restore_health(50.0);
                                    println!("Used Health Potion (+50 HP)");
                                }
                                ItemType::ManaPotion => {
                                    game_state.resources.restore_mana(30);
                                    println!("Used Mana Potion (+30 MP)");
                                }
                                ItemType::FullRestore => {
                                    player.health = player.max_health;
                                    game_state.resources.mana = game_state.resources.max_mana;
                                    println!("Used Full Restore (HP & MP restored!)");
                                }
                            }
                            menu_state = MenuState::Main;
                        }
                        break;
                    }
                }
            }
        }

        // Touche ESC pour retourner au menu principal
        if is_key_pressed(KeyCode::Escape) && menu_state != MenuState::Main {
            menu_state = MenuState::Main;
        }

        // ----- DRAW -----
        clear_background(Color::from_rgba(40, 40, 60, 255));

        // Sol
        draw_line(
            0.0,
            PLAYER_Y + 60.0,
            SCREEN_WIDTH,
            PLAYER_Y + 60.0,
            3.0,
            Color::from_rgba(100, 100, 100, 255),
        );

        // Dessiner les combattants
        player.draw();
        enemy.draw();

        // HUD (resources en haut)
        draw_rectangle(0.0, 0.0, SCREEN_WIDTH, 60.0, Color::from_rgba(0, 0, 0, 180));
        
        // Classe
        draw_text(
            &format!("{}", game_state.player_class.name()),
            20.0,
            25.0,
            20.0,
            player_class.color(),
        );
        
        // Mana du joueur
        draw_text(
            &format!("MP: {} / {}", game_state.resources.mana, game_state.resources.max_mana),
            20.0,
            50.0,
            20.0,
            SKYBLUE,
        );
        
        // HP du joueur
        draw_text(
            &format!("HP: {}/{}", player.health as i32, player.max_health as i32),
            SCREEN_WIDTH / 2.0 - 80.0,
            35.0,
            24.0,
            GREEN,
        );

        // Or
        draw_text(
            &format!("Gold: {}", game_state.resources.gold),
            SCREEN_WIDTH - 150.0,
            25.0,
            18.0,
            GOLD,
        );

        // Niveau et EXP
        draw_text(
            &format!("Level {}", game_state.level),
            SCREEN_WIDTH - 150.0,
            45.0,
            18.0,
            YELLOW,
        );

        // Barre d'EXP
        let exp_bar_width = 120.0;
        let exp_bar_height = 8.0;
        let exp_percentage = game_state.exp as f32 / game_state.exp_to_next_level as f32;
        let exp_bar_x = SCREEN_WIDTH - 150.0;
        let exp_bar_y = 50.0;

        // Background
        draw_rectangle(
            exp_bar_x,
            exp_bar_y,
            exp_bar_width,
            exp_bar_height,
            Color::from_rgba(50, 50, 50, 255),
        );

        // Foreground (EXP progress)
        draw_rectangle(
            exp_bar_x,
            exp_bar_y,
            exp_bar_width * exp_percentage,
            exp_bar_height,
            YELLOW,
        );
        
        // Bordure
        draw_rectangle_lines(
            exp_bar_x,
            exp_bar_y,
            exp_bar_width,
            exp_bar_height,
            1.0,
            WHITE,
        );

        // Checkbox Auto-Attack (en haut à droite)
        let checkbox_x = SCREEN_WIDTH - 200.0;
        let checkbox_y = 5.0;
        let checkbox_size = 20.0;
        
        // Fond du checkbox
        draw_rectangle(checkbox_x, checkbox_y, checkbox_size, checkbox_size, WHITE);
        
        // Coche si activé
        if game_state.auto_attack_enabled {
            draw_rectangle(checkbox_x + 3.0, checkbox_y + 3.0, checkbox_size - 6.0, checkbox_size - 6.0, GREEN);
        }
        
        draw_text("Auto-Attack", checkbox_x + checkbox_size + 5.0, checkbox_y + 15.0, 18.0, WHITE);
        
        // Clic sur le checkbox
        if is_mouse_button_pressed(MouseButton::Left) {
            let mouse_pos = vec2(mouse_position().0, mouse_position().1);
            if Rect::new(checkbox_x, checkbox_y, checkbox_size + 100.0, checkbox_size).contains(mouse_pos) {
                game_state.auto_attack_enabled = !game_state.auto_attack_enabled;
            }
        }

        // Interface de combat
        match menu_state {
            MenuState::Main => {
                // Dessiner les 4 boutons principaux
                for button in main_buttons.iter() {
                    let mouse_pos = vec2(mouse_position().0, mouse_position().1);
                    let is_hovered = button.is_clicked(mouse_pos);
                    button.draw(is_hovered);
                }
            }
            MenuState::Attack => {
                // Dessiner les 10 boutons d'attaque
                for attack_btn in &attack_buttons {
                    let mouse_pos = vec2(mouse_position().0, mouse_position().1);
                    let is_hovered = attack_btn.is_clicked(mouse_pos);
                    let can_afford = game_state.resources.can_afford_mana(attack_btn.attack.mana_cost);
                    attack_btn.draw(is_hovered, can_afford);
                }
                
                draw_text("Press ESC to go back", 20.0, SCREEN_HEIGHT - 20.0, 18.0, LIGHTGRAY);
            }
            MenuState::Bag => {
                // Dessiner les items
                for item_btn in &item_buttons {
                    let mouse_pos = vec2(mouse_position().0, mouse_position().1);
                    let is_hovered = item_btn.is_clicked(mouse_pos);
                    item_btn.draw(&game_state.inventory, is_hovered);
                }
                
                draw_text("Press ESC to go back", 20.0, SCREEN_HEIGHT - 20.0, 18.0, LIGHTGRAY);
            }
            MenuState::Passif => {
                // Dessiner les passifs
                for passive_display in &passive_displays {
                    passive_display.draw();
                }
                
                draw_text("Press ESC to go back", 20.0, SCREEN_HEIGHT - 20.0, 18.0, LIGHTGRAY);
            }
        }

        // FPS
        draw_text(
            &format!("FPS: {}", get_fps()),
            SCREEN_WIDTH - 100.0,
            SCREEN_HEIGHT - 10.0,
            16.0,
            DARKGRAY,
        );

        next_frame().await;
    }
}
