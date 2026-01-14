# Warrior

**Role**: Tank / Melee DPS
**Sprite**: `character/sprites/warrior.png`
**Max Level**: 200

## 📊 Base Stats (Level 1)

- **HP**: 150
- **Mana**: 50
- **Speed**: 1.0 (Normal)
- **Def**: 10

## ⚔️ Skill List (20 Total)

| ID  | Name                  | Type               | Unlock | Cost | Base Dmg | Description                                    |
| :-- | :-------------------- | :----------------- | :----: | :--: | :------: | :--------------------------------------------- |
| 1   | **Slash**             | Basic              |   1    |  0   |    10    | Basic sword slash. Generates 5 Rage (Mana).    |
| 2   | **Shield Bash**       | CC                 |   1    |  10  |    5     | Stuns target for 1 turn.                       |
| 3   | **Taunt**             | Aggro              |   5    |  15  |    0     | Forces enemy to attack you for 2 turns.        |
| 4   | **Rend**              | DoT                |   8    |  15  |    8     | Bleeds target for 5 dmg/turn (3 turns).        |
| 5   | **Charge**            | GapCloser          |   12   |  20  |    12    | Deal damage and gain priority next turn.       |
| 6   | **Cleave**            | AoE                |   18   |  25  |    15    | Hits 2 adjacent enemies.                       |
| 7   | **Iron Will**         | Buff               |   25   |  30  |    0     | Cleanses CC and +10 Def for 3 turns.           |
| 8   | **Execute**           | Finisher           |   35   |  40  |    60    | Double damage if target HP < 30%.              |
| 9   | **War Cry**           | AoE Buff           |   45   |  50  |    0     | +15% DMG to all allies for 2 turns.            |
| 10  | **Sunder Armor**      | Debuff             |   60   |  35  |    20    | Reduces target Def by 20% for 3 turns.         |
| 11  | **Shield Wall**       | Defense            |   80   |  60  |    0     | Reduces incoming DMG by 50% for 1 turn.        |
| 12  | **Blade Storm**       | AoE                |  100   |  80  |    40    | Hits all enemies 2 times.                      |
| 13  | **Mortal Strike**     | Anti-Heal          |  125   |  50  |    80    | High damage, prevents healing on target.       |
| 14  | **Last Stand**        | Survival           |  160   | 100  |    0     | Cannot die this turn. 1 HP min.                |
| 15  | **Godslayer**         | Nuke               |  190   | 120  |   200    | Massive single target damage.                  |
| 16  | **Berserker Stance**  | **Active Passive** |   10   |  0   |    -     | +20% DMG, -20% Def. Toggle.                    |
| 17  | **Juggernaut Stance** | **Active Passive** |   10   |  0   |    -     | +30% Def, +Aggro, -20% Speed. Toggle.          |
| 18  | **Commander Stance**  | **Active Passive** |   10   |  0   |    -     | Allies gain +5% Stats. You deal -10% Dmg.      |
| 19  | **Avatar of War**     | **Ultimate**       |   50   | 100  |    -     | Transform: Immune to CC, +50% Stats (3 Turns). |
| 20  | **Bastion of Iron**   | **Ultimate**       |   50   | 100  |    -     | Invincible (3 Turns), Taunt All.               |

> **Note**:
>
> - **Active Passive**: Only 1 active at a time.
> - **Ultimate**: Mutually exclusive choice in Skill Tree (Node A vs Node B).
