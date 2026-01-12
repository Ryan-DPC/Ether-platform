use macroquad::prelude::*;

/// Classe du joueur
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PlayerClass {
    Warrior,
    Mage,
    Archer,
}

impl PlayerClass {
    pub fn name(&self) -> &str {
        match self {
            PlayerClass::Warrior => "Warrior",
            PlayerClass::Mage => "Mage",
            PlayerClass::Archer => "Archer",
        }
    }

    pub fn base_hp(&self) -> f32 {
        match self {
            PlayerClass::Warrior => 150.0,
            PlayerClass::Mage => 80.0,
            PlayerClass::Archer => 100.0,
        }
    }

    pub fn base_mana(&self) -> u32 {
        match self {
            PlayerClass::Warrior => 50,
            PlayerClass::Mage => 150,
            PlayerClass::Archer => 100,
        }
    }

    pub fn color(&self) -> Color {
        match self {
            PlayerClass::Warrior => Color::from_rgba(200, 50, 50, 255),
            PlayerClass::Mage => Color::from_rgba(50, 100, 200, 255),
            PlayerClass::Archer => Color::from_rgba(50, 200, 100, 255),
        }
    }
}

/// Type de passif
#[derive(Debug, Clone)]
pub struct Passive {
    pub name: String,
    pub description: String,
    pub effect: PassiveEffect,
}

#[derive(Debug, Clone, Copy)]
pub enum PassiveEffect {
    IncreaseDamage(f32),      // Augmente les dégâts de X%
    IncreaseDefense(f32),     // Réduit les dégâts reçus de X%
    ManaRegen(f32),           // Régénération de mana +X par seconde
    LifeSteal(f32),           // Vol de vie X% des dégâts infligés
    CriticalChance(f32),      // Chance de coup critique X%
}

impl Passive {
    pub fn warrior_passives() -> Vec<Passive> {
        vec![
            Passive {
                name: "Iron Skin".to_string(),
                description: "Reduce damage taken by 15%".to_string(),
                effect: PassiveEffect::IncreaseDefense(0.15),
            },
            Passive {
                name: "Berserker".to_string(),
                description: "Increase damage by 20%".to_string(),
                effect: PassiveEffect::IncreaseDamage(0.20),
            },
            Passive {
                name: "Life Drain".to_string(),
                description: "Heal 10% of damage dealt".to_string(),
                effect: PassiveEffect::LifeSteal(0.10),
            },
        ]
    }

    pub fn mage_passives() -> Vec<Passive> {
        vec![
            Passive {
                name: "Arcane Focus".to_string(),
                description: "Increase spell damage by 25%".to_string(),
                effect: PassiveEffect::IncreaseDamage(0.25),
            },
            Passive {
                name: "Mana Flow".to_string(),
                description: "+10 mana regen per second".to_string(),
                effect: PassiveEffect::ManaRegen(10.0),
            },
            Passive {
                name: "Critical Mind".to_string(),
                description: "15% chance for critical hits".to_string(),
                effect: PassiveEffect::CriticalChance(0.15),
            },
        ]
    }

    pub fn archer_passives() -> Vec<Passive> {
        vec![
            Passive {
                name: "Precision".to_string(),
                description: "20% chance for critical hits".to_string(),
                effect: PassiveEffect::CriticalChance(0.20),
            },
            Passive {
                name: "Swift Arrows".to_string(),
                description: "Increase damage by 15%".to_string(),
                effect: PassiveEffect::IncreaseDamage(0.15),
            },
            Passive {
                name: "Evasion".to_string(),
                description: "Reduce damage taken by 10%".to_string(),
                effect: PassiveEffect::IncreaseDefense(0.10),
            },
        ]
    }

    pub fn get_for_class(class: PlayerClass) -> Vec<Passive> {
        match class {
            PlayerClass::Warrior => Self::warrior_passives(),
            PlayerClass::Mage => Self::mage_passives(),
            PlayerClass::Archer => Self::archer_passives(),
        }
    }
}
