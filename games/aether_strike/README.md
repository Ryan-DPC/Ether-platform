# 🎮 Aether Strike - RPG Stick War

Un jeu RPG de type "Stick War" au **tour par tour** développé en **Rust** avec **Macroquad**.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Rust](https://img.shields.io/badge/rust-1.70+-orange)
![Framework](https://img.shields.io/badge/framework-Macroquad-green)

---

## 🚀 Pourquoi Macroquad au lieu de Bevy / Raylib ?

**Bevy** ne compile pas sur les ordinateurs de cours à cause de l'erreur **OS error 32** (fichiers verrouillés par l'antivirus/Windows Defender).

**Raylib** nécessite **libclang** (dépendance C++) qui peut être bloquée.

**Macroquad** est la solution parfaite :
- ✅ **100% Rust** - aucune dépendance C/C++
- ✅ Compile en **quelques secondes** (au lieu de plusieurs minutes)
- ✅ Fonctionne **partout**, même sur les ordinateurs ultra-verrouillés
- ✅ Parfait pour les jeux 2D
- ✅ API ultra-simple et intuitive

---

## 📋 Prérequis

- **Rust** (version 1.70+ recommandée)
- **C'est tout !** Aucune dépendance système requise 🎉

---

## 🏗️ Installation

### 1️⃣ Nettoyer l'ancien build (si nécessaire)

```powershell
cargo clean
```

### 2️⃣ Compiler le jeu

```powershell
cargo build
```

### 3️⃣ Lancer le jeu

```powershell
cargo run
```

### 4️⃣ (Optionnel) Compiler en mode release (meilleure performance)

```powershell
cargo run --release
```

---

## 🎮 Caractéristiques

### ⚔️ **Combat au Tour par Tour**
- Combat tactique non automatique (sauf si auto-attack activé)
- 10 attaques disponibles avec coûts en mana différents
- Système intelligent de calcul de dégâts

### 🗡️ **3 Classes Jouables**
| Classe | HP | MP | Style |
|--------|----|----|-------|
| **Warrior** ⚔️ | 150 | 50 | Tank / Melee DPS |
| **Mage** 🔮 | 80 | 150 | Ranged DPS / Caster |
| **Archer** 🏹 | 100 | 100 | Balanced DPS |

### ⚡ **Système de Passifs**
Chaque classe possède **3 passifs uniques** :
- Bonus de dégâts
- Réduction de dégâts
- Vol de vie
- Coups critiques
- Régénération de mana

### 🎒 **Inventaire & Items**
- **Health Potion** (❤️) : Restore 50 HP
- **Mana Potion** (💙) : Restore 30 MP
- **Full Restore** (✨) : Restore ALL HP & MP
- Quantités limitées (gestion stratégique)

### 🤖 **Auto-Attack**
- Checkbox cliquable pour activer/désactiver
- Attaque automatique toutes les 1.5 secondes
- Idéal pour le farming

### 💰 **Système de Progression**
- **+5 Gold** par ennemi tué
- **+10 Score** par ennemi tué
- Les ennemis respawn infiniment

---

## 🎮 Contrôles

### **Menu Principal**
- **ATTACK** → Affiche 10 attaques disponibles
- **BAG** → Ouvre l'inventaire (potions)
- **FLEE** → Fuite (à venir)
- **PASSIF** → Affiche les passifs actifs

### **Combat**
- **Clic gauche** sur une attaque → Attaque l'ennemi
- **Clic gauche** sur un item → Utilise l'item
- **ESC** → Retour au menu principal

### **Auto-Attack**
- **Clic** sur la checkbox en haut à droite

---

## 📁 Structure du projet

```
aether_strike/
├── Cargo.toml              # Dépendances Macroquad
├── README.md               # Ce fichier
├── GAME_GUIDE.md           # Guide complet du jeu
├── src/
│   ├── main.rs             # Point d'entrée
│   ├── game.rs             # État du jeu (resources, classes, etc.)
│   ├── class_system.rs     # Système de classes et passifs
│   ├── inventory.rs        # Inventaire et items
│   ├── entities/           # Entités du jeu
│   │   ├── mod.rs
│   │   ├── stick_figure.rs # Joueur
│   │   └── enemy.rs        # Ennemis
│   ├── systems/            # Systèmes de jeu
│   │   ├── mod.rs
│   │   ├── combat.rs       # Système de combat
│   │   ├── movement.rs     # Déplacement (legacy)
│   │   └── spawner.rs      # Spawn ennemis (legacy)
│   └── ui/                 # Interface utilisateur
│       ├── mod.rs
│       ├── hud.rs          # HUD (legacy)
│       ├── buttons.rs      # Boutons (legacy)
│       ├── combat_menu.rs  # Menu de combat
│       └── bag_passif.rs   # Interface bag/passifs
└── target/                 # Fichiers compilés
```

---

## 🛠️ Développement

### Compiler en mode debug (plus rapide)

```powershell
cargo build
```

### Compiler en mode release (optimisé)

```powershell
cargo build --release
```

### Vérifier le code sans compiler

```powershell
cargo check
```

---

## 📚 Documentation

Pour plus de détails sur les classes, passifs, items et mécaniques de combat, consultez le **[GAME_GUIDE.md](./GAME_GUIDE.md)**.

---

## 📝 Notes

- Le jeu utilise **Macroquad 0.4** (framework 100% Rust)
- Temps de compilation : **~5-15 secondes** (au lieu de 5-10 minutes avec Bevy)
- FPS cible : **60 FPS**
- Aucune dépendance C/C++ nécessaire

### Classe Par Défaut
Actuellement, le jeu démarre avec la classe **Warrior** par défaut.  
Un menu de sélection de classe sera ajouté prochainement.

---

## 📌 Prochaines étapes

- [ ] Menu de sélection de classe
- [ ] Plus de types d'ennemis
- [ ] Combats contre des boss
- [ ] Système d'équipement
- [ ] Arbres de compétences
- [ ] Multi-farming (plusieurs joueurs)
- [ ] Système de vagues avec difficulté croissante

---

## 🐛 Résolution de problèmes

### ❌ Erreur : "failed to write ... os error 32"

**Solution :**
1. Fermer VS Code et tous les terminaux
2. Ouvrir le **Gestionnaire des tâches** → **Détails**
3. Terminer tous les processus `cargo.exe`, `rustc.exe`, `cc.exe`
4. Supprimer le dossier `target` :
   ```powershell
   Remove-Item -Recurse -Force .\target
   ```
5. Relancer `cargo build`

### ❌ Le jeu ne se lance pas

**Solution :**
1. Vérifier que Rust est installé : `rustc --version`
2. Nettoyer et recompiler :
   ```powershell
   cargo clean
   cargo build --release
   cargo run --release
   ```

---

## � Licence

Projet personnel - Ether Platform

---

## 🤝 Contribution

Ce projet est développé dans le cadre de la plateforme Ether.  
Pour toute question ou suggestion, n'hésitez pas à ouvrir une issue.

---

**Développé avec ❤️ en Rust + Macroquad**

🎮 **Bon jeu !** 🎮

