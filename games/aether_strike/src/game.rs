use macroquad::prelude::*;
use crate::class_system::{PlayerClass, Passive, PassiveEffect};
use crate::inventory::Inventory;

/// Resources du joueur (or, mana, etc.)
#[derive(Debug, Clone)]
pub struct Resources {
    pub gold: u32,
    pub mana: u32,
    pub max_mana: u32,
    pub mana_regen: f32, // Mana par seconde
}

impl Resources {
    pub fn new(max_mana: u32) -> Self {
        Resources {
            gold: 0,
            mana: max_mana,
            max_mana,
            mana_regen: 5.0,
        }
    }

    pub fn update(&mut self, delta_time: f32, bonus_regen: f32) {
        // Régénération de mana (base + bonus des passifs)
        let total_regen = self.mana_regen + bonus_regen;
        self.mana = (self.mana as f32 + total_regen * delta_time).min(self.max_mana as f32) as u32;
    }

    pub fn can_afford_mana(&self, cost: u32) -> bool {
        self.mana >= cost
    }

    pub fn spend_mana(&mut self, cost: u32) -> bool {
        if self.can_afford_mana(cost) {
            self.mana -= cost;
            true
        } else {
            false
        }
    }

    pub fn restore_mana(&mut self, amount: u32) {
        self.mana = (self.mana + amount).min(self.max_mana);
    }

    pub fn add_gold(&mut self, amount: u32) {
        self.gold += amount;
    }
}

/// État du jeu
pub struct GameState {
    pub resources: Resources,
    pub inventory: Inventory,
    pub player_class: PlayerClass,
    pub active_passives: Vec<Passive>,
    pub auto_attack_enabled: bool,
    pub auto_attack_timer: f32,
    pub auto_attack_cooldown: f32,
    pub current_wave: u32,
    pub enemies_killed: u32,
    pub score: u32,
    pub level: u32,
    pub exp: u32,
    pub exp_to_next_level: u32,
}

impl GameState {
    pub fn new(player_class: PlayerClass) -> Self {
        let passives = Passive::get_for_class(player_class);
        let max_mana = player_class.base_mana();
        
        GameState {
            resources: Resources::new(max_mana),
            inventory: Inventory::new(),
            player_class,
            active_passives: passives,
            auto_attack_enabled: false,
            auto_attack_timer: 0.0,
            auto_attack_cooldown: 1.5, // 1.5 seconde entre chaque auto-attack
            current_wave: 1,
            enemies_killed: 0,
            score: 0,
            level: 1,
            exp: 0,
            exp_to_next_level: 10, // 10 EXP pour level 2
        }
    }

    pub fn update(&mut self, delta_time: f32) {
        // Calculer le bonus de régénération des passifs
        let mut mana_regen_bonus = 0.0;
        for passive in &self.active_passives {
            if let PassiveEffect::ManaRegen(bonus) = passive.effect {
                mana_regen_bonus += bonus * self.get_passive_multiplier();
            }
        }
        
        self.resources.update(delta_time, mana_regen_bonus);
        
        // Timer pour auto-attack
        if self.auto_attack_timer > 0.0 {
            self.auto_attack_timer -= delta_time;
        }
    }

    pub fn can_auto_attack(&self) -> bool {
        self.auto_attack_enabled && self.auto_attack_timer <= 0.0
    }

    pub fn trigger_auto_attack(&mut self) {
        self.auto_attack_timer = self.auto_attack_cooldown;
    }

    /// Calculer le multiplicateur de passifs selon le niveau
    pub fn get_passive_multiplier(&self) -> f32 {
        match self.level {
            1..=14 => 1.0,
            15..=29 => 1.5,
            30..=44 => 2.0,
            _ => 2.5, // 45+
        }
    }

    /// Calculer le HP max selon le niveau et la classe
    pub fn get_max_hp(&self) -> f32 {
        // HP base + 10 par niveau
        self.player_class.base_hp() + (self.level - 1) as f32 * 10.0
    }

    /// Calculer le MP max selon le niveau et la classe
    pub fn get_max_mp(&self) -> u32 {
        // MP base + 5 par niveau
        self.player_class.base_mana() + (self.level - 1) * 5
    }

