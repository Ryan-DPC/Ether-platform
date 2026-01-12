import { FriendModel } from './friends.model';
import mongoose from 'mongoose';

export class FriendsService {
  static async sendFriendRequest(userId: string, friendId: string) {
    // Check existing
    const existing = await FriendModel.findOne({
      user_id: userId,
      friend_id: friendId,
    });

    if (existing) {
      if (existing.status === 'accepted') {
        throw new Error('Vous êtes déjà amis.');
      } else if (existing.status === 'pending') {
        throw new Error("Une demande d'ami est déjà en attente.");
      }
      throw new Error("Une demande d'ami existe déjà.");
    }

    // Check reverse (cross request)
    const reverseRequest = await FriendModel.findOne({
      user_id: friendId,
      friend_id: userId,
    });

    if (reverseRequest) {
      if (reverseRequest.status === 'pending') {
        // Auto accept
        return await this.acceptFriendRequest(reverseRequest._id.toString());
      } else if (reverseRequest.status === 'accepted') {
        throw new Error('Vous êtes déjà amis.');
      }
    }

    const doc = await FriendModel.create({
      user_id: userId,
      friend_id: friendId,
      status: 'pending',
    });
    return doc._id.toString();
  }

  static async acceptFriendRequest(requestId: string) {
    const update = await FriendModel.updateOne(
      { _id: requestId },
      { $set: { status: 'accepted' } }
    );
    if (update.modifiedCount === 0) throw new Error('Aucune demande trouvée avec cet ID.');

    const row = await FriendModel.findById(requestId, { user_id: 1, friend_id: 1 }).lean();
    if (!row) throw new Error('Relation utilisateur non trouvée.');

    // Create reciprocal
    await FriendModel.updateOne(
      { user_id: row.friend_id, friend_id: row.user_id },
      { $setOnInsert: { status: 'accepted' } }, // Only set status if inserting new
      { upsert: true }
    );
    return 1;
  }

  static async rejectFriendRequest(requestId: string, userId: string) {
    // Ensure request is meant for this user
    const res = await FriendModel.updateOne(
      { _id: requestId, friend_id: userId },
      { $set: { status: 'rejected' } }
    );
    if (res.modifiedCount === 0) {
      throw new Error(
        "Impossible de refuser la demande d'ami. Demande introuvable ou non autorisée."
      );
    }
    return res.modifiedCount;
  }

  static async removeFriend(userId: string, friendId: string) {
    const res = await FriendModel.deleteMany({
      $or: [
        { user_id: userId, friend_id: friendId },
        { user_id: friendId, friend_id: userId },
      ],
    });
    return res.deletedCount;
  }

  static async getFriends(userId: string) {
    const rows = await FriendModel.find({ user_id: userId, status: 'accepted' })
      .populate('friend_id', { username: 1, profile_pic: 1, socket_id: 1 })
      .lean();

    return rows.map((r: any) => ({
      id: r.friend_id._id.toString(),
      username: r.friend_id.username,
      profile_pic: r.friend_id.profile_pic,
      status: r.friend_id.socket_id ? 'online' : 'offline',
    }));
  }

  static async getFriendRequests(userId: string) {
    const rows = await FriendModel.find({ friend_id: userId, status: 'pending' })
      .populate('user_id', { username: 1, profile_pic: 1 })
      .lean();

    return rows.map((r: any) => ({
      request_id: r._id.toString(),
      user_id: r.user_id._id.toString(),
      username: r.user_id.username,
      profile_pic: r.user_id.profile_pic,
    }));
  }
}
