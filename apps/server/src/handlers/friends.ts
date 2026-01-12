import { WebSocketService } from '../services/websocket.service';
import { UsersService } from '../services/users.service';

export const handleFriendsMessage = async (ws: any, type: string, payload: any) => {
  switch (type) {
    case 'status:update':
      // Validation (simplified for now, ideally use schemas)
      const status = payload?.status;
      if (!status) return;

      const userId = ws.data.userId;
      console.log(`[presence] User ${userId} status: ${status}`);

      // Logic from legacy: Mock friends or lookup
      // For now, we rely on UsersService to find friends and broadcast
      try {
        const friends = await UsersService.getFriends(userId);
        friends.forEach((friend: any) => {
          WebSocketService.publish(`user:${friend.id}`, 'friend:status-changed', {
            userId: userId,
            status: status,
          });
        });
      } catch (err) {
        console.error('Error broadcasting status:', err);
      }
      break;

    case 'user:status-update': // Legacy support
      // Call status:update logic
      await handleFriendsMessage(ws, 'status:update', payload);
      break;
  }
};
