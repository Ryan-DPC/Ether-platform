import { WebSocketService } from '../services/websocket.service';
import ChatModel from '../models/chat.model.ts';

export const handleChatMessage = async (ws: any, type: string, payload: any) => {
    switch (type) {
        case 'chat:send-message':
        case 'chat:send':
            const { toUserId, content } = payload;
            const fromUserId = ws.data.userId;
            const username = ws.data.username;

            console.log(`[chat.handler] Message from ${fromUserId} to ${toUserId}:`, content);

            try {
                // Save to DB
                // @ts-ignore
                const newMessage = await ChatModel.create({
                    from_user: fromUserId,
                    to_user: toUserId,
                    content: content,
                    read_at: null
                });

                // Prepare message object
                const messageForRecipient = {
                    id: newMessage._id,
                    content: newMessage.content,
                    from_user_id: newMessage.from_user,
                    to_user_id: newMessage.to_user,
                    created_at: newMessage.created_at || new Date(),
                    from_username: username,
                    is_from_me: false
                };

                const messageForSender = {
                    ...messageForRecipient,
                    is_from_me: true
                };

                // Emit to recipient
                WebSocketService.publish(`user:${toUserId}`, 'chat:message-received', messageForRecipient);

            } catch (error) {
                console.error('[chat.handler] Error saving message:', error);
                ws.send(JSON.stringify({ type: 'error', data: { message: 'Failed to send message' } }));
            }
            break;

        case 'chat:broadcast':
        case 'chat:global':
            const fromUser = ws.data.userId;
            const sender = ws.data.username;
            const globalContent = payload.content || payload;

            console.log(`[chat.handler] Global message from ${sender}:`, globalContent);

            try {
                // Broadcast to all connected users via 'global' topic
                const broadcastMessage = {
                    from_user_id: fromUser,
                    from_username: sender,
                    content: globalContent,
                    created_at: new Date(),
                    type: 'global'
                };

                WebSocketService.broadcast('chat:global-message', broadcastMessage);

            } catch (error) {
                console.error('[chat.handler] Error broadcasting message:', error);
                ws.send(JSON.stringify({ type: 'error', data: { message: 'Failed to broadcast message' } }));
            }
            break;
    }
};
