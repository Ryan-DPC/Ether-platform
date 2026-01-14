# Mage

**Role**: Ranged DPS / Caster
**Sprite**: `character/sprites/mage.png`
**Max Level**: 200

## 📊 Base Stats (Level 1)

- **HP**: 100
- **Mana**: 150
- **Speed**: 1.0
- **Def**: 5

## ⚔️ Skill List (20 Total)

| ID  | Name                | Type               | Unlock | Cost | Base Dmg | Description                                        |
| :-- | :------------------ | :----------------- | :----: | :--: | :------: | :------------------------------------------------- |
| 1   | **Firebolt**        | Basic              |   1    |  5   |    10    | Fire damage. Small chance to Burn.                 |
| 2   | **Ice Shard**       | CC                 |   1    |  5   |    8     | Ice damage. Slows target by 20%.                   |
| 3   | **Mana Shield**     | Buff               |   5    |  20  |    0     | Absorb 50% damage using Mana for 3 turns.          |
| 4   | **Arcane Missiles** | Burst              |   8    |  15  |    15    | Hits 3 random targets for 5 dmg each.              |
| 5   | **Scorch**          | DoT                |   12   |  20  |    5     | Burns target for 8 dmg/turn (3 turns).             |
| 6   | **Frost Nova**      | AoE CC             |   18   |  30  |    10    | Freezes all nearby enemies for 1 turn.             |
| 7   | **Blink**           | Utility            |   25   |  25  |    0     | Teleport away from danger. +50% Evasion.           |
| 8   | **Fireball**        | AoE                |   35   |  40  |    35    | High damage to target and 50% to adjacent.         |
| 9   | **Polymorph**       | CC                 |   45   |  50  |    0     | Turns enemy into a sheep for 2 turns (No actions). |
| 10  | **Counterspell**    | Interrupt          |   60   |  35  |    10    | Interrupts enemy spell casting.                    |
| 11  | **Ice Barrier**     | Defense            |   80   |  60  |    0     | Ignore next incoming attack completely.            |
| 12  | **Blizzard**        | AoE                |  100   |  80  |    45    | Massive Ice damage to all enemies + Slow.          |
| 13  | **Pyroblast**       | Nuke               |  125   | 100  |   100    | Massive Fire damage (1 turn cast time).            |
| 14  | **Time Warp**       | Support            |  160   | 120  |    0     | All allies gain +50% Speed for 2 turns.            |
| 15  | **Apocalypse**      | Nuke               |  190   | 150  |   200    | Deals damage to all enemies equal to 20% max HP.   |
| 16  | **Fire Form**       | **Active Passive** |   10   |  0   |    -     | +20% Fire DMG, +10% Burn Chance. Toggle.           |
| 17  | **Ice Form**        | **Active Passive** |   10   |  0   |    -     | +20% Ice DMG, +10% Slow Potency. Toggle.           |
| 18  | **Arcane Form**     | **Active Passive** |   10   |  0   |    -     | +50% Mana Regen, +10% CDR. Toggle.                 |
| 19  | **Meteor Swarm**    | **Ultimate**       |   50   | 150  |    -     | Calls 3 Meteors (100 Dmg each) on random targets.  |
| 20  | **Absolute Zero**   | **Ultimate**       |   50   | 150  |    -     | Freezes ALL enemies for 2 turns (Unbreakable).     |

> **Note**:
>
> - **Active Passive**: Only 1 active at a time.
> - **Ultimate**: Mutually exclusive choice in Skill Tree (Node A vs Node B).
