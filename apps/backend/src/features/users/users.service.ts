
import { Users } from '@vext/database';
import { GameOwnershipModel } from '../game-ownership/game-ownership.model';
import { ItemsService } from '../items/items.service'; // Assuming this exists or will need to be checked

export class UsersService {
    static async getUserProfile(userId: string) {
        try {
            const user = await Users.getUserById(userId);
            if (!user) throw new Error('Utilisateur introuvable.');

            const gamesOwned = await GameOwnershipModel.countDocuments({ user_id: userId, status: 'owned' });

            // Return plain object merged with games_owned
            return {
                ...(user.toObject ? user.toObject() : user),
                games_owned: gamesOwned
            };
        } catch (error: any) {
            throw new Error(`Erreur lors de la récupération du profil utilisateur : ${error.message}`);
        }
    }

    static async updateProfile(userId: string, data: any) {
        const allowedUpdates = ['username', 'email', 'language', 'bio', 'social_links', 'notification_preferences'];
        const updates: any = {};

        Object.keys(data).forEach(key => {
            if (allowedUpdates.includes(key)) {
                // Prevent setting empty email or username
                if ((key === 'email' || key === 'username') && !data[key]) {
                    return;
                }
                updates[key] = data[key];
            }
        });

        if (Object.keys(updates).length === 0) {
            throw new Error('Aucune donnée valide à mettre à jour.');
        }

        try {
            // Check uniqueness
            if (updates.username) {
                const existingUser = await Users.getUserByUsername(updates.username);
                if (existingUser && existingUser.id !== userId) {
                    throw new Error('Ce nom d\'utilisateur est déjà pris.');
                }
            }
            if (updates.email) {
                const existingUser = await Users.getUserByEmail(updates.email);
                if (existingUser && existingUser.id !== userId) {
                    throw new Error('Cet email est déjà utilisé.');
                }
            }

            await Users.updateUser(userId, updates);
            return await this.getUserProfile(userId);
        } catch (error: any) {
            throw new Error(error.message);
        }
    }

    static async getPublicProfile(userId: string) {
        try {
            const user = await Users.getUserById(userId);
            if (!user) return null;

            return {
                id: user._id,
                username: user.username,
                profile_pic: user.profile_pic,
                elo: user.elo || 1000,
                tokens: user.tokens || 0,
                created_at: user.created_at,
                rank: user.rank || 'Joueur'
            };
        } catch (error: any) {
            throw new Error(`Erreur lors de la récupération du profil public : ${error.message}`);
        }
    }

    static async searchUsers(username: string, excludeUserId: string) {
        if (!username) {
            throw new Error('Le champ de recherche est requis.');
        }
        const users = await Users.findUsersByUsername(username, excludeUserId);

        // Enrich with equipped frames
        const enrichedUsers = await Promise.all(users.map(async (user: any) => {
            try {
                // Try to get equipped frame if ItemsService is available
                // For now, we'll try-catch this dynamic dependency or import it if confirmed
                const frameRaw = await ItemsService.getEquippedItem(user.id, 'avatar_frame');
                return {
                    ...user,
                    frame_url: frameRaw ? frameRaw.image_url : null
                };
            } catch (e) {
                return user;
            }
        }));

        return enrichedUsers;
    }

    static async updateAvatar(userId: string, avatarUrl: string) {
        try {
            await Users.updateUserProfilePic(userId, avatarUrl);
            return { profile_pic: avatarUrl };
        } catch (error: any) {
            throw new Error(`Erreur lors de la mise à jour de l'avatar : ${error.message}`);
        }
    }

    static async addToWishlist(userId: string, gameId: string) {
        return await Users.addToWishlist(userId, gameId);
    }

    static async removeFromWishlist(userId: string, gameId: string) {
        return await Users.removeFromWishlist(userId, gameId);
    }

    static async getWishlist(userId: string) {
        return await Users.getWishlist(userId);
    }

    static async getRecentGames(userId: string) {
        try {
            return await GameOwnershipModel.find({ user_id: userId })
                .sort({ purchase_date: -1 })
                .limit(10)
                .populate('game_id', 'name image_url')
                .lean();
        } catch (error: any) {
            throw new Error(`Erreur lors de la récupération des jeux récents : ${error.message}`);
        }
    }

    static async getUserElo(userId: string) {
        const elo = await Users.getUserElo(userId);
        if (elo === null) throw new Error(`Utilisateur avec ID ${userId} introuvable.`);
        return elo;
    }

    static async updateUserElo(userId: string, newElo: number) {
        const changes = await Users.updateUserElo(userId, newElo);
        if (changes === 0) throw new Error(`Impossible de mettre à jour l'ELO.`);
        return changes;
    }
}
