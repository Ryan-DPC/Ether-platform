# Archer

**Role**: Ranged DPS / Mobile
**Sprite**: `character/sprites/archer.png`
**Max Level**: 200

## 📊 Base Stats (Level 1)

- **HP**: 120
- **Mana**: 80 (Focus)
- **Speed**: 1.2 (Fast)
- **Def**: 7

## ⚔️ Skill List (20 Total)

| ID  | Name                | Type               | Unlock | Cost | Base Dmg | Description                                        |
| :-- | :------------------ | :----------------- | :----: | :--: | :------: | :------------------------------------------------- |
| 1   | **Quick Shot**      | Basic              |   1    |  0   |    9     | Fast arrow shot. Low cooldown.                     |
| 2   | **Poison Tip**      | DoT                |   1    |  10  |    4     | Apply Poison (4 dmg/turn for 3 turns).             |
| 3   | **Disengage**       | Mobility           |   5    |  15  |    5     | Jump back and deal small damage.                   |
| 4   | **Multishot**       | AoE                |   8    |  20  |    12    | Fire 3 arrows at random targets.                   |
| 5   | **Piercing Shot**   | Line AoE           |   12   |  25  |    15    | Hits all enemies in a line.                        |
| 6   | **Trap**            | CC                 |   18   |  30  |    10    | Place a trap. Roots first enemy to step on it.     |
| 7   | **Hawk Eye**        | Buff               |   25   |  25  |    0     | +20% Crit Chance for 3 turns.                      |
| 8   | **Snipe**           | Burst              |   35   |  40  |    70    | High damage shot. High Crit Dmg multiplier.        |
| 9   | **Volley**          | AoE                |   45   |  50  |    25    | Rain arrows on a selected area.                    |
| 10  | **Silence Shot**    | Debuff             |   60   |  35  |    15    | Silences target for 2 turns.                       |
| 11  | **Camouflage**      | Stealth            |   80   |  40  |    0     | Become invisible for 2 turns (Bonus dmg on exit).  |
| 12  | **Explosive Arrow** | AoE                |  100   |  60  |    50    | Explodes on impact, hitting adjacent foes.         |
| 13  | **Killer Instinct** | Buff               |  125   |  50  |    0     | Reset all cooldowns on kill.                       |
| 14  | **Rapid Fire**      | Burst              |  160   |  80  |    15    | Fire 5 arrows in quick succession at one target.   |
| 15  | **Headshot**        | Execute            |  190   | 100  |   150    | Instantly kills non-bosses under 20% HP.           |
| 16  | **Eagle Stance**    | **Active Passive** |   10   |  0   |    -     | +2 Range, +10% Crit. Toggle.                       |
| 17  | **Cobra Stance**    | **Active Passive** |   10   |  0   |    -     | +30% Poison Dmg. Toggle.                           |
| 18  | **Wolf Stance**     | **Active Passive** |   10   |  0   |    -     | +20% Speed, +10% Evasion. Toggle.                  |
| 19  | **Rain of Death**   | **Ultimate**       |   50   | 120  |    -     | Massive Arrow Storm over entire field.             |
| 20  | **Phantom Ranger**  | **Ultimate**       |   50   | 120  |    -     | Summon a clone that mimics your attacks (3 turns). |

> **Note**:
>
> - **Active Passive**: Only 1 active at a time.
> - **Ultimate**: Mutually exclusive choice in Skill Tree (Node A vs Node B).
