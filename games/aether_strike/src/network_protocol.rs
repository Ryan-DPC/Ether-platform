use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type", content = "data", rename_all = "kebab-case")]
pub enum ClientMessage {
    Auth { token: String },
    CreateGame { game_id: String, user_id: String, username: String, player_class: String, hp: f32, max_hp: f32 },
    JoinGame { game_id: String, user_id: String, username: String, player_class: String, hp: f32, max_hp: f32 },
    ChangeClass { class: String },
    StartGame { enemies: Vec<EnemyData> },
    UseAttack { target_id: Option<String>, attack_name: String, damage: f32, mana_cost: u32, is_area: bool },
    AdminAttack { target_id: String, attack_name: String, damage: f32, actor_id: String },
    EndTurn { next_turn_id: String },
    NextWave { enemies: Vec<EnemyData>, gold: u32, exp: u32 },
    GameOver { victory: bool },
    Input { x: f32, y: f32, vx: f32, vy: f32, anim: String },
    Flee,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type", content = "data", rename_all = "kebab-case")]
pub enum ServerMessage {
    NewHost { game_id: String, host_id: String },
    GameState { players: Vec<PlayerData>, state: String, host_id: String },
    PlayerJoined { player_id: String, username: String, class: String, hp: f32, max_hp: f32, speed: f32 },
    PlayerLeft { player_id: String },
    PlayerUpdated { player_id: String, class: String },
    GameStarted { enemies: Vec<EnemyData> },
    CombatAction { actor_id: String, target_id: Option<String>, action_name: String, damage: f32, mana_cost: u32, is_area: bool, target_new_hp: Option<f32> },
    TurnChanged { current_turn_id: String },
    WaveStarted { enemies: Vec<EnemyData>, gold: u32, exp: u32 },
    GameEnded { victory: bool },
    PlayerUpdate { player_id: String, position: Option<(f32, f32)>, animation: Option<String> }, // Movement
    Error(String),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PlayerData {
    pub user_id: String,
    pub username: String,
    pub class: String,
    pub hp: f32,
    pub max_hp: f32,
    pub speed: f32,
    pub position: (f32, f32),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EnemyData {
    pub id: String,
    pub name: String,
    pub hp: f32,
    pub max_hp: f32,
    pub speed: f32,
    pub position: (f32, f32),
}
