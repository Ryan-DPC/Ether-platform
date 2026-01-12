pub mod stick_figure;
pub mod enemy;

pub use stick_figure::StickFigure;
pub use enemy::Enemy;

/// Type d'entité
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EntityType {
    Ally,
    Enemy,
}

/// Trait commun pour toutes les entités (stick figures et ennemis)
pub trait Entity {
    fn position(&self) -> macroquad::prelude::Vec2;
    fn set_position(&mut self, pos: macroquad::prelude::Vec2);
    fn health(&self) -> f32;
    fn max_health(&self) -> f32;
    fn is_alive(&self) -> bool;
    fn take_damage(&mut self, damage: f32);
    fn entity_type(&self) -> EntityType;
}
