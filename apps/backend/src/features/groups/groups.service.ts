import GroupModel, { IGroup } from './group.model';
import GroupMessageModel, { IGroupMessage } from './groupMessage.model';
import { Users } from '@vext/database';
import mongoose from 'mongoose';

export class GroupsService {
    /**
     * Create a new group
     */
    static async createGroup(userId: string, name: string, description?: string, iconUrl?: string): Promise<IGroup> {
        const group = await GroupModel.create({
            name,
            description,
            owner_id: userId,
            members: [userId], // Owner is automatically a member
            icon_url: iconUrl
        });

        return group;
    }

    /**
     * Get all groups where user is a member
     */
    static async getMyGroups(userId: string): Promise<any[]> {
        const groups = await GroupModel.find({
            members: userId
        })
            .sort({ updated_at: -1 })
            .lean();

        return groups.map(group => ({
            id: group._id.toString(),
            name: group.name,
            description: group.description,
            owner_id: group.owner_id.toString(),
            members: group.members.map((m: any) => m.toString()),
            icon_url: group.icon_url,
            created_at: group.created_at,
            updated_at: group.updated_at
        }));
    }

    /**
     * Get group details
     */
    static async getGroup(groupId: string, userId: string): Promise<any> {
        const group = await GroupModel.findById(groupId).lean();

        if (!group) {
            throw new Error('Group not found');
        }

        // Verify user is a member
        const isMember = group.members.some((m: any) => m.toString() === userId);
        if (!isMember) {
            throw new Error('You are not a member of this group');
        }

        return {
            id: group._id.toString(),
            name: group.name,
            description: group.description,
            owner_id: group.owner_id.toString(),
            members: group.members.map((m: any) => m.toString()),
            icon_url: group.icon_url,
            created_at: group.created_at,
            updated_at: group.updated_at
        };
    }

    /**
     * Invite a member to the group
     * Requirement: invitee must be friends with at least one existing member
     */
    static async inviteMember(groupId: string, inviterId: string, inviteeId: string): Promise<IGroup> {
        const group = await GroupModel.findById(groupId);

        if (!group) {
            throw new Error('Group not found');
        }

        // Verify inviter is a member
        const isInviterMember = group.members.some(m => m.toString() === inviterId);
        if (!isInviterMember) {
            throw new Error('You are not a member of this group');
        }

        // Check if user is already a member
        const isAlreadyMember = group.members.some(m => m.toString() === inviteeId);
        if (isAlreadyMember) {
            throw new Error('User is already a member');
        }

        // Verify invitee is friends with at least one member
        const invitee = await Users.getUserById(inviteeId);
        if (!invitee) {
            throw new Error('User not found');
        }

        const inviteeFriends = invitee.friends.map((f: any) => f.toString());
        const hasCommonFriend = group.members.some(memberId =>
            inviteeFriends.includes(memberId.toString())
        );

        if (!hasCommonFriend) {
            throw new Error('User must be friends with at least one group member');
        }

        // Add member
        group.members.push(new mongoose.Types.ObjectId(inviteeId));
        await group.save();

        return group;
    }

    /**
     * Leave a group
     */
    static async leaveGroup(groupId: string, userId: string): Promise<void> {
        const group = await GroupModel.findById(groupId);

        if (!group) {
            throw new Error('Group not found');
        }

        // Cannot leave if owner (must transfer ownership or delete group)
        if (group.owner_id.toString() === userId) {
            throw new Error('Owner cannot leave the group. Transfer ownership or delete the group.');
        }

        // Remove member
        group.members = group.members.filter(m => m.toString() !== userId);
        await group.save();
    }

    /**
     * Delete a group (owner only)
     */
    static async deleteGroup(groupId: string, userId: string): Promise<void> {
        const group = await GroupModel.findById(groupId);

        if (!group) {
            throw new Error('Group not found');
        }

        if (group.owner_id.toString() !== userId) {
            throw new Error('Only the owner can delete the group');
        }

        // Delete all messages
        await GroupMessageModel.deleteMany({ group_id: groupId });

        // Delete group
        await GroupModel.deleteOne({ _id: groupId });
    }

    /**
     * Get message history
     */
    static async getMessages(groupId: string, userId: string, limit = 50): Promise<any[]> {
        // Verify user is a member
        const group = await GroupModel.findById(groupId);
        if (!group) {
            throw new Error('Group not found');
        }

        const isMember = group.members.some(m => m.toString() === userId);
        if (!isMember) {
            throw new Error('You are not a member of this group');
        }

        const messages = await GroupMessageModel.find({ group_id: groupId })
            .sort({ created_at: -1 })
            .limit(limit)
            .populate('user_id', 'username profile_pic')
            .lean();

        return messages.reverse().map(msg => ({
            id: msg._id.toString(),
            group_id: msg.group_id.toString(),
            user: msg.user_id,
            content: msg.content,
            created_at: msg.created_at
        }));
    }

    /**
     * Send a message (used by WebSocket handler)
     */
    static async sendMessage(groupId: string, userId: string, content: string): Promise<IGroupMessage> {
        // Verify user is a member
        const group = await GroupModel.findById(groupId);
        if (!group) {
            throw new Error('Group not found');
        }

        const isMember = group.members.some(m => m.toString() === userId);
        if (!isMember) {
            throw new Error('You are not a member of this group');
        }

        const message = await GroupMessageModel.create({
            group_id: groupId,
            user_id: userId,
            content
        });

        return message;
    }
}
