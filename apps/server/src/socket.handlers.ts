import { handleUserMessage } from './handlers/user';
import { handleFriendsMessage } from './handlers/friends';
import { handleLobbyMessage, handleLobbyDisconnect } from './handlers/lobby';
import { handleChatMessage } from './handlers/chat';
import { handleTransactionMessage } from './handlers/transaction';
import {
  handleStickArenaMessage,
  handleStickArenaDisconnect,
} from './features/stick-arena/stick-arena.socket';
import { handleGroupMessage } from './handlers/groups';

export const handleWsMessage = async (ws: any, message: any) => {
  let type: string;
  let payload: any;

  try {
    if (typeof message === 'string') {
      const parsed = JSON.parse(message);
      type = parsed.type;
      payload = parsed.data || parsed.payload; // Support both data and payload wrapping
      // Legacy frontend sometimes sends raw arguments, but mostly objects.
      // If message is just "eventName", handled below?
      // Socket.IO sends [eventName, ...args]. We assumed custom protocol {type, data}.
      // If the legacy frontend uses Socket.IO client, it sends Socket.IO packets (42["event", ...]).
      // BUT, our task is to migrate the server to Elysia, implying the client ALSO changes or we assume usage of standard WS.
      // The prompt says "migrating WebSocket Logic". Usually implies moving away from Socket.IO entirely.
      // I will assume standard JSON: { type: "event", data: ... }
    } else {
      type = message.type;
      payload = message.data;
    }
  } catch (e) {
    console.error('Failed to parse message', message);
    return;
  }

  if (!type) {
    // Handle Socket.IO heartbeat or raw strings if needed, but for now ignore
    return;
  }

  console.log(`📡 Event received: ${type}`);

  try {
    if (type.startsWith('stick-arena:')) {
      handleStickArenaMessage(ws, type, payload);
      return;
    }

    if (
      type.startsWith('lobby:') ||
      type === 'createGame' ||
      type === 'joinGame' ||
      type === 'leaveGame'
    ) {
      await handleLobbyMessage(ws, type, payload);
      return;
    }

    if (type.startsWith('chat:')) {
      await handleChatMessage(ws, type, payload);
      return;
    }

    if (type.startsWith('group:')) {
      await handleGroupMessage(ws, type, payload);
      return;
    }

    if (type.startsWith('transaction:')) {
      await handleTransactionMessage(ws, type, payload);
      return;
    }

    if (type.startsWith('status:') || type === 'user:status-update') {
      await handleFriendsMessage(ws, type, payload);
      return;
    }

    if (type === 'setName') {
      await handleUserMessage(ws, type, payload);
      return;
    }
  } catch (err) {
    console.error(`Error handling event ${type}:`, err);
    ws.send(
      JSON.stringify({ type: 'error', data: { message: 'Internal server error processing event' } })
    );
  }
};

export const handleWsDisconnect = async (ws: any) => {
  handleLobbyDisconnect(ws);
  handleStickArenaDisconnect(ws);
};
