# Vext Game Integration Standard

This document outlines the requirements for games to be compatible with the Vext Launcher and Ecosystem.

## 1. Game Manifest (`manifest.json`)

Every game must include a `manifest.json` at the root of its installation folder.

```json
{
  "id": "game_unique_id", // Must match DB ID or unique slug
  "name": "Game Name",
  "version": "1.0.0",
  "executable": "Game.exe", // or "start.sh", relative path
  "args": [] // Optional default args
}
```

## 2. Launch Arguments

The Vext Launcher passes the following command-line arguments when starting a game. The game MUST verify these to authenticate the user and connect to the correct environment.

| Argument         | Description                               | Example                               |
| ---------------- | ----------------------------------------- | ------------------------------------- |
| `--vext-user-id` | The Vext Username/ID of the player        | `PlayerOne`                           |
| `--vext-token`   | JWT Token for Backend Authentication      | `eyJhbGci...`                         |
| `--vext-friends` | Comma-separated list of friends & status  | `Friend1:online,Friend2:offline`      |
| `--vext-gateway` | (Optional) URL of the Game Server/Gateway | `wss://vext-game-server.onrender.com` |

**Code Example (Node.js):**

```javascript
const args = process.argv.slice(2);
const userId = args[args.indexOf('--vext-user-id') + 1];
const token = args[args.indexOf('--vext-token') + 1];
```

## 3. Game Server Integration (Dedicated Server)

For multiplayer games using the Vext Dedicated Server infrastructure.

### Connection

- **Protocol**: WebSocket (Socket.io or Native WS)
- **URL**: Provided via config or `--vext-gateway` (Default: `ws://localhost:3002` Dev, `wss://vext-game-server.onrender.com` Prod).

### Authentication Handshake

Upon connecting, the game client MUST send an authentication event.

**Event**: `auth`
**Payload**:

```json
{
  "token": "TOKEN_RECEIVED_FROM_LAUNCHER"
}
```

**Server Response**: `auth:success` or `auth:fail`.

### Gameplay Standards (Turn-Based Example)

1.  **Lobby Creation**: Client emits `lobby:create`.
2.  **Lobby Join**: Client emits `lobby:join` with `lobbyId`.
3.  **Game State**: The Server is AUTHORITY. Do not trust client calculations for Game End/Score.
    - Client sends: `game:move` { action: "attack", target: "p2" }
    - Server validates -> Updates State -> Broadcasts `game:update` (containing `turn`, `scores`, `lastAction`).

### Reporting Results (Match End)

When the game ends (determined by Server), the **Server** (not Client) must report results to Vext Backend.

**Endpoint**: `POST /api/games/match/end` (Vext Backend)
**Headers**: `Authorization: Bearer SERVER_SERVICE_TOKEN`
**Payload**:

```json
{
  "gameId": "game_id",
  "lobbyId": "lobby_123",
  "results": [
    { "userId": "PlayerOne", "score": 100, "result": "win", "rewards": { "xp": 50 } },
    { "userId": "PlayerTwo", "score": 50, "result": "loss", "rewards": { "xp": 10 } }
  ]
}
```

## 4. Performance & Optimization (Server)

To ensure lag-free experience:

1.  **Authoritative State**: Server holds the `GameState` object. Clients only render state.
2.  **Tick Rate**: For real-time games, implement a server tick (e.g., 20Hz-60Hz) rather than simple event usage.
    ```javascript
    setInterval(() => {
      updatePhysics();
      broadcastState();
    }, 1000 / 60); // 60 times per second
    ```
3.  **Low Latency**: Deploy Game Server geographically close to players (e.g., enable Render Regions).
4.  **Reconnection**: Handle `disconnect` events gracefully. Allow players to reconnect to `lobbyId` if session is active.
5.  **Environment Variables**:
    - `PORT`: Dynamic
    - `BACKEND_URL`: URL to Vext Backend
    - `JWT_SECRET`: For validating tokens locally (faster than API call)
