
import { Request, Response } from 'express';
// @ts-ignore
import libraryService from './library.service';

class LibraryController {
    // Debug & Fix Data
    async debugFix(req: any, res: Response) {
        try {
            const userId = req.user.id;
            const result = await libraryService.debugFix(userId);
            res.json(result);
        } catch (error: any) {
            console.error('Debug Fix Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Acheter un jeu depuis le store officiel
    async purchaseGame(req: any, res: Response) {
        try {
            const { gameId } = req.body;
            const userId = req.user.id;

            if (!gameId) {
                return res.status(400).json({ error: 'Game ID requis' });
            }

            const result = await libraryService.purchaseGame(userId, gameId);
            res.json(result);
        } catch (error: any) {
            console.error('Erreur lors de l\'achat :', error);
            res.status(400).json({ error: error.message });
        }
    }

    // Lister un jeu à la revente
    async listForSale(req: any, res: Response) {
        try {
            const { gameKey, askingPrice } = req.body;
            const userId = req.user.id;

            if (!gameKey || !askingPrice) {
                return res.status(400).json({ error: 'Clé de jeu (gameKey) et prix requis' });
            }

            const result = await libraryService.listGameForSale(gameKey, askingPrice, userId);
            res.json(result);
        } catch (error: any) {
            console.error('Erreur lors de la mise en vente :', error);
            res.status(400).json({ error: error.message });
        }
    }

    // Acheter un jeu d'occasion
    async purchaseUsedGame(req: any, res: Response) {
        try {
            const { gameKey, sellerId } = req.body;
            const buyerId = req.user.id;

            if (!gameKey || !sellerId) {
                return res.status(400).json({ error: 'Clé de jeu (gameKey) et ID vendeur requis' });
            }

            const result = await libraryService.purchaseUsedGame(buyerId, gameKey, sellerId);
            res.json(result);
        } catch (error: any) {
            console.error('Erreur lors de l\'achat d\'occasion :', error);
            res.status(400).json({ error: error.message });
        }
    }

    // Obtenir les jeux possédés par l'utilisateur
    async getMyGames(req: any, res: Response) {
        try {
            const userId = req.user.id;
            const games = await libraryService.getUserOwnedGames(userId);
            res.json(games);
        } catch (error) {
            console.error('Erreur lors de la récupération des jeux :', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    // Obtenir le marketplace (jeux en vente)
    async getMarketplace(req: any, res: Response) {
        try {
            const { minPrice, maxPrice, genre, sort } = req.query;
            const excludeUserId = req.user?.id || null; // Exclure les ventes de l'utilisateur connecté
            const games = await libraryService.getMarketplaceGames({ minPrice, maxPrice, genre, sort }, excludeUserId);
            res.json(games);
        } catch (error) {
            console.error('Erreur lors de la récupération du marketplace :', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    // Obtenir les ventes actives de l'utilisateur connecté
    async getMySales(req: any, res: Response) {
        try {
            const userId = req.user.id;
            const sales = await libraryService.getUserActiveSales(userId);
            res.json(sales);
        } catch (error) {
            console.error('Erreur lors de la récupération des ventes :', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    // Obtenir l'historique des transactions
    async getTransactionHistory(req: any, res: Response) {
        try {
            const userId = req.user.id;
            const transactions = await libraryService.getUserTransactionHistory(userId);
            res.json(transactions);
        } catch (error) {
            console.error('Erreur lors de la récupération de l\'historique :', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    // Obtenir les statistiques de la blockchain
    async getBlockchainStats(req: Request, res: Response) {
        try {
            const stats = libraryService.getBlockchainStats();
            res.json(stats);
        } catch (error) {
            console.error('Erreur lors de la récupération des stats :', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    // Annuler une vente
    async cancelSale(req: any, res: Response) {
        try {
            const { gameKey } = req.body;
            const userId = req.user.id;

            if (!gameKey) {
                return res.status(400).json({ error: 'Clé de jeu (gameKey) requise' });
            }

            const result = await libraryService.cancelSale(gameKey, userId);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Erreur lors de l\'annulation :', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    // Réclamer un jeu avec une clé
    async redeemKey(req: any, res: Response) {
        try {
            const { key } = req.body;
            const userId = req.user.id;

            if (!key) {
                return res.status(400).json({ error: 'Clé de jeu requise' });
            }

            const result = await libraryService.redeemKey(userId, key);
            res.json(result);
        } catch (error: any) {
            console.error('Erreur lors de la réclamation :', error);
            res.status(400).json({ error: error.message });
        }
    }

    // Générer des clés de jeu (dev/admin)
    async generateKeys(req: any, res: Response) {
        try {
            const { gameId, quantity, purpose } = req.body;
            const userId = req.user.id;

            if (!gameId || !quantity) {
                return res.status(400).json({ error: 'Game ID et quantité requis' });
            }

            if (quantity < 1 || quantity > 100) {
                return res.status(400).json({ error: 'Quantité doit être entre 1 et 100' });
            }

            const result = await libraryService.generateKeys(
                gameId,
                parseInt(quantity),
                userId,
                purpose || 'dev'
            );
            res.json(result);
        } catch (error: any) {
            console.error('Erreur lors de la génération des clés :', error);
            res.status(400).json({ error: error.message });
        }
    }

    // Obtenir les clés générées (dev/admin)
    async getGeneratedKeys(req: any, res: Response) {
        try {
            const { gameId, userId, used } = req.query;
            const currentUserId = req.user.id;

            const result = await libraryService.getGeneratedKeys(
                gameId || null,
                userId === 'me' ? currentUserId : (userId || null),
                used !== undefined ? used === 'true' : null
            );
            res.json(result);
        } catch (error) {
            console.error('Erreur lors de la récupération des clés :', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    // Installer un jeu
    async installGame(req: any, res: Response) {
        try {
            const { gameKey } = req.body;
            const userId = req.user.id;

            if (!gameKey) {
                return res.status(400).json({ error: 'Clé de jeu (gameKey) requise' });
            }

            const result = await libraryService.installGame(userId, gameKey);
            res.json(result);
        } catch (error: any) {
            console.error('Erreur lors de l\'installation :', error);
            res.status(400).json({ error: error.message });
        }
    }

    // Ajouter un jeu manuellement avec une game_key externe
    async addManualGame(req: any, res: Response) {
        try {
            const { gameKey, gameData } = req.body;
            const userId = req.user.id;

            if (!gameKey) {
                return res.status(400).json({ error: 'Clé de jeu (gameKey) requise' });
            }

            const result = await libraryService.addManualGame(userId, gameKey, gameData || {});
            res.json(result);
        } catch (error: any) {
            console.error('Erreur lors de l\'ajout manuel :', error);
            res.status(400).json({ error: error.message });
        }
    }
}

export default new LibraryController();
