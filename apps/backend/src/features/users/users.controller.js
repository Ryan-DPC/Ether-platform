const UsersService = require('./users.service');

class UsersController {
    static async getUserProfile(req, res) {
        const userId = req.user?.id; // From JWT middleware
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Utilisateur non connecté.' });
        }

        try {
            const user = await UsersService.getUserProfile(userId);
            res.json({ success: true, user });
        } catch (error) {
            console.error(error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async updateProfile(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Utilisateur non connecté.' });
        }

        try {
            const updatedUser = await UsersService.updateProfile(userId, req.body);
            res.json({ success: true, user: updatedUser, message: 'Profil mis à jour avec succès.' });
        } catch (error) {
            console.error('Erreur lors de la mise à jour du profil :', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async searchUsers(req, res) {
        try {
            const username = req.query.query;
            const excludeUserId = req.user?.id;

            if (!excludeUserId) {
                return res.status(401).json({
                    success: false,
                    message: 'Vous devez être connecté pour effectuer cette recherche.',
                });
            }

            const users = await UsersService.searchUsers(username, excludeUserId);

            if (users.length === 0) {
                return res.status(200).json({ success: true, users: [], message: 'Aucun utilisateur trouvé.' });
            }

            return res.status(200).json({ success: true, users });
        } catch (error) {
            console.error('Erreur lors de la recherche d\'utilisateurs :', error);
            res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
        }
    }

    static async getUserElo(req, res) {
        try {
            const userId = req.params.userId;
            const elo = await UsersService.getUserElo(userId);
            res.status(200).json({ success: true, elo });
        } catch (error) {
            console.error('Erreur lors de la récupération de l\'ELO :', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async updateUserElo(req, res) {
        try {
            const { userId, newElo } = req.body;
            if (!userId || newElo === undefined) {
                return res.status(400).json({ success: false, message: 'Données manquantes.' });
            }

            await UsersService.updateUserElo(userId, newElo);
            res.status(200).json({ success: true, message: 'ELO mis à jour avec succès.' });
        } catch (error) {
            console.error('Erreur lors de la mise à jour de l\'ELO :', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async getRecentGames(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            // Get user's recent game ownership (last 10 games)
            const recentGames = await UsersService.getRecentGames(userId);

            res.json({ success: true, games: recentGames });
        } catch (error) {
            console.error('Error fetching recent games:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async getPublicProfile(req, res) {
        try {
            const { userId } = req.params;

            if (!userId) {
                return res.status(400).json({ success: false, message: 'User ID requis' });
            }

            const user = await UsersService.getPublicProfile(userId);

            if (!user) {
                return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
            }

            res.json({ success: true, user });
        } catch (error) {
            console.error('Error fetching public profile:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async uploadAvatar(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
            }

            const userId = req.user.id;
            const { uploadFromBuffer } = require('../../config/cloudinary');

            // Upload to Cloudinary
            const result = await uploadFromBuffer(req.file.buffer);

            // Update user in DB
            const updatedUser = await UsersService.updateAvatar(userId, result.secure_url);

            res.json({
                success: true,
                message: 'Avatar mis à jour avec succès',
                profile_pic: updatedUser.profile_pic
            });
        } catch (error) {
            console.error('Error uploading avatar:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async addToWishlist(req, res) {
        try {
            const userId = req.user.id;
            const { gameId } = req.body;
            await UsersService.addToWishlist(userId, gameId);
            res.json({ success: true, message: 'Added to wishlist' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async removeFromWishlist(req, res) {
        try {
            const userId = req.user.id;
            const { gameId } = req.params;
            await UsersService.removeFromWishlist(userId, gameId);
            res.json({ success: true, message: 'Removed from wishlist' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async getWishlist(req, res) {
        try {
            const userId = req.user.id;
            const wishlist = await UsersService.getWishlist(userId);
            res.json({ success: true, wishlist });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = UsersController;
