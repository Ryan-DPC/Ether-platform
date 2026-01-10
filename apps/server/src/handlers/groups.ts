import { WebSocketService } from '../services/websocket.service';
import { GroupsService } from '../services/groups.service';

export const handleGroupMessage = async (ws: any, type: string, payload: any) => {
    const userId = ws.data.userId;
    const username = ws.data.username;

    switch (type) {
        case 'group:join':
            const { groupId } = payload;
            console.log(`[group.handler] User ${username} joining group ${groupId}`);

            try {
                // Verify user is a member
                const group = await GroupsService.getGroup(groupId, userId);

                // Subscribe to group topic
                ws.subscribe(`group:${groupId}`);

                // Notify user of successful join
                ws.send(JSON.stringify({
                    type: 'group:joined',
                    data: { groupId, group }
                }));

                // Notify other members
                WebSocketService.publish(`group:${groupId}`, 'group:member-online', {
                    userId,
                    username
                });
            } catch (error: any) {
                console.error('[group.handler] Join error:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    data: { message: error.message }
                }));
            }
            break;

        case 'group:send-message':
            const { groupId: msgGroupId, content } = payload;

            if (!content || !msgGroupId) {
                ws.send(JSON.stringify({
                    type: 'error',
                    data: { message: 'Group ID and content are required' }
                }));
                return;
            }

            console.log(`[group.handler] Message from ${username} in group ${msgGroupId}:`, content);

            try {
                // Save message to DB
                const message = await GroupsService.sendMessage(msgGroupId, userId, content);

                // Populate user info for broadcast
                const user = await import('../models/user.model').then(m => m.default);
                const userDoc = await user.findById(userId).select('username profile_pic').lean();

                // Broadcast to all group members
                const messagePayload = {
                    id: message._id.toString(),
                    group_id: msgGroupId,
                    user: {
                        id: userId,
                        username: userDoc?.username || username,
                        profile_pic: userDoc?.profile_pic
                    },
                    content: message.content,
                    created_at: message.created_at
                };

                WebSocketService.publish(`group:${msgGroupId}`, 'group:message-received', messagePayload);

            } catch (error: any) {
                console.error('[group.handler] Send message error:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    data: { message: error.message }
                }));
            }
            break;

        case 'group:leave':
            const { groupId: leaveGroupId } = payload;
            console.log(`[group.handler] User ${username} leaving group ${leaveGroupId}`);

            try {
                // Unsubscribe from group topic
                ws.unsubscribe(`group:${leaveGroupId}`);

                // Notify other members
                WebSocketService.publish(`group:${leaveGroupId}`, 'group:member-offline', {
                    userId,
                    username
                });

                ws.send(JSON.stringify({
                    type: 'group:left',
                    data: { groupId: leaveGroupId }
                }));
            } catch (error: any) {
                console.error('[group.handler] Leave error:', error);
            }
            break;
    }
};
