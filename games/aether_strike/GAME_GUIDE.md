# 🎮 Aether Strike - Game Guide

## 📖 Table of Contents
- [Classes](#classes)
- [Passifs](#passifs)
- [Items & Inventory](#items--inventory)
- [Combat System](#combat-system)
- [Controls](#controls)

---

## 🗡️ Classes

### **Warrior** ⚔️
**Type:** Tank / Melee DPS  
**Couleur:** Rouge

| Stat | Value |
|------|-------|
| **HP** | 150 |
| **MP** | 50 |
| **Style** | Close combat, high survivability |

**Strengths:**
- High HP pool
- Damage reduction
- Life steal capabilities

**Weaknesses:**
- Low mana pool
- Limited spell usage

---

### **Mage** 🔮
**Type:** Ranged DPS / Caster  
**Couleur:** Bleu

| Stat | Value |
|------|-------|
| **HP** | 80 |
| **MP** | 150 |
| **Style** | Spell caster, high burst damage |

**Strengths:**
- Highest mana pool
- High spell damage
- Critical hits
- Fast mana regeneration

**Weaknesses:**
- Low HP
- Fragile in close combat

---

### **Archer** 🏹
**Type:** Balanced DPS  
**Couleur:** Vert

| Stat | Value |
|------|-------|
| **HP** | 100 |
| **MP** | 100 |
| **Style** | Balanced, precision strikes |

**Strengths:**
- Balanced stats
- High critical chance
- Good evasion
- Versatile playstyle

**Weaknesses:**
- Jack of all trades, master of none

---

## ⚡ Passifs

### **Warrior Passives**

#### 🛡️ Iron Skin
- **Effect:** Reduce incoming damage by **15%**
- **Type:** Defensive
- **Description:** Your skin becomes as hard as iron, reducing all damage taken

#### ⚔️ Berserker
- **Effect:** Increase all damage dealt by **20%**
- **Type:** Offensive
- **Description:** Channel your inner rage to deal devastating blows

#### 💉 Life Drain
- **Effect:** Heal **10%** of damage dealt
- **Type:** Sustain
- **Description:** Absorb the life force of your enemies with each strike

---

### **Mage Passives**

#### 🔥 Arcane Focus
- **Effect:** Increase spell damage by **25%**
- **Type:** Offensive
- **Description:** Master the arcane arts to amplify your magical power

#### 💠 Mana Flow
- **Effect:** +**10 MP/sec** regeneration
- **Type:** Resource
- **Description:** Channel ambient mana to restore your power faster

#### 💥 Critical Mind
- **Effect:** **15%** chance for critical hits (x2 damage)
- **Type:** Offensive
- **Description:** A focused mind finds weak points in enemy defenses

---

### **Archer Passives**

#### 🎯 Precision
- **Effect:** **20%** chance for critical hits (x2 damage)
- **Type:** Offensive
- **Description:** Years of training allow you to hit vital spots

#### ⚡ Swift Arrows
- **Effect:** Increase damage by **15%**
- **Type:** Offensive
- **Description:** Your arrows fly faster and hit harder

#### 🌪️ Evasion
- **Effect:** Reduce incoming damage by **10%**
- **Type:** Defensive
- **Description:** Nimble footwork helps you avoid the worst of enemy attacks

---

## 🎒 Items & Inventory

### **Starting Inventory**
Each character starts with:
- **5x** Health Potion
- **5x** Mana Potion
- **2x** Full Restore

---

### **Health Potion** ❤️
| Property | Value |
|----------|-------|
| **Effect** | Restore **50 HP** |
| **Type** | Consumable |
| **Cooldown** | None (instant) |
| **Stack Limit** | 99 |

**Usage:** Use during combat to quickly recover health

---

### **Mana Potion** 💙
| Property | Value |
|----------|-------|
| **Effect** | Restore **30 MP** |
| **Type** | Consumable |
| **Cooldown** | None (instant) |
| **Stack Limit** | 99 |

**Usage:** Use when running low on mana to continue casting spells

---

### **Full Restore** ✨
| Property | Value |
|----------|-------|
| **Effect** | Restore **ALL HP & MP** |
| **Type** | Consumable (Rare) |
| **Cooldown** | None (instant) |
| **Stack Limit** | 99 |

**Usage:** Emergency item - fully restores both health and mana

---

## ⚔️ Combat System

### **Turn-Based Combat**
1. **Your Turn:** Select an attack or use an item
2. **Enemy Turn:** Enemy attacks automatically
3. **Repeat** until one combatant falls

### **Damage Calculation**
```
Final Damage = Base Damage × (1 + Damage Passifs) × (Critical ? 2.0 : 1.0)
Damage Taken = Enemy Damage × (1 - Defense Passifs)
Life Steal = Final Damage × Life Steal %
```

### **Attack System**
- **10 available attacks** with varying damage and mana costs
- Attacks consume **mana**
- Can't attack if mana is insufficient

### **Auto-Attack Mode** ☑️
- Enable via checkbox in top-right corner
- Automatically uses the first attack every **1.5 seconds**
- Requires sufficient mana
- Enemy retaliates after each attack

### **Enemy Mechanics**
- Enemies attack automatically after your turn
- Deal **10 damage** per hit
- Respawn immediately upon death
- Each kill grants **5 gold** and **10 score**

### **Mana Regeneration**
- Base: **5 MP/sec**
- Mage bonus: **+10 MP/sec** (total 15 MP/sec)
- Affected by Mana Flow passive

---

## 🎮 Controls

### **Mouse Controls**
| Action | Control |
|--------|---------|
| **Select Attack** | Click on attack button |
| **Use Item** | Click on item button |
| **Toggle Auto-Attack** | Click checkbox (top-right) |
| **Open Menu** | Click menu button (ATTACK/BAG/FLEE/PASSIF) |

### **Keyboard Controls**
| Key | Action |
|-----|--------|
| **ESC** | Return to main menu |

### **Menu Navigation**
- **ATTACK** → View and select from 10 attacks
- **BAG** → Use consumable items
- **FLEE** → (Not implemented yet)
- **PASSIF** → View active passive abilities

---

## 📊 Character Comparison

| Class | HP | MP | Best At | Playstyle |
|-------|----|----|---------|-----------|
| **Warrior** | 150 | 50 | Survivability | Tank, sustain through combat |
| **Mage** | 80 | 150 | Burst Damage | Glass cannon, high risk/reward |
| **Archer** | 100 | 100 | Consistency | Balanced, reliable damage |

---

## 💡 Strategy Tips

### **For Warriors:**
- Use Life Drain to sustain in long fights
- Iron Skin makes you very tanky - be aggressive
- Conserve mana - you have a small pool

### **For Mages:**
- Leverage high mana pool for sustained DPS
- Critical Mind makes you unpredictable
- Keep distance (metaphorically) and burst enemies down
- Mana Flow means you can spam attacks

### **For Archers:**
- High crit chance = consistent damage spikes
- Balanced stats allow for flexible gameplay
- Evasion + precision = win battles through skill
- Best for auto-attack farming

---

## 🏆 Progression

### **Gold System**
- **+5 gold** per enemy killed
- Gold accumulates (future use: shop, upgrades)

### **Score System**
- **+10 score** per enemy killed
- Track your performance

### **Enemy Waves**
- Enemies respawn infinitely
- Each kill strengthens you (gold accumulation)
- See how long you can survive!

---

## 🔮 Future Features

Coming soon:
- Multiple enemy types
- Boss battles
- Equipment system
- Skill trees
- Multiplayer (Multi-farming)
- Class selection screen

---

**Developed with ❤️ using Rust + Macroquad**
