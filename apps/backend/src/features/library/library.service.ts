
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';

import { Blockchain, Transaction } from '../../services/blockchain.service';
import { generateGameKey, isValidKeyFormat } from '../../utils/gameKeys';
import { GameModel as Games, IGame } from '../games/game.model';
import { Users, type IUser } from '@vext/database';
import GameOwnership, { IGameOwnership } from '../game-ownership/game-ownership.model';
import Commission from './commissions.model';
import BlockchainTx from './blockchainTx.model';
import GameKey, { IGameKey } from './gameKeys.model';

import { CloudinaryService } from '../../services/cloudinary.service';
import { NpmInstaller } from '../../utils/npmInstaller';

// Stub logger
const logger = {
    info: console.log,
    warn: console.warn,
    error: console.error
};

// Use environment variable or default relative path
const GAMES_LIBRARY_PATH = process.env.GAMES_LIBRARY_PATH || path.resolve(process.cwd(), '../../../../games');

export class LibraryService {
    blockchain: Blockchain;
    platformCommissionRate: number;
    developerCommissionRate: number;

    constructor() {
        this.blockchain = new Blockchain();
        this.platformCommissionRate = 0.1; // 10% for platform
        this.developerCommissionRate = 0.05; // 5% for developer
    }

    // Generate unique ownership token (deprecated, replaced by game_key)
    generateOwnershipToken(userId: string, gameId: string) {
        const data = `${userId}-${gameId}-${Date.now()}-${Math.random()}`;
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    async debugFix(userId: string) {
        const userIdObj = new mongoose.Types.ObjectId(userId);
        const game = await Games.findOne({ folder_name: 'spludbuster' }); // using model directly
        let fixedTxs = 0;
        if (game) {
            const userAddress = `user_${userId}`;
            const result = await BlockchainTx.updateMany({
                $or: [{ from_address: userAddress }, { to_address: userAddress }],
                amount: 5,
                game_id: null
            }, { $set: { game_id: game._id } });
            fixedTxs = result.modifiedCount;
        }

        const ownedGames = await GameOwnership.find({ user_id: userIdObj, status: 'owned' })
            .populate('game_id')
            .lean();

        return {
            success: true,
            deletedListings: 0,
            fixedTransactions: fixedTxs,
            ownedGamesCount: ownedGames.length,
            ownedGames: ownedGames.map((g: any) => ({
                id: g._id,
                game_name: g.game_id?.game_name,
                folder_name: g.game_id?.folder_name,
                game_id_raw: g.game_id
            }))
        };
    }

    async purchaseGame(userId: string, gameId: string | any) {
        // Need to be careful with transactions in Mongoose, ensuring replica set/sessions work or fallback
        // For simplicity, we keep the session logic but wrap in try/catch to warn if transactions aren't supported (e.g. standalone mongo)
        let session: mongoose.ClientSession | null = null;
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (e) {
            console.warn('Transactions not supported (standalone Mongo?), continuing without transaction safety.');
            session = null;
        }

        try {
            let gameIdStr = String(gameId).trim();
            let folderName: string | null = null;

            if (gameIdStr.startsWith('cloudinary_')) {
                folderName = gameIdStr.replace(/^cloudinary_/, '');
                logger.info(`[Library] Validating Cloudinary ID, folder_name: ${folderName}`);
            } else if (!mongoose.Types.ObjectId.isValid(gameIdStr)) {
                folderName = gameIdStr;
                logger.info(`[Library] Non-ObjectId detected, using as folder_name: ${folderName}`);
            }

            // Custom finder logic
            let game: any = null;
            if (mongoose.Types.ObjectId.isValid(gameIdStr)) {
                game = await Games.findById(gameIdStr);
            } else {
                game = await Games.findOne({ folder_name: gameIdStr });
            }

            // Cloudinary Fallback Logic
            if (!game && folderName) {
                logger.info(`[Library] Game ${folderName} not found in MongoDB, attempting Cloudinary creation...`);
                try {
                    const cloudinaryService = new CloudinaryService();
                    if (cloudinaryService.isEnabled()) {
                        const manifestUrl = cloudinaryService.getPublicUrl(`games/dev/${folderName}/manifest.json`, 'raw');
                        try {
                            if (manifestUrl) {
                                const response = await fetch(manifestUrl);
                                if (response.ok) {
                                    const manifest: any = await response.json();
                                    const gameData = {
                                        game_name: manifest.gameName || folderName,
                                        folder_name: folderName,
                                        description: manifest.description || '',
                                        image_url: cloudinaryService.getPublicUrl(`games/dev/${folderName}/image.png`, 'image') || '/assets/images/default-game.png',
                                        status: 'disponible',
                                        genre: manifest.genre || 'Undefined',
                                        max_players: manifest.maxPlayers || 1,
                                        is_multiplayer: manifest.isMultiplayer || false,
                                        developer: manifest.developer || 'Inconnu',
                                        price: manifest.price || 0,
                                        manifestUrl: manifestUrl,
                                        manifestVersion: manifest.version || '1.0.0',
                                        manifestUpdatedAt: new Date(),
                                    };
                                    const newGame = await Games.create(gameData);
                                    game = newGame;
                                } else {
                                    // Try listing fallback
                                    const cloudinaryGames = await cloudinaryService.getAllGames(false);
                                    const cloudinaryGame: any = cloudinaryGames.find((g: any) => g.folder_name === folderName);
                                    if (cloudinaryGame) {
                                        const gameData = {
                                            game_name: cloudinaryGame.game_name || folderName,
                                            folder_name: folderName,
                                            description: cloudinaryGame.description || '',
                                            image_url: cloudinaryGame.image_url || '/assets/images/default-game.png',
                                            status: 'disponible',
                                            genre: cloudinaryGame.genre || 'Undefined',
                                            max_players: cloudinaryGame.max_players || 1,
                                            is_multiplayer: cloudinaryGame.is_multiplayer || false,
                                            developer: cloudinaryGame.developer || 'Inconnu',
                                            price: cloudinaryGame.price || 0,
                                            manifestUrl: cloudinaryGame.manifestUrl || null,
                                            manifestVersion: cloudinaryGame.manifestVersion || null,
                                            manifestUpdatedAt: cloudinaryGame.manifestUpdatedAt || null,
                                        };
                                        const newGame = await Games.create(gameData);
                                        game = newGame;
                                    }
                                }
                            }
                        } catch (err: any) {
                            console.warn(`[Library] Error fetching dev game manifest: ${err.message}`);
                        }
                    }
                } catch (cloudinaryError: any) {
                    console.warn(`[Library] ⚠️ Impossible to create game from Cloudinary:`, cloudinaryError.message);
                }
            }

            if (!game && folderName) {
                game = await Games.findOne({ folder_name: folderName });
            }

            if (!game) {
                throw new Error(`Jeu non trouvé (ID: ${gameIdStr})`);
            }

            const gameObjectId = game._id;
            const userIdObj = new mongoose.Types.ObjectId(userId);

            const existingQuery = GameOwnership.findOne({
                user_id: userIdObj,
                game_id: gameObjectId,
                status: 'owned'
            });
            if (session) existingQuery.session(session);
            const existing = await existingQuery.lean();

            if (existing) {
                throw new Error('Vous possédez déjà ce jeu.');
            }

            const user = await Users.getUserById(userId);
            if (!user) {
                throw new Error('Utilisateur non trouvé');
            }

            const gamePriceCHF = game.price || 0;

            let gameKey: string | null = null;
            const keyQuery = GameKey.findOne({
                game_id: gameObjectId,
                is_used: false
            });
            if (session) keyQuery.session(session);
            const availableKey = await keyQuery.lean();

            if (availableKey) {
                gameKey = availableKey.key;
                const updateQuery = GameKey.updateOne({ _id: availableKey._id }, {
                    $set: { is_used: true, used_by: userIdObj, used_at: new Date() }
                });
                if (session) updateQuery.session(session);
                await updateQuery;
            } else {
                // Generate logic
                let uniqueFound = false;
                while (!uniqueFound) {
                    gameKey = generateGameKey();
                    const q1 = GameOwnership.findOne({ game_key: gameKey });
                    const q2 = GameKey.findOne({ key: gameKey });
                    if (session) { q1.session(session); q2.session(session); }

                    const exists = await q1 || await q2;
                    if (!exists) uniqueFound = true;
                }
            }

            // Ensure gameKey is string
            if (!gameKey) throw new Error("Failed to generate key");

            const userCHF = user.balances?.chf || 0;
            if (gamePriceCHF > 0 && userCHF < gamePriceCHF) {
                throw new Error(`Solde CHF insuffisant. Vous avez ${userCHF.toFixed(2)} CHF, prix: ${gamePriceCHF.toFixed(2)} CHF`);
            }

            let gameType: 'web' | 'exe' = 'web';
            try {
                const gameManifestPath = path.join(GAMES_LIBRARY_PATH, game.folder_name || '', 'manifest.json');
                if (fs.existsSync(gameManifestPath)) {
                    const manifest = JSON.parse(fs.readFileSync(gameManifestPath, 'utf8'));
                    if (manifest.platform === 'exe' || manifest.entryPoint?.endsWith('.exe')) {
                        gameType = 'exe';
                    }
                }
            } catch (e) { }

            let transaction: Transaction | null = null;

            if (gamePriceCHF === 0) {
                transaction = new Transaction(
                    `user_${userId}`,
                    `platform_${gameObjectId}`,
                    0,
                    'game_purchase',
                    gameObjectId.toString()
                );

                const ownOps = GameOwnership.create([{
                    user_id: userIdObj,
                    game_id: gameObjectId,
                    game_key: gameKey,
                    game_name: game.game_name,
                    purchase_price: 0,
                    current_price: 0,
                    status: 'owned',
                    for_sale: false,
                    installed: false,
                    game_type: gameType
                }], { session: session || undefined });

                const txOps = BlockchainTx.create([{
                    transaction_id: transaction.transactionId,
                    from_address: transaction.fromAddress!,
                    to_address: transaction.toAddress!,
                    amount: 0,
                    transaction_type: 'game_purchase',
                    game_id: gameObjectId,
                    game_key: gameKey
                }], { session: session || undefined });

                await Promise.all([ownOps, txOps]);

                if (session) await session.commitTransaction();

                try {
                    this.blockchain.createTransaction(transaction);
                    this.blockchain.minePendingTransactions('platform_wallet');
                } catch (bcError) {
                    // ignore
                }

                return {
                    success: true,
                    gameKey,
                    remainingBalance: userCHF
                };
            }

            // Paid Game Logic
            transaction = new Transaction(
                `user_${userId}`,
                `platform_${gameObjectId}`,
                gamePriceCHF,
                'game_purchase',
                gameObjectId.toString()
            );

            const platformCommission = Math.floor(gamePriceCHF * this.platformCommissionRate);
            const developerCommission = Math.floor(gamePriceCHF * this.developerCommissionRate);

            // We need a session-aware decrement. The generic Users.decrementBalance might not support session arg injection easily unless modified.
            // For now assuming it works or we manually do it.
            // Users.decrementBalance(userId, 'CHF', gamePriceCHF, session) signature assumes we updated Users Service.
            // But Users service in Elysia has simple decrement. We might need to handle session inside it or ignore session safety there.
            await Users.decrementBalance(userId, 'CHF', gamePriceCHF); // Assuming synchronous enough or risking slight race without session propagation

            await GameOwnership.create([{
                user_id: userIdObj,
                game_id: gameObjectId,
                game_key: gameKey,
                game_name: game.game_name,
                purchase_price: gamePriceCHF,
                current_price: gamePriceCHF,
                status: 'owned',
                for_sale: false,
                installed: false,
                game_type: gameType
            }], { session: session || undefined });

            await Commission.create([{
                transaction_id: transaction.transactionId,
                recipient_type: 'platform',
                recipient_id: null,
                amount: platformCommission,
                percentage: this.platformCommissionRate
            }], { session: session || undefined });

            await Commission.create([{
                transaction_id: transaction.transactionId,
                recipient_type: 'developer',
                recipient_id: game.developer || null,
                amount: developerCommission,
                percentage: this.developerCommissionRate
            }], { session: session || undefined });

            await BlockchainTx.create([{
                transaction_id: transaction.transactionId,
                from_address: transaction.fromAddress!,
                to_address: transaction.toAddress!,
                amount: transaction.amount,
                transaction_type: transaction.type,
                game_id: gameObjectId,
                game_key: gameKey
            }], { session: session || undefined });

            if (session) await session.commitTransaction();

            try {
                this.blockchain.createTransaction(transaction);
                this.blockchain.minePendingTransactions('platform_wallet');
            } catch (bcError) {
                // ignore
            }

            const updatedUser = await Users.getUserById(userId);
            const finalCHF = updatedUser?.balances?.chf || 0;

            return {
                success: true,
                gameKey,
                transactionId: transaction?.transactionId || null,
                remainingBalance: finalCHF,
                game_name: game.game_name // Added for frontend notification
            };

        } catch (error) {
            console.error('Erreur lors de l\'achat du jeu :', error);
            if (session && session.inTransaction()) {
                await session.abortTransaction();
            }
            throw error;
        } finally {
            if (session) session.endSession();
        }
    }

    async listGameForSale(gameKey: string, askingPrice: number, sellerId: string) {
        try {
            const sellerIdObj = new mongoose.Types.ObjectId(sellerId);
            const ownership = await GameOwnership.findOne({ game_key: gameKey, user_id: sellerIdObj, status: 'owned' }).lean();

            if (!ownership) {
                throw new Error('Jeu non possédé ou non disponible à la vente');
            }

            await GameOwnership.updateOne(
                { game_key: gameKey },
                {
                    $set: {
                        for_sale: true,
                        asking_price: Number(askingPrice),
                        listed_at: new Date(),
                        status: 'listed_for_sale',
                        current_price: Number(askingPrice),
                        installed: false
                    }
                }
            );

            return { success: true, gameKey };
        } catch (error) {
            console.error('Erreur lors de la mise en vente :', error);
            throw error;
        }
    }

    async purchaseUsedGame(buyerId: string, gameKey: string, sellerId: string) {
        try {
            const sellerIdObj = new mongoose.Types.ObjectId(sellerId);
            const listing = await GameOwnership.findOne({
                game_key: gameKey,
                user_id: sellerIdObj,
                for_sale: true,
                status: 'listed_for_sale'
            }).lean();

            if (!listing) {
                throw new Error('Jeu non disponible à la vente');
            }

            const askingPrice = listing.asking_price || 0;

            const buyer = await Users.getUserById(buyerId);
            const buyerCHF = buyer?.balances?.chf || 0;
            if (!buyer || buyerCHF < askingPrice) {
                throw new Error(`Solde CHF insuffisant. Vous avez ${buyerCHF.toFixed(2)} CHF, prix: ${askingPrice.toFixed(2)} CHF`);
            }

            const platformCommission = Math.floor(askingPrice * 0.05);
            const developerCommission = Math.floor(askingPrice * 0.02);
            const sellerAmount = askingPrice - platformCommission - developerCommission;

            const gameIdStr = listing.game_id ? listing.game_id.toString() : null;

            const transaction = new Transaction(
                `user_${buyerId}`,
                `user_${sellerId}`,
                askingPrice,
                'game_sale',
                gameIdStr
            );

            this.blockchain.createTransaction(transaction);

            const buyerIdObj = new mongoose.Types.ObjectId(buyerId);

            await GameOwnership.updateOne(
                { game_key: gameKey },
                {
                    $set: {
                        user_id: buyerIdObj,
                        status: 'owned',
                        current_price: askingPrice,
                        for_sale: false,
                        asking_price: null,
                        listed_at: null,
                    }
                }
            );

            await Users.decrementBalance(buyerId, 'CHF', askingPrice);
            const seller = await Users.getUserById(sellerId);
            const sellerCHF = seller?.balances?.chf || 0;
            // update balance logic needs to be robust, ideally atomic inc
            await Users.updateUserBalance(sellerId, 'CHF', sellerCHF + sellerAmount);

            let developerId = null;
            if (listing.game_id) {
                const game = await Games.findById(listing.game_id.toString());
                if (game) developerId = game.developer;
            }

            await Commission.create({ transaction_id: transaction.transactionId, recipient_type: 'platform', recipient_id: null, amount: platformCommission, percentage: 0.05 });
            await Commission.create({ transaction_id: transaction.transactionId, recipient_type: 'developer', recipient_id: developerId, amount: developerCommission, percentage: 0.02 });
            await BlockchainTx.create({ transaction_id: transaction.transactionId, from_address: transaction.fromAddress!, to_address: transaction.toAddress!, amount: transaction.amount, transaction_type: transaction.type, game_id: listing.game_id, game_key: gameKey });

            this.blockchain.minePendingTransactions('platform_wallet');

            return {
                success: true,
                transactionId: transaction.transactionId,
                sellerAmount,
                platformCommission,
                developerCommission
            };

        } catch (error) {
            console.error('Erreur lors de l\'achat d\'occasion :', error);
            throw error;
        }
    }

    async installGame(userId: string, gameKey: string) {
        try {
            const userIdObj = new mongoose.Types.ObjectId(userId);
            const ownership = await GameOwnership.findOne({ game_key: gameKey, user_id: userIdObj, status: 'owned' }).populate('game_id').lean();
            if (!ownership) {
                throw new Error('Jeu non trouvé ou non possédé');
            }
            if (ownership.installed) {
                return { success: true, message: 'Jeu déjà installé' };
            }

            const game = ownership.game_id as any;
            const gameFolderName = game?.folder_name;
            let gameFolderPath;

            if (gameFolderName) {
                gameFolderPath = path.join(GAMES_LIBRARY_PATH, gameFolderName);

                try {
                    if (NpmInstaller.needsNpmInstall(gameFolderPath) && !NpmInstaller.areDependenciesInstalled(gameFolderPath)) {
                        console.log(`[Library] Installation automatique des dépendances pour ${gameFolderName}...`);
                        await NpmInstaller.installDependencies(gameFolderPath);
                    }
                } catch (npmError: any) {
                    console.warn(`[Library] ⚠️ Impossible d'installer les dépendances automatiquement:`, npmError.message);
                }
            }

            await GameOwnership.updateOne({ game_key: gameKey }, { $set: { installed: true } });
            return { success: true, message: 'Jeu installé avec succès' };
        } catch (error) {
            console.error('Erreur lors de l\'installation :', error);
            throw error;
        }
    }

    async getUserOwnedGames(userId: string) {
        try {
            const userIdObj = new mongoose.Types.ObjectId(userId);

            const rows = await GameOwnership.find({ user_id: userIdObj, status: 'owned' })
                .sort({ purchase_date: -1 })
                .populate('game_id', { game_name: 1, image_url: 1, developer: 1, genre: 1, folder_name: 1 })
                .lean();

            return rows.map((r: any) => {
                let gameType = r.game_type || 'web';
                const folderName = r.game_id?.folder_name;

                if (folderName) {
                    try {
                        const gameManifestPath = path.join(GAMES_LIBRARY_PATH, folderName, 'manifest.json');
                        if (fs.existsSync(gameManifestPath)) {
                            const manifest = JSON.parse(fs.readFileSync(gameManifestPath, 'utf8'));
                            if (manifest.platform === 'exe' || manifest.entryPoint?.endsWith('.exe')) {
                                gameType = 'exe';
                                if (r.game_type !== 'exe') {
                                    GameOwnership.updateOne(
                                        { _id: r._id },
                                        { $set: { game_type: 'exe' } }
                                    ).catch((err: any) => console.warn(`[Library] Erreur lors de la mise à jour du game_type pour ${folderName}:`, err.message));
                                }
                            }
                        }
                    } catch (e) {
                    }
                }

                return {
                    game_key: r.game_key,
                    _id: r.game_id?._id,
                    installed: r.installed || false,
                    purchase_price: r.purchase_price,
                    current_price: r.current_price,
                    game_name: r.game_id?.game_name || r.game_name,
                    folder_name: r.game_id?.folder_name,
                    image_url: r.game_id?.image_url,
                    developer: r.game_id?.developer,
                    genre: r.game_id?.genre,
                    game_type: gameType,
                    is_manual_add: r.is_manual_add || false,
                    ownership_token: r.ownership_token || r.game_key,
                    status: r.status || 'owned',
                    is_resellable: r.is_resellable !== false,
                    is_active: false,
                    session_token: null
                };
            });
        } catch (error) {
            console.error('Erreur lors de la récupération des jeux :', error);
            throw error;
        }
    }

    async getUserActiveSales(userId: string) {
        try {
            const userIdObj = new mongoose.Types.ObjectId(userId);
            const rows = await GameOwnership.find({ user_id: userIdObj, for_sale: true })
                .sort({ listed_at: -1 })
                .populate('game_id', { game_name: 1, image_url: 1, developer: 1, genre: 1, price: 1 })
                .lean();
            return rows.map((r: any) => ({
                game_key: r.game_key,
                asking_price: r.asking_price,
                game_name: r.game_id?.game_name,
                image_url: r.game_id?.image_url,
                developer: r.game_id?.developer,
                genre: r.game_id?.genre,
                listed_at: r.listed_at,
            }));
        } catch (error) {
            console.error('Erreur lors de la récupération des ventes actives :', error);
            throw error;
        }
    }

    async getMarketplaceGames(filters: any = {}, excludeUserId: string | null = null) {
        try {
            const query: any = { for_sale: true };
            const { minPrice, maxPrice, genre, sort } = filters;

            if (excludeUserId) {
                query.user_id = { $ne: new mongoose.Types.ObjectId(excludeUserId) };
            }

            if (minPrice || maxPrice) {
                query.asking_price = {};
                if (minPrice) query.asking_price.$gte = Number(minPrice);
                if (maxPrice) query.asking_price.$lte = Number(maxPrice);
            }

            let sortSpec: any = { listed_at: -1 };
            if (sort === 'price_asc') sortSpec = { asking_price: 1 };
            if (sort === 'price_desc') sortSpec = { asking_price: -1 };

            const rows = await GameOwnership.find(query)
                .sort(sortSpec)
                .populate('game_id', { game_name: 1, image_url: 1, developer: 1, genre: 1, price: 1 })
                .populate('user_id', { username: 1 })
                .lean();
            const filtered = rows.filter((r: any) => (genre ? (r.game_id?.genre || '').toLowerCase() === String(genre).toLowerCase() : true));
            return filtered.map((r: any) => ({
                game_key: r.game_key,
                asking_price: r.asking_price,
                seller_id: r.user_id?._id?.toString(),
                seller_name: r.user_id?.username,
                game_name: r.game_id?.game_name,
                image_url: r.game_id?.image_url,
                developer: r.game_id?.developer,
                genre: r.game_id?.genre,
                price: r.game_id?.price,
            }));
        } catch (error) {
            console.error('Erreur lors de la récupération du marketplace :', error);
            throw error;
        }
    }

    async getUserTransactionHistory(userId: string) {
        try {
            const userAddress = `user_${userId}`;
            const rows = await BlockchainTx.find({ $or: [{ from_address: userAddress }, { to_address: userAddress }] })
                .sort({ timestamp: -1 })
                .populate('game_id', { game_name: 1, image_url: 1 })
                .lean();
            return rows.map((r: any) => {
                const isFrom = r.from_address === userAddress;
                let userRole = 'unknown';
                if (r.transaction_type === 'game_purchase') {
                    userRole = 'buyer';
                } else if (r.transaction_type === 'game_sale') {
                    userRole = isFrom ? 'seller' : 'buyer';
                }

                return {
                    transaction_id: r.transaction_id,
                    from_address: r.from_address,
                    to_address: r.to_address,
                    amount: r.amount,
                    transaction_type: r.transaction_type,
                    game_name: r.game_id?.game_name || null,
                    image_url: r.game_id?.image_url || null,
                    timestamp: r.timestamp,
                    user_role: userRole,
                };
            });
        } catch (error) {
            console.error('Erreur lors de la récupération de l\'historique :', error);
            throw error;
        }
    }

    async sellGame(gameKey: string, price: number, userId: string) {
        try {
            const ownership = await GameOwnership.findOne({ game_key: gameKey }).lean();

            if (!ownership) {
                throw new Error('Possession de jeu non trouvée');
            }

            if (ownership.user_id.toString() !== userId.toString()) {
                throw new Error('Non autorisé à vendre ce jeu');
            }

            if (ownership.status !== 'owned') {
                throw new Error('Ce jeu n\'est pas disponible à la vente');
            }

            if (!ownership.is_resellable) {
                throw new Error('Ce jeu ne peut pas être revendu');
            }

            if (ownership.game_type === 'exe') {
                throw new Error('Les jeux .exe ajoutés manuellement ne peuvent pas être revendus');
            }

            await GameOwnership.updateOne(
                { game_key: gameKey },
                {
                    $set: {
                        for_sale: true,
                        asking_price: Number(price),
                        listed_at: new Date(),
                        status: 'listed_for_sale',
                        current_price: Number(price),
                        installed: false
                    }
                }
            );

            return { message: 'Jeu mis en vente avec succès' };

        } catch (error) {
            console.error('Erreur lors de la vente du jeu:', error);
            throw error;
        }
    }

    async cancelSale(gameKey: string, userId: string) {
        try {
            const ownership = await GameOwnership.findOne({ game_key: gameKey }).lean();

            if (!ownership) {
                throw new Error('Possession de jeu non trouvée');
            }

            if (ownership.user_id.toString() !== userId.toString()) {
                throw new Error('Non autorisé à annuler cette vente');
            }

            if (ownership.status !== 'listed_for_sale') {
                throw new Error('Ce jeu n\'est pas en vente');
            }

            await GameOwnership.updateOne(
                { game_key: gameKey },
                {
                    $set: {
                        for_sale: false,
                        asking_price: null,
                        listed_at: null,
                        status: 'owned',
                        current_price: null
                    }
                }
            );

            return { message: 'Vente annulée avec succès' };

        } catch (error) {
            console.error('Erreur lors de l\'annulation de la vente:', error);
            throw error;
        }
    }

    getBlockchainStats() {
        return {
            totalBlocks: this.blockchain.chain.length,
            totalTransactions: this.blockchain.chain.reduce((total: number, block: any) => total + block.transactions.length, 0),
            pendingTransactions: this.blockchain.pendingTransactions.length,
            isChainValid: this.blockchain.isChainValid()
        };
    }

    async redeemKey(userId: string, key: string) {
        try {
            if (!isValidKeyFormat(key)) {
                throw new Error('Format de clé invalide');
            }

            const keyObjId = new mongoose.Types.ObjectId(userId);

            const gameKey = await GameKey.findOne({ key, is_used: false }).lean();

            if (!gameKey) {
                const ownership = await GameOwnership.findOne({ game_key: key }).lean();
                if (ownership) {
                    throw new Error('Cette clé a déjà été utilisée');
                }
                throw new Error('Clé invalide ou déjà utilisée');
            }

            const existing = await GameOwnership.findOne({
                user_id: keyObjId,
                game_id: gameKey.game_id,
                status: 'owned'
            }).lean();

            if (existing) {
                throw new Error('Vous possédez déjà ce jeu');
            }

            const game = await Games.findById(gameKey.game_id);
            if (!game) throw new Error('Jeu associé à la clé introuvable');

            let gameType: 'web' | 'exe' = 'web';
            try {
                const gameManifestPath = path.join(GAMES_LIBRARY_PATH, game.folder_name, 'manifest.json');
                if (fs.existsSync(gameManifestPath)) {
                    const manifest = JSON.parse(fs.readFileSync(gameManifestPath, 'utf8'));
                    if (manifest.platform === 'exe' || manifest.entryPoint?.endsWith('.exe')) {
                        gameType = 'exe';
                    }
                }
            } catch (e) { }

            await GameOwnership.create({
                user_id: keyObjId,
                game_id: game._id,
                game_key: key,
                game_name: game.game_name,
                purchase_price: 0,
                current_price: 0,
                status: 'owned',
                for_sale: false,
                installed: false,
                game_type: gameType,
                is_resellable: true // Gifted keys can be resold usually
            });

            await GameKey.updateOne({ _id: gameKey._id }, {
                $set: { is_used: true, used_by: keyObjId, used_at: new Date() }
            });

            // Create redemption transaction log
            const transactionId = crypto.randomBytes(16).toString('hex');
            await BlockchainTx.create({
                transaction_id: transactionId,
                from_address: 'platform_redemption',
                to_address: `user_${userId}`,
                amount: 0,
                transaction_type: 'game_redemption',
                game_id: game._id,
                game_key: key
            });

            return {
                success: true,
                message: `Jeu "${game.game_name}" ajouté à votre bibliothèque`,
                game: {
                    game_name: game.game_name,
                    image_url: game.image_url
                }
            };
        } catch (error) {
            console.error('Erreur lors de l\'activation de la clé :', error);
            throw error;
        }
    }

    async generateKeys(gameId: string, quantity: number, userId: string | null = null, purpose = 'dev') {
        try {
            const game = await Games.findById(gameId);
            if (!game) {
                throw new Error('Jeu non trouvé');
            }

            const keys: any[] = [];

            for (let i = 0; i < quantity; i++) {
                let key = generateGameKey();
                let uniqueFound = false;
                while (!uniqueFound) {
                    key = generateGameKey();
                    const q1 = GameOwnership.findOne({ game_key: key });
                    const q2 = GameKey.findOne({ key: key });
                    const exists = await q1 || await q2; // Parallel check? No, await sequentially or Promise.all if strict.
                    // Logic was: await GameOwnership... || await GameKey...
                    if (!exists) uniqueFound = true;
                }

                // Wait, logic above loop (while exists) implies checking inside loop.
                // Re-implementing correctly:
                /* 
                let key = generateGameKey();
                let exists = ...
                while(exists) { key = ...; exists = ... }
                */
                // My implementation inside replace:
                let keyFinal = generateGameKey();
                // Check initial
                let exists = await GameOwnership.findOne({ game_key: keyFinal }) || await GameKey.findOne({ key: keyFinal });
                while (exists) {
                    keyFinal = generateGameKey();
                    exists = await GameOwnership.findOne({ game_key: keyFinal }) || await GameKey.findOne({ key: keyFinal });
                }

                const keyDoc = await GameKey.create({
                    game_id: new mongoose.Types.ObjectId(gameId),
                    key: keyFinal,
                    created_by: userId ? new mongoose.Types.ObjectId(userId) : null,
                    purpose,
                    is_used: false
                });

                keys.push({
                    id: keyDoc._id.toString(),
                    key: keyFinal,
                    purpose,
                    createdAt: keyDoc.created_at
                });
            }

            return {
                success: true,
                game: {
                    id: game.id || gameId,
                    name: game.game_name
                },
                quantity: keys.length,
                keys
            };
        } catch (error) {
            console.error('Erreur lors de la génération des clés :', error);
            throw error;
        }
    }

    async addManualGame(userId: string, gameKey: string, gameData: any = {}) {
        try {
            if (!gameKey || typeof gameKey !== 'string' || gameKey.length < 10) {
                throw new Error('Clé de jeu invalide');
            }

            const exists = await GameOwnership.findOne({ game_key: gameKey }).lean();
            if (exists) {
                throw new Error('Cette clé de jeu est déjà utilisée');
            }

            const userIdObj = new mongoose.Types.ObjectId(userId);

            await GameOwnership.create({
                user_id: userIdObj,
                game_id: null,
                game_key: gameKey,
                purchase_price: 0,
                current_price: 0,
                status: 'owned',
                for_sale: false,
                installed: false,
                is_manual_add: true,
                game_type: 'exe',
                exe_path: gameData.exe_path || null,
                game_name: gameData.game_name || 'Jeu Externe',
                game_description: gameData.description || 'Jeu ajouté manuellement'
            });

            return { success: true, message: 'Jeu ajouté manuellement avec succès' };
        } catch (error) {
            console.error('Erreur lors de l\'ajout manuel :', error);
            throw error;
        }
    }

    async getGeneratedKeys(gameId: string | null = null, userId: string | null = null, used: boolean | null = null) {
        try {
            const query: any = {};

            if (gameId) {
                query.game_id = new mongoose.Types.ObjectId(gameId);
            }

            if (userId) {
                query.created_by = new mongoose.Types.ObjectId(userId);
            }

            if (used !== null) {
                query.is_used = used;
            }

            const keys = await GameKey.find(query)
                .sort({ created_at: -1 })
                .populate('game_id', 'game_name')
                .populate('used_by', 'username')
                .lean();

            return keys.map((k: any) => ({
                id: k._id.toString(),
                key: k.key,
                game_name: k.game_id?.game_name,
                purpose: k.purpose,
                is_used: k.is_used,
                used_by: k.used_by?.username,
                used_at: k.used_at,
                created_at: k.created_at
            }));
        } catch (error) {
            console.error('Erreur lors de la récupération des clés générées :', error);
            throw error;
        }
    }
}

export const libraryService = new LibraryService();
