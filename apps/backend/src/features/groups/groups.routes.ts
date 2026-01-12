import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { GroupsService } from './groups.service';

export const groupsRoutes = new Elysia({ prefix: '/api/groups' })
    .use(jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET || 'default_secret'
    }))
    .derive(async ({ headers, jwt }) => {
        const auth = headers['authorization'];
        if (!auth || !auth.startsWith('Bearer ')) {
            return { user: null };
        }
        const token = auth.slice(7);
        const payload = await jwt.verify(token);
        return { user: payload };
    })
    .guard({
        beforeHandle: ({ user, set }) => {
            if (!user) {
                set.status = 401;
                return { message: 'Unauthorized' };
            }
        }
    }, (app) => app
        // Create group
        .post('/create', async ({ body, user, set }) => {
            const { name, description, iconUrl } = body as any;
            if (!name) {
                set.status = 400;
                return { message: 'Group name is required' };
            }
            try {
                const group = await GroupsService.createGroup((user as any).id, name, description, iconUrl);
                return {
                    success: true,
                    group: {
                        id: group._id.toString(),
                        name: group.name,
                        description: group.description,
                        owner_id: group.owner_id.toString(),
                        members: group.members.map(m => m.toString()),
                        icon_url: group.icon_url
                    }
                };
            } catch (err: any) {
                set.status = 400;
                return { message: err.message };
            }
        })

        // Get my groups
        .get('/my-groups', async ({ user }) => {
            return await GroupsService.getMyGroups((user as any).id);
        })

        // Get group details
        .get('/:groupId', async ({ params: { groupId }, user, set }) => {
            try {
                return await GroupsService.getGroup(groupId, (user as any).id);
            } catch (err: any) {
                set.status = 404;
                return { message: err.message };
            }
        })

        // Invite member
        .post('/:groupId/invite', async ({ params: { groupId }, body, user, set }) => {
            const { friendId } = body as any;
            if (!friendId) {
                set.status = 400;
                return { message: 'Friend ID is required' };
            }
            try {
                await GroupsService.inviteMember(groupId, (user as any).id, friendId);
                return { success: true, message: 'Member invited successfully' };
            } catch (err: any) {
                set.status = 400;
                return { message: err.message };
            }
        })

        // Leave group
        .post('/:groupId/leave', async ({ params: { groupId }, user, set }) => {
            try {
                await GroupsService.leaveGroup(groupId, (user as any).id);
                return { success: true, message: 'Left group successfully' };
            } catch (err: any) {
                set.status = 400;
                return { message: err.message };
            }
        })

        // Delete group
        .delete('/:groupId', async ({ params: { groupId }, user, set }) => {
            try {
                await GroupsService.deleteGroup(groupId, (user as any).id);
                return { success: true, message: 'Group deleted successfully' };
            } catch (err: any) {
                set.status = 403;
                return { message: err.message };
            }
        })

        // Get messages
        .get('/:groupId/messages', async ({ params: { groupId }, query, user, set }) => {
            const limit = query.limit ? parseInt(query.limit as string) : 50;
            try {
                return await GroupsService.getMessages(groupId, (user as any).id, limit);
            } catch (err: any) {
                set.status = 403;
                return { message: err.message };
            }
        })
    );
