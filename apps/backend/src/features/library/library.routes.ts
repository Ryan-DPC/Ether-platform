
import express from 'express';
// @ts-ignore
import libraryController from './library.controller';
// @ts-ignore
import authMiddleware from '../../middleware/auth';

const router = express.Router();

// Debug & Fix Data
router.get('/debug-fix', authMiddleware, libraryController.debugFix);

// Acheter un jeu depuis le store officiel
router.post('/purchase', authMiddleware, libraryController.purchaseGame);
router.post('/purchase-game', authMiddleware, libraryController.purchaseGame); // Alias pour compatibilité frontend

// Lister un jeu à la revente
router.post('/list-for-sale', authMiddleware, libraryController.listForSale);

// Acheter un jeu d'occasion
router.post('/purchase-used', authMiddleware, libraryController.purchaseUsedGame);

// Obtenir les jeux possédés par l'utilisateur
router.get('/my-games', authMiddleware, libraryController.getMyGames);

// Obtenir le marketplace (jeux en vente) - Public (pas besoin d'auth pour voir, mais auth peut être utilisé pour exclure ses propres ventes)
router.get('/marketplace', async (req, res, next) => {
    // Middleware optionnel pour récupérer l'utilisateur s'il est connecté
    if (req.headers.authorization) {
        return authMiddleware(req, res, next);
    }
    next();
}, libraryController.getMarketplace);

// Obtenir les ventes actives de l'utilisateur connecté
router.get('/my-sales', authMiddleware, libraryController.getMySales);

// Obtenir l'historique des transactions
router.get('/transaction-history', authMiddleware, libraryController.getTransactionHistory);

// Obtenir les statistiques de la blockchain
router.get('/blockchain-stats', libraryController.getBlockchainStats);

// Annuler une vente
router.post('/cancel-sale', authMiddleware, libraryController.cancelSale);

// Réclamer un jeu avec une clé
router.post('/redeem', authMiddleware, libraryController.redeemKey);

// Générer des clés de jeu (dev/admin)
router.post('/keys/generate', authMiddleware, libraryController.generateKeys);

// Obtenir les clés générées (dev/admin)
router.get('/keys', authMiddleware, libraryController.getGeneratedKeys);

// Installer un jeu
router.post('/install', authMiddleware, libraryController.installGame);

// Ajouter un jeu manuellement avec une game_key externe
router.post('/add-manual', authMiddleware, libraryController.addManualGame);

export default router;
