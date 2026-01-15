# ⚔️ Aether Strike - Developer Guide

This directory contains the source code for the **Aether Strike** client.

## 📋 Prerequisites

Before running the game, ensure you have:
- **Rust Toolchain**: Install via [rustup.rs](https://rustup.rs/).
- **Cargo**: Included with Rust.

## 🏃‍♀️ How to Run

1. **Navigate to the game directory**:
   ```bash
   cd games/aether_strike
   ```

2. **Run in Development Mode**:
   ```bash
   cargo run
   ```

3. **Run Release Build** (Optimized):
   ```bash
   cargo run --release
   ```

## 🎮 Controls

- **Mouse**: UI Interaction (Skills, Targeting).
- **Keyboard**: Text input (Username).

## 🏗 Project Architecture

### Modules (`src/modules/`)
- **`turn.rs`**: Manages the Turn Queue, Speed calculations, and Round resets.
- **`effect.rs`**: Defines generic combat effects (Heal, Buff, Damage) used by Skills.
- **`button.rs`**: UI Component logic.
- **`character.rs`** & **`class_system.rs`**: Loads logic from `assets/character/*.md`.

### Assets
Assets are located in `assets/`.
- **Characters**: Defined in Markdown files (e.g., `assets/character/tank/melee/paladin.md`).
- **Sprites**: PNG files loaded by `assets.rs`.

## 🐛 Common Issues

- **"Filename too long"**: If you are on Windows, run `git config core.longpaths true`.
- **Assets not found**: Ensure you launch the game from the `games/aether_strike` folder, NOT the root folder, so relative paths resolve correctly.

