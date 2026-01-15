use crate::entities::Enemy;

pub struct TurnSystem {
    /// Stores (ID, Speed).
    pub turn_queue: Vec<(String, u32)>,
    pub current_turn_index: usize,
    pub current_turn_id: String,
}

impl TurnSystem {
    pub fn new() -> Self {
        Self {
            turn_queue: Vec::new(),
            current_turn_index: 0,
            current_turn_id: String::new(),
        }
    }

    pub fn init_queue(
        &mut self,
        player_id: &str,
        player_speed: u32,
        other_players: &std::collections::HashMap<String, crate::network_client::RemotePlayer>,
        enemies: &[Enemy],
        boss: Option<&Enemy>,
    ) {
        self.turn_queue.clear();
        let mut participants: Vec<(String, u32)> = Vec::new();

        // 1. Add Player
        participants.push((player_id.to_string(), player_speed));

        // 2. Add Remote Players
        for rp in other_players.values() {
             // Estimate speed based on class string
             let rp_speed = match rp.class.to_lowercase().as_str() {
                "archer" => 120,
                "mage" => 100,
                "warrior" => 80,
                _ => 80,
            };
            participants.push((rp.userId.clone(), rp_speed));
        }

        // 3. Add Enemies
        for e in enemies {
            participants.push((e.id.clone(), e.speed as u32));
        }

        // 3.5. Add Boss
        if let Some(b) = boss {
            participants.push((b.id.clone(), b.speed as u32));
        }


        // 4. Sort by Speed (Desc), then by ID (Asc) for determinism
        participants.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));

        self.turn_queue = participants;
        self.current_turn_index = 0;
        
        if !self.turn_queue.is_empty() {
            self.current_turn_id = self.turn_queue[0].0.clone();
        } else {
            self.current_turn_id.clear();
        }
    }

    pub fn advance_turn(&mut self) -> bool {
        // Returns true if new round
        if self.turn_queue.is_empty() {
            return true;
        }

        self.current_turn_index += 1;
        if self.current_turn_index >= self.turn_queue.len() {
            // End of round
            self.current_turn_index = 0;
            if !self.turn_queue.is_empty() {
                self.current_turn_id = self.turn_queue[0].0.clone();
            }
            return true; // Start new round
        } else {
            self.current_turn_id = self.turn_queue[self.current_turn_index].0.clone();
            return false;
        }
    }
    
    pub fn get_current_id(&self) -> &str {
        &self.current_turn_id
    }

    pub fn peek_next_id(&self) -> String {
        if self.turn_queue.is_empty() { return String::new(); }
        let next_idx = if self.current_turn_index + 1 >= self.turn_queue.len() {
            0
        } else {
            self.current_turn_index + 1
        };
        self.turn_queue[next_idx].0.clone()
    }

    /// Dynamically updates the speed of an entity.
    /// If the entity is yet to act in this round, the queue is re-sorted to reflect the new speed.
    pub fn update_speed(&mut self, entity_id: &str, new_speed: u32) {
        // 1. Find the entity
        let mut entity_idx = None;
        for (idx, (id, _speed)) in self.turn_queue.iter().enumerate() {
            if id == entity_id {
                entity_idx = Some(idx);
                break;
            }
        }

        if let Some(idx) = entity_idx {
            // Update Speed
            self.turn_queue[idx].1 = new_speed;

            // 2. If this entity is in the "future" (or is the current one but we want to know if it drops back?),
            // typically we only re-order the FUTURE list to see who goes next.
            // Current actor usually finishes their turn regardless of speed change during their turn.
            
            // Re-sort the future part of the queue (current_index + 1 .. end)
            if self.current_turn_index + 1 < self.turn_queue.len() {
                let start_sort = self.current_turn_index + 1;
                let future_slice = &mut self.turn_queue[start_sort..];
                future_slice.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
            }
            
            // Note: If the updated entity was at `idx` and `idx > current_turn_index`, 
            // it is part of the sort and will move to its correct place in the future list.
            // If it was in the past (already acted), it stays in history until next round init.
        }
    }

    pub fn log_state(&self) {
        println!("📊 --- TURN QUEUE STATE (Idx: {}) ---", self.current_turn_index);
        for (i, (id, speed)) in self.turn_queue.iter().enumerate() {
            let marker = if i == self.current_turn_index { "👉" } else { "  " };
            println!("{} [{}] ID: {} | SPD: {}", marker, i, id, speed);
        }
        println!("--------------------------------------");
    }
}

