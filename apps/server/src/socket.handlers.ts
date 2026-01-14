import { handleUserMessage } from './handlers/user';
import { handleFriendsMessage } from './handlers/friends';
import { handleLobbyMessage, handleLobbyDisconnect } from './handlers/lobby';
import { handleChatMessage } from './handlers/chat';
import { handleTransactionMessage } from './handlers/transaction';
import {
  handleStickArenaMessage,
  handleStickArenaDisconnect,
} from './features/stick-arena/stick-arena.socket';
import {
  handleAetherStrikeMessage,
  handleAetherStrikeDisconnect,
} from './features/aether-strike/aether-strike.socket';
import { handleGroupMessage } from './handlers/groups';

export const handleWsMessage = async (ws: any, message: any) => {
  let type: string;
  let payload: any;

  try {
    if (typeof message === 'string') {
      const parsed = JSON.parse(message);
      type = parsed.type;
      payload = parsed.data || parsed.payload;
    } else {
      type = message.type;
      payload = message.data;
    }
  } catch (e) {
    console.error('Failed to parse message', message);
    return;
  }

  if (!type) {
    return;
  }

  console.log(`📡 Event received: ${type}`);

  try {
    if (type.startsWith('stick-arena:')) {
      handleStickArenaMessage(ws, type, payload);
      return;
    }

    if (type.startsWith('aether-strike:')) {
      handleAetherStrikeMessage(ws, type, payload);
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
  handleAetherStrikeDisconnect(ws);
};
