# Aether Strike - Intégration Relay Multiplayer 

## ✅ CE QUI EST FAIT

### Backend Relay Server
- `apps/backend/src/features/aether-strike/aether-strike.socket.ts` : Handler WebSocket complet
- Gestion des rooms multijoueur
- Relay des inputs player en temps réel
- Gestion dégâts/attaques
- Cleanup automatique

### Client Rust
- `games/aether_strike/src/network_client.rs` : Client WebSocket threadé
- Architecture non-bloquante avec channels
- Auto-join avec token JWT
- API simple : `connect()`, `send_input()`, `poll_updates()`

### Intégration Partielle
- Variables ajoutées dans main.rs :
  - `game_client: Option<GameClient>`
  - `other_players: HashMap<String, (f32, f32)>`
  - `vext_token` sauvegardé

## 📝 TODO: Intégration Finale

### 1. Bouton REFRESH (menu_ui.rs ou menu_system.rs)

Ajouter dans `draw_session_list()`:

```rust
// Bouton REFRESH sous le titre
let refresh_btn = MenuButton::new("REFRESH", x + 720, y + 10, 120, 40);
if refresh_btn.is_hovered() {
    // Highlight
}
if refresh_btn.is_clicked() {
    // Call network_api::fetch_server_list()
    *sessions = fetch_server_list().iter().map(|lobby| {
        SessionButton::new_from_lobby(lobby)
    }).collect();
}
```

### 2. Connexion WebSocket lors de CREATE SERVER

Dans `main.rs`, chercher le code qui fait `announce_server()` et ajouter juste après :

```rust
// Après announce_server()
if let Some(lobby_id) = lobby_id {
    match GameClient::connect(
        "wss://vext-backend.onrender.com/ws",
        &vext_token,
        lobby_id.clone(),
        selected_class.unwrap().name().to_string()
    ) {
        Ok(client) => {
            game_client = Some(client);
            println!("✅ Connected to relay server!");
        }
        Err(e) => {
            eprintln!("❌ Failed to connect: {}", e);
        }
    }
}
```

### 3. Connexion WebSocket lors de JOIN SERVER

Même chose quand on double-clic sur une session :

```rust
// Dans le code de join
if let Some(session) = selected_session {
    let lobby_id = sessions[session].data.id.clone();
    
    match GameClient::connect(
        "wss://vext-backend.onrender.com/ws",
        &vext_token,
        lobby_id,
        selected_class.unwrap().name().to_string()
    ) {
        Ok(client) => {
            game_client = Some(client);
            current_screen = GameScreen::Lobby; // ou InGame
        }
        Err(e) => {
            eprintln!("❌ Join failed: {}", e);
        }
    }
}
```

### 4. Envoi Inputs dans la Boucle de Jeu

Dans `GameScreen::InGame`, envoyer les inputs chaque frame :

```rust
if let Some(client) = &game_client {
    // Envoyer ma position
    client.send_input(
        (player.position.x, player.position.y),
        (player.velocity.x, player.velocity.y),
        player.current_action.clone()
    );
    
    // Recevoir updates
    for event in client.poll_updates() {
        match event {
            GameEvent::PlayerUpdate(update) => {
                if let Some(pos) = update.position {
                    other_players.insert(update.player_id, pos);
                }
            }
            GameEvent::PlayerJoined { player_id, username } => {
                println!("👋 {} joined!", username);
            }
            GameEvent::PlayerLeft { player_id } => {
                other_players.remove(&player_id);
            }
            _ => {}
        }
    }
}
```

### 5. Dessiner les Autres Joueurs

```rust
// Render autres joueurs
for (player_id, (x, y)) in &other_players {
    draw_circle(*x, *y, 15.0, RED);
    draw_text(
        &format!("Player {}", &player_id[..4]), 
        *x - 20.0, 
        *y - 25.0, 
        16.0, 
        WHITE
    );
}
```

### 6. Cleanup lors de la Déconnexion

```rust
// Quand on quitte le jeu ou retourne au menu
if let Some(client) = &game_client {
    client.disconnect();
}
game_client = None;
other_players.clear();
```

## 🚀 Test Final

1. Rebuild le jeu : `cargo build --release`
2. Lance depuis VEXT avec 2 comptes
3. Compte 1 : Crée un serveur
4. Compte 2 : REFRESH → Voit le serveur → Join
5. Les deux joueurs se voient bouger en temps réel !

## 🌐 URLs

Backend relay: `wss://vext-backend.onrender.com/ws`  
(ou `ws://localhost:3000/ws` pour dev local)
