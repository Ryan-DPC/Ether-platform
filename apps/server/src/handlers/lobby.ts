import LobbyService from '../services/lobby.service';
import { WebSocketService } from '../services/websocket.service';
import { getWebSocketServer } from '../services/websocket.service';

export const handleLobbyMessage = async (ws: any, type: string, payload: any) => {
  const wsServer = getWebSocketServer();

  switch (type) {
    case 'createGame':
      if (!ws.data.name && !ws.data.username) {
        ws.send(
          JSON.stringify({
            type: 'error',
            data: { message: 'You must set your name before creating a game.' },
          })
        );
        return;
      }
      const code = LobbyService.createLobby(ws.id);
      ws.subscribe(code); // Join room

      const creatorName = ws.data.name || ws.data.username;
      console.log(`Game created by ${creatorName} with code: ${code}`);

      ws.send(
        JSON.stringify({
          type: 'gameCreated',
          data: { code, creator: creatorName, url: `/games/chessmulti/${code}` },
        })
      );
      break;

    case 'joinGame':
      const joinCode = payload;
      const joinName = ws.data.name || ws.data.username;
      if (!joinName) {
        ws.send(
          JSON.stringify({
            type: 'error',
            data: { message: 'You must set your name before joining a game.' },
          })
        );
        return;
      }

      const success = LobbyService.joinLobby(joinCode, ws.id);
      if (success) {
        ws.subscribe(joinCode);
        const players = LobbyService.getPlayers(joinCode);

        // Need to get player names. In Socket.IO we accessed `io.sockets`.
        // In Elysia/Bun, we don't have direct access to other WS instances easily unless we track them.
        // Assuming we just send IDs or rely on client to resolve names if not stored in LobbyService.
        // For now, let's send IDs or "Player_ID".
        // TODO: Store names in LobbyService or improve this.
        const playerNames = players.map((id: string) => id.substring(0, 8)); // Mock names

        wsServer?.publish(
          joinCode,
          JSON.stringify({
            type: 'playerJoined',
            data: { code: joinCode, player: joinName, players: playerNames },
          })
        );
      } else {
        ws.send(
          JSON.stringify({ type: 'error', data: { message: 'Lobby is full or does not exist.' } })
        );
      }
      break;

    case 'leaveGame':
      const leaveCode = payload;
      const lobby = LobbyService.leaveLobby(ws.id);
      if (lobby) {
        ws.unsubscribe(lobby);
        const players = LobbyService.getPlayers(lobby);
        const playerNames = players.map((id: string) => id.substring(0, 8));

        wsServer?.publish(
          lobby,
          JSON.stringify({
            type: 'playerLeft',
            data: { code: lobby, player: ws.data.name || ws.data.username, players: playerNames },
          })
        );
      }
      break;

    case 'lobby:invite':
      const { userId, lobbyId } = payload;
      const fromUser = {
        id: ws.data.userId,
        username: ws.data.name || ws.data.username || 'Unknown',
      };

      console.log(`[lobby.handler] Invite from ${fromUser.id} to ${userId} for lobby ${lobbyId}`);

      WebSocketService.publish(`user:${userId}`, 'lobby:invite-received', {
        lobbyId,
        fromUser,
      });
      break;
  }
};

export const handleLobbyDisconnect = (ws: any) => {
  const wsServer = getWebSocketServer();
  const lobby = LobbyService.leaveLobby(ws.id);
  if (lobby) {
    const players = LobbyService.getPlayers(lobby);
    const playerNames = players.map((id: string) => id.substring(0, 8));

    wsServer?.publish(
      lobby,
      JSON.stringify({
        type: 'playerLeft',
        data: { message: `${ws.data.name || 'A player'} has left the game.`, players: playerNames },
      })
    );
  }
};
