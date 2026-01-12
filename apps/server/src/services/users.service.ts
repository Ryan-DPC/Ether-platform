import Users from '../models/user.model.ts';

export class UsersService {
  static async saveSocketId(userId: string, socketId: string) {
    if (userId === 'backend-service') return;
    // @ts-expect-error
    return Users.saveSocketId(userId, socketId);
  }

  static async getUserBySocketId(socketId: string) {
    // @ts-expect-error
    return Users.getUserBySocketId(socketId);
  }

  static async removeSocketId(socketId: string) {
    // @ts-expect-error
    return Users.removeSocketId(socketId);
  }

  static async getFriends(userId: string) {
    if (userId === 'backend-service') return [];
    // @ts-expect-error
    return Users.getFriends(userId);
  }
}
