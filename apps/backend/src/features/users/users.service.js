const Models = require('./user.model');
const Users = Models.default || Models;

const GameOwnershipModel = require('../game-ownership/game-ownership.model');
const GameOwnership = GameOwnershipModel.default || GameOwnershipModel;

class UsersService {
    static async getUserProfile(userId) {
        try {
            const user = await Users.getUserById(userId);
            if (!user) throw new Error('Utilisateur introuvable.');

            const gamesOwned = await GameOwnership.countDocuments({ user_id: userId, status: 'owned' });

            return { ...user, games_owned: gamesOwned };
        } catch (error) {
            throw new Error(`Erreur lors de la récupération du profil utilisateur : ${error.message}`);
        }
    }

    static async updateProfile(userId, data) {
        const allowedUpdates = ['username', 'email', 'language', 'bio', 'social_links', 'notification_preferences'];
        const updates = {};

        Object.keys(data).forEach(key => {
            if (allowedUpdates.includes(key)) {
                // Prevent setting empty email or username which are required/unique
                if ((key === 'email' || key === 'username') && !data[key]) {
                    return;
                }
                updates[key] = data[key];
            }
        });

        if (Object.keys(updates).length === 0) {
            // If no valid fields, just return the current profile without error, or throw error?
            // Let's throw error to be explicit.
            throw new Error('Aucune donnée valide à mettre à jour.');
        }

        try {
            // Check if username or email is taken if they are being updated
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
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static async getPublicProfile(userId) {
        try {
            const user = await Users.getUserById(userId);
            if (!user) return null;

            // Return only public information
            return {
                id: user._id,
                username: user.username,
                profile_pic: user.profile_pic,
                elo: user.elo || 1000,
                tokens: user.tokens || 0,
                created_at: user.created_at,
                rank: user.rank || 'Joueur'
            };
        } catch (error) {
            throw new Error(`Erreur lors de la récupération du profil public : ${error.message}`);
        }
    }

    static async searchUsers(username, excludeUserId) {
        if (!username) {
            throw new Error('Le champ de recherche est requis.');
        }
        const users = await Users.findUsersByUsername(username, excludeUserId);

        // Enrich with equipped frames
        // We use a lazy require to avoid potential circular dependency issues during module loading
        const ItemsService = require('../items/items.service');

        const enrichedUsers = await Promise.all(users.map(async (user) => {
            try {
                const frameRaw = await ItemsService.getEquippedItem(user.id, 'avatar_frame');
                return {
                    ...user,
                    frame_url: frameRaw ? frameRaw.image_url : null
                };
            } catch (e) {
                // If fetching frame fails, just return user without frame
                return user;
            }
        }));

        return enrichedUsers;
    }

    static async updateAvatar(userId, avatarUrl) {
        try {
            await Users.updateUserProfilePic(userId, avatarUrl);
            return { profile_pic: avatarUrl };
        } catch (error) {
            throw new Error(`Erreur lors de la mise à jour de l'avatar : ${error.message}`);
        }
    }

    static async updateProfilePic(userId, profilePicUrl) {
        await Users.updateUserProfilePic(userId, profilePicUrl);
        return { success: true, profile_pic: profilePicUrl };
    }

    static async getProfilePictureUrl(user) {
        if (!user) {
            return '/assets/images/default-game.png';
        }
        // Note: Logic for checking equipped items is omitted here to avoid circular dependency 
        // or complex migration for now. Can be re-added when Items feature is migrated.

        const profilePic = user.profile_pic || user.profile_picture;

        if (profilePic) {
            if (profilePic.startsWith('http://') || profilePic.startsWith('https://')) {
                return profilePic;
            }
            if (profilePic.startsWith('/')) {
                return profilePic;
            }
        }

        return '/assets/images/default-game.png';
    }

    static async updateTokens(userId, tokens) {
        return await Users.updateUserTokens(userId, tokens);
    }

    static async getUserElo(userId) {
        try {
            const elo = await Users.getUserElo(userId);
            if (elo === null) {
                throw new Error(`Utilisateur avec ID ${userId} introuvable.`);
            }
            return elo;
        } catch (error) {
            console.error('Erreur lors de la récupération de l\'ELO :', error.message);
            throw error;
        }
    }

    static async updateUserElo(userId, newElo) {
        try {
            const changes = await Users.updateUserElo(userId, newElo);
            if (changes === 0) {
                throw new Error(`Impossible de mettre à jour l'ELO de l'utilisateur avec ID ${userId}.`);
            }
            return changes;
        } catch (error) {
            console.error('Erreur lors de la mise à jour de l\'ELO :', error.message);
            throw error;
        }
    }

    static async incrementUserElo(userId, increment) {
        try {
            const changes = await Users.incrementUserElo(userId, increment);
            if (changes === 0) {
                throw new Error(`Impossible d'incrémenter l'ELO pour l'utilisateur avec ID ${userId}.`);
            }
            return changes;
        } catch (error) {
            console.error('Erreur lors de l\'incrémentation de l\'ELO :', error.message);
            throw error;
        }
    }

    static async decrementUserElo(userId, decrement) {
        try {
            const changes = await Users.decrementUserElo(userId, decrement);
            if (changes === 0) {
                throw new Error(`Impossible de décrémenter l'ELO pour l'utilisateur avec ID ${userId}.`);
            }
            return changes;
        } catch (error) {
            console.error('Erreur lors de la décrémentation de l\'ELO :', error.message);
            throw error;
        }
    }

    static async saveSocketId(userId, socketId) {
        try {
            await Users.saveSocketId(userId, socketId);
        } catch (error) {
            console.error('Erreur dans UserService.saveSocketId :', error);
            throw error;
        }
    }

    static async getUserBySocketId(socketId) {
        try {
            return await Users.getUserBySocketId(socketId);
        } catch (error) {
            console.error('Erreur dans UserService.getUserBySocketId :', error);
            throw error;
        }
    }

    static async removeSocketId(socketId) {
        try {
            await Users.removeSocketId(socketId);
        } catch (error) {
            console.error('Erreur dans UserService.removeSocketId :', error);
            throw error;
        }
    }

    static async addToWishlist(userId, gameId) {
        return await Users.addToWishlist(userId, gameId);
    }

    static async removeFromWishlist(userId, gameId) {
        return await Users.removeFromWishlist(userId, gameId);
    }

    static async getWishlist(userId) {
        return await Users.getWishlist(userId);
    }

    static async getRecentGames(userId) {
        try {
            return await GameOwnership.find({ user_id: userId })
                .sort({ purchase_date: -1 })
                .limit(10)
                .populate('game_id', 'name image_url')
                .lean();
        } catch (error) {
            throw new Error(`Erreur lors de la récupération des jeux récents : ${error.message}`);
        }
    }
}

module.exports = UsersService;
