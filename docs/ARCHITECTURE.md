# 🏗 Vext Platform Architecture

This document outlines the technical design of the **Aether Strike** game client.

## 🔄 Core Loop (`main.rs`)

The game runs on a loop managed by **Macroquad**.
1. **Input Handling**: Detects mouse/keyboard events.
2. **Update**: modifying `current_state` (Game, Menu, Battle).
3. **Draw**: Renders UI and Sprites based on state.

## ⚔️ Combat System

The combat system is **stateless logic** mixed with **stateful entites**.

### Turn System (`modules/turn.rs`)
- Uses an **Accumulator** model for speed.
- Each tick, character `Speed` is added to their `AV` (Action Value).
- First formatted to reach 100 AV takes the turn.
- **Handling Deaths**: The Turn System automatically filters out entities with <= 0 HP.

### Skill & Effect System (`class_system.rs` + `modules/effect.rs`)
- **Skills** are data-driven (loaded from Markdown).
- **Effects** are abstract structs (`Heal`, `Damage`, `Buff`).
- **Parsing**: `Skill::get_effects()` converts text descriptions into actionable implementation structs.

### Targeting Flow
1. **User clicks Skill** -> UI State sets to `Targeting(skill_id)`.
2. **User clicks Target** -> HUD returns `UseAttack(skill, target_id)`.
3. **Main Loop** -> Resolves logic:
    - If **Single Target**: Apply to `target_id`.
    - If **AoE**: Search `_enemies` list for `index`, `index-1`, and `index+1`.

## 📦 Data & Assets

- **Classes**: Defined in `games/aether_strike/assets/character/**/*.md`.
- **Parsing Strategy**: We use line-by-line scanning to extract `**Key:** Value` pairs.

## 🌐 Networking

- Uses a `TcpStream` wrapper (`network_client.rs`).
- **Protocol**: JSON-serialized messages (`GameEvent`).
- **Sync**: The client sends actions (`Attack`), server validates and broadcasts `GameState` updates.