    /// Mettre à jour les stats max après level up
    fn update_max_stats(&mut self) {
        let new_max_mp = self.get_max_mp();
        self.resources.max_mana = new_max_mp;
    }

    pub fn on_enemy_killed(&mut self) -> bool {
        self.enemies_killed += 1;
        self.score += 10;
        self.resources.add_gold(5); // 5 gold par ennemi
        
        // Système d'EXP
        let exp_gain = 5; // 5 EXP par ennemi
        self.exp += exp_gain;
        
        // Level up
        let mut should_restore = false;
        while self.exp >= self.exp_to_next_level {
            should_restore = self.level_up() || should_restore;
        }
        
        should_restore
    }

    /// Level up - retourne true si full restore
    fn level_up(&mut self) -> bool {
        self.exp -= self.exp_to_next_level;
        self.level += 1;
        
        // Augmenter l'EXP nécessaire pour le prochain niveau
        self.exp_to_next_level = (self.exp_to_next_level as f32 * 1.5) as u32;
        
        // Mettre à jour les stats max
        self.update_max_stats();
        
        // Vérifier si évolution des passifs (tous les 15 niveaux)
        let is_passive_evolution = self.level % 15 == 0;
        
        // Full restore HP & MP jusqu'au niveau 10
        let should_restore = self.level <= 10;
        if should_restore {
            self.resources.mana = self.resources.max_mana;
            println!("🎉 LEVEL UP! You are now level {} - HP & MP fully restored!", self.level);
        } else {
            println!("🎉 LEVEL UP! You are now level {}", self.level);
        }
        
        // Afficher l'évolution des passifs
        if is_passive_evolution {
            let multiplier = self.get_passive_multiplier();
            println!("⚡ PASSIVE EVOLUTION! All passives are now {}x stronger!", multiplier);
        }
        
        // Afficher les nouvelles stats
        println!("   HP: {:.0} (max) | MP: {} (max)", self.get_max_hp(), self.get_max_mp());
        
        should_restore
    }

    /// Vérifie si le level up a eu lieu et retourne true si full restore nécessaire
    pub fn check_level_up(&mut self) -> bool {
        let mut should_restore = false;
        while self.exp >= self.exp_to_next_level {
            should_restore = self.level_up() || should_restore;
        }
        should_restore
    }

    /// Calculer les dégâts de l'attaque de base
    pub fn get_basic_attack_damage(&self) -> f32 {
        // Dégâts de base = niveau × 5
        self.level as f32 * 5.0
    }

    /// Calculer les dégâts avec les passifs
    pub fn calculate_damage(&self, base_damage: f32) -> f32 {
        let mut damage = base_damage;
        let multiplier = self.get_passive_multiplier();
        
        // Bonus de dégâts des passifs
        for passive in &self.active_passives {
            if let PassiveEffect::IncreaseDamage(bonus) = passive.effect {
                damage *= 1.0 + (bonus * multiplier);
            }
        }
        
        // Chance de coup critique
        for passive in &self.active_passives {
            if let PassiveEffect::CriticalChance(chance) = passive.effect {
                let crit_chance = chance * multiplier;
                if rand::gen_range(0.0, 1.0) < crit_chance {
                    damage *= 2.0; // Coup critique = x2 dégâts
                    println!("💥 CRITICAL HIT! (x2 damage)");
                }
            }
        }
        
        damage
    }

    /// Calculer la réduction de dégâts reçus
    pub fn calculate_damage_reduction(&self, incoming_damage: f32) -> f32 {
        let mut damage = incoming_damage;
        let multiplier = self.get_passive_multiplier();
        
        for passive in &self.active_passives {
            if let PassiveEffect::IncreaseDefense(reduction) = passive.effect {
                damage *= 1.0 - (reduction * multiplier).min(0.9); // Cap à 90% de réduction
            }
        }
        
        damage
    }

    /// Calculer le vol de vie
    pub fn calculate_life_steal(&self, damage_dealt: f32) -> f32 {
        let mut life_steal = 0.0;
        let multiplier = self.get_passive_multiplier();
        
        for passive in &self.active_passives {
            if let PassiveEffect::LifeSteal(percent) = passive.effect {
                life_steal += damage_dealt * (percent * multiplier);
            }
        }
        
        life_steal
    }
}

