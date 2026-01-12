use macroquad::prelude::*;

/// Type d'item
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ItemType {
    HealthPotion,
    ManaPotion,
    FullRestore,
}

impl ItemType {
    pub fn name(&self) -> &str {
        match self {
            ItemType::HealthPotion => "Health Potion",
            ItemType::ManaPotion => "Mana Potion",
            ItemType::FullRestore => "Full Restore",
        }
    }

    pub fn description(&self) -> &str {
        match self {
            ItemType::HealthPotion => "Restore 50 HP",
            ItemType::ManaPotion => "Restore 30 MP",
            ItemType::FullRestore => "Restore all HP and MP",
        }
    }

    pub fn icon(&self) -> &str {
        match self {
            ItemType::HealthPotion => "❤️",
            ItemType::ManaPotion => "💙",
            ItemType::FullRestore => "✨",
        }
    }

    pub fn color(&self) -> Color {
        match self {
            ItemType::HealthPotion => RED,
            ItemType::ManaPotion => BLUE,
            ItemType::FullRestore => GOLD,
        }
    }
}

/// Item dans l'inventaire
#[derive(Debug, Clone)]
pub struct InventoryItem {
    pub item_type: ItemType,
    pub quantity: u32,
}

impl InventoryItem {
    pub fn new(item_type: ItemType, quantity: u32) -> Self {
        InventoryItem { item_type, quantity }
    }
}

/// Inventaire du joueur
#[derive(Debug, Clone)]
pub struct Inventory {
    pub items: Vec<InventoryItem>,
}

impl Inventory {
    pub fn new() -> Self {
        Inventory {
            items: vec![
                InventoryItem::new(ItemType::HealthPotion, 5),
                InventoryItem::new(ItemType::ManaPotion, 5),
                InventoryItem::new(ItemType::FullRestore, 2),
            ],
        }
    }

    pub fn get_item_count(&self, item_type: ItemType) -> u32 {
        self.items
            .iter()
            .find(|item| item.item_type == item_type)
            .map(|item| item.quantity)
            .unwrap_or(0)
    }

    pub fn use_item(&mut self, item_type: ItemType) -> bool {
        if let Some(item) = self.items.iter_mut().find(|i| i.item_type == item_type) {
            if item.quantity > 0 {
                item.quantity -= 1;
                return true;
            }
        }
        false
    }

    pub fn add_item(&mut self, item_type: ItemType, quantity: u32) {
        if let Some(item) = self.items.iter_mut().find(|i| i.item_type == item_type) {
            item.quantity += quantity;
        } else {
            self.items.push(InventoryItem::new(item_type, quantity));
        }
    }
}
