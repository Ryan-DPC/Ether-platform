use macroquad::prelude::*;
use crate::inventory::{Inventory, ItemType};
use crate::class_system::Passive;

/// Bouton d'item (pour le bag)
pub struct ItemButton {
    pub item_type: ItemType,
    pub rect: Rect,
}

impl ItemButton {
    pub fn new(item_type: ItemType, x: f32, y: f32, width: f32, height: f32) -> Self {
        ItemButton {
            item_type,
            rect: Rect::new(x, y, width, height),
        }
    }

    pub fn draw(&self, inventory: &Inventory, is_hovered: bool) {
        let quantity = inventory.get_item_count(self.item_type);
        let can_use = quantity > 0;
        
        let color = if !can_use {
            Color::from_rgba(40, 40, 40, 255)
        } else if is_hovered {
            Color::from_rgba(120, 120, 180, 255)
        } else {
            self.item_type.color()
        };

        // Ombre
        draw_rectangle(
            self.rect.x + 2.0,
            self.rect.y + 2.0,
            self.rect.w,
            self.rect.h,
            Color::from_rgba(0, 0, 0, 100),
        );

        // Fond
        draw_rectangle(self.rect.x, self.rect.y, self.rect.w, self.rect.h, color);

        // Bordure
        draw_rectangle_lines(
            self.rect.x,
            self.rect.y,
            self.rect.w,
            self.rect.h,
            2.0,
            if can_use { WHITE } else { DARKGRAY },
        );

        // Icône
        draw_text(
            self.item_type.icon(),
            self.rect.x + 10.0,
            self.rect.y + 35.0,
            32.0,
            WHITE,
        );

        // Nom
        draw_text(
            self.item_type.name(),
            self.rect.x + 50.0,
            self.rect.y + 25.0,
            18.0,
            WHITE,
        );

        // Quantité
        draw_text(
            &format!("x{}", quantity),
            self.rect.x + 50.0,
            self.rect.y + 45.0,
            16.0,
            LIGHTGRAY,
        );
    }

    pub fn is_clicked(&self, mouse_pos: Vec2) -> bool {
        self.rect.contains(mouse_pos)
    }
}

/// Affichage d'un passif
pub struct PassiveDisplay {
    pub passive: Passive,
    pub rect: Rect,
}

impl PassiveDisplay {
    pub fn new(passive: Passive, x: f32, y: f32, width: f32, height: f32) -> Self {
        PassiveDisplay {
            passive,
            rect: Rect::new(x, y, width, height),
        }
    }

    pub fn draw(&self) {
        // Fond
        draw_rectangle(
            self.rect.x,
            self.rect.y,
            self.rect.w,
            self.rect.h,
            Color::from_rgba(60, 80, 100, 255),
        );

        // Bordure
        draw_rectangle_lines(
            self.rect.x,
            self.rect.y,
            self.rect.w,
            self.rect.h,
            2.0,
            GOLD,
        );

        // Nom du passif
        draw_text(
            &self.passive.name,
            self.rect.x + 10.0,
            self.rect.y + 25.0,
            20.0,
            GOLD,
        );

        // Description
        draw_text(
            &self.passive.description,
            self.rect.x + 10.0,
            self.rect.y + 45.0,
            16.0,
            LIGHTGRAY,
        );
    }
}
