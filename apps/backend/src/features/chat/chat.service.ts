import { MessageModel } from './chat.model';
import mongoose from 'mongoose';

export class ChatService {
  static async sendMessage(fromUserId: string, toUserId: string, content: string) {
    if (!content || content.trim().length === 0) {
      throw new Error('Le contenu du message ne peut pas être vide');
    }
    if (content.length > 1000) {
      throw new Error('Le message ne peut pas dépasser 1000 caractères');
    }
    const doc = await MessageModel.create({
      from_user: fromUserId,
      to_user: toUserId,
      content: content.trim(),
    });
    return { id: doc._id.toString(), content: doc.content };
  }

  static async getInbox(userId: string, limit: number = 50) {
    const rows = await MessageModel.find({ to_user: userId })
      .sort({ created_at: -1 })
      .limit(limit)
      .populate('from_user', { username: 1, profile_picture: 1, profile_pic: 1 })
      .lean();
    return rows.map((r: any) => ({
      id: r._id.toString(),
      from_user_id: r.from_user?._id?.toString(),
      from: r.from_user?.username,
      profile_picture:
        r.from_user?.profile_picture ||
        r.from_user?.profile_pic ||
        '/assets/images/default-game.png',
      content: r.content,
      created_at: r.created_at,
      read_at: r.read_at,
    }));
  }

  static async getConversation(userId: string, otherUserId: string, limit: number = 50) {
    const rows = await MessageModel.find({
      $or: [
        { from_user: userId, to_user: otherUserId },
        { from_user: otherUserId, to_user: userId },
      ],
    })
      .sort({ created_at: -1 })
      .limit(limit)
      .populate('from_user', { username: 1, profile_picture: 1, profile_pic: 1 })
      .populate('to_user', { username: 1, profile_picture: 1, profile_pic: 1 })
      .lean();

    return rows
      .map((r: any) => ({
        id: r._id.toString(),
        from_user_id: r.from_user?._id?.toString(),
        to_user_id: r.to_user?._id?.toString(),
        from_username: r.from_user?.username,
        to_username: r.to_user?.username,
        content: r.content,
        created_at: r.created_at,
        read_at: r.read_at,
        is_from_me: r.from_user?._id?.toString() === userId.toString(),
      }))
      .reverse();
  }

  static async markAsRead(messageId: string, userId: string) {
    const message = await MessageModel.findById(messageId).lean();
    if (!message || message.to_user.toString() !== userId.toString()) {
      throw new Error('Message non trouvé ou non autorisé');
    }
    await MessageModel.updateOne({ _id: messageId }, { $set: { read_at: new Date() } });
  }

  static async getUnreadCount(userId: string) {
    const count = await MessageModel.countDocuments({
      to_user: userId,
      read_at: null,
    });
    return count;
  }

  static async getConversationsList(userId: string, limit: number = 20) {
    const userIdObj = new mongoose.Types.ObjectId(userId);
    const messages = await MessageModel.find({
      $or: [{ from_user: userIdObj }, { to_user: userIdObj }],
    })
      .sort({ created_at: -1 })
      .populate('from_user', { username: 1, profile_picture: 1, profile_pic: 1 })
      .populate('to_user', { username: 1, profile_picture: 1, profile_pic: 1 })
      .lean();

    const conversationsMap = new Map();
    const userIdStr = userId.toString();

    messages.forEach((msg: any) => {
      const fromUserIdStr = msg.from_user._id.toString();
      const toUserIdStr = msg.to_user._id.toString();
      const otherUserId = fromUserIdStr === userIdStr ? toUserIdStr : fromUserIdStr;

      if (!conversationsMap.has(otherUserId)) {
        const otherUser = fromUserIdStr === userIdStr ? msg.to_user : msg.from_user;
        conversationsMap.set(otherUserId, {
          user_id: otherUserId,
          username: otherUser.username,
          profile_picture:
            otherUser.profile_picture || otherUser.profile_pic || '/assets/images/default-game.png',
          last_message: msg.content,
          last_message_date: msg.created_at,
          unread_count: toUserIdStr === userIdStr && !msg.read_at ? 1 : 0,
        });
      } else {
        const conv = conversationsMap.get(otherUserId);
        if (!msg.read_at && toUserIdStr === userIdStr) {
          conv.unread_count++;
        }
      }
    });

    return Array.from(conversationsMap.values())
      .sort(
        (a, b) => new Date(b.last_message_date).getTime() - new Date(a.last_message_date).getTime()
      )
      .slice(0, limit);
  }
}
