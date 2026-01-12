
import { GameOwnershipModel, IGameOwnership } from './game-ownership.model';
import { Users } from '@vext/database';
import Games, { GameModel } from '../games/game.model';
import mongoose from 'mongoose';
import { BlockchainTxModel } from '../library/blockchainTx.model';
import { ItemModel } from '../items/items.model';
import crypto from 'crypto';

interface GameDetails {
    game_name: string;
    genre: string;
    image_url: string;
    description: string;
    game_id?: string;
    status?: string;
}

export class GameOwnershipService {
    /**
     * Helper to populate game details from Games collection
     */
    static async _populateGameDetails(ownershipDocs: any[]): Promise<any[]> {
        if (!ownershipDocs || ownershipDocs.length === 0) return [];

        // Extract unique keys and IDs
        const gameKeys = [...new Set(ownershipDocs.map(d => d.game_key).filter(k => k))];
        const gameIds = [...new Set(ownershipDocs.map(d => d.game_id || d.gameId).filter(id => id))];

        console.log('[GameOwnership] Populating details. Keys:', gameKeys, 'IDs:', gameIds);

        // Fetch game details from Games collection
        const games = await Games.getGamesByKeysOrIds(gameKeys, gameIds);

        // Create maps for quick lookup
        const gamesByFolder: Record<string, any> = {};
        const gamesById: Record<string, any> = {};

        games.forEach(g => {
            if (g.folder_name) gamesByFolder[g.folder_name] = g;
            if (g._id) gamesById[g._id.toString()] = g;
        });

        // Merge details
        return ownershipDocs.map(doc => {
            const docObj = doc.toObject ? doc.toObject() : doc;

            // Try to find game details by ID first, then by folder name (key)
            const gameId = docObj.game_id || docObj.gameId;
            let gameDetails: any = null;

            if (gameId && gamesById[gameId.toString()]) {
                gameDetails = gamesById[gameId.toString()];
            } else if (docObj.game_key && gamesByFolder[docObj.game_key]) {
                gameDetails = gamesByFolder[docObj.game_key];
            }

            // Base result with ownership fields preserved
            const result: any = {
                _id: docObj._id,
                user_id: docObj.user_id,
                seller_id: docObj.user_id, // Map user_id to seller_id for frontend compatibility
                game_key: docObj.game_key,
                game_name: docObj.game_name,
                ownership_token: docObj.ownership_token,
                for_sale: docObj.for_sale,
                asking_price: docObj.asking_price,
                listed_at: docObj.listed_at,
                purchase_price: docObj.purchase_price,
                purchase_date: docObj.purchase_date,
                installed: docObj.installed
            };

            if (gameDetails) {
                result.game_name = gameDetails.game_name || docObj.game_name;
                result.genre = gameDetails.genre || 'N/A';
                result.image_url = gameDetails.image_url || '';
                result.description = gameDetails.description || '';
                result.game_id = gameDetails._id.toString();
            } else {
                result.genre = 'N/A';
                result.image_url = '';
            }

            return result;
        });
    }

    /**
     * Get all games owned by a user
     */
    static async getUserGames(userId: string): Promise<any[]> {
        const docs = await GameOwnershipModel.find({ user_id: userId }).sort({ purchase_date: -1 });
        return await this._populateGameDetails(docs);
    }

    /**
     * Redeem a game key (manual add)
     */
    static async redeemKey(userId: string, gameKey: string, gameName?: string): Promise<IGameOwnership> {
        // Check if user already owns this game
        const existing = await GameOwnershipModel.findOne({ user_id: userId, game_key: gameKey });
        if (existing) {
            throw new Error('You already own this game');
        }

        const ownership = new GameOwnershipModel({
            user_id: userId,
            game_key: gameKey,
            game_name: gameName || `Game ${gameKey}`,
            is_manual_add: true,
            purchase_price: 0
        });

        const savedOwnership = await ownership.save();

        // Try to find game_id if possible
        let gameId = null;
        const gameDetails = await Games.getGameByName(gameKey);
        if (gameDetails) gameId = gameDetails._id;

        await BlockchainTxModel.create({
            transaction_id: `tx_${crypto.randomBytes(8).toString('hex')}`,
            from_address: 'system_redemption',
            to_address: userId,
            amount: 0,
            transaction_type: 'game_redemption',
            game_key: gameKey,
            game_id: gameId,
            ownership_token: savedOwnership.ownership_token,
            timestamp: new Date()
        });

        return savedOwnership;
    }

    /**
     * Mark game as installed
     */
    static async installGame(userId: string, gameKey: string): Promise<IGameOwnership> {
        const ownership = await GameOwnershipModel.findOneAndUpdate(
            { user_id: userId, game_key: gameKey },
            { installed: true },
            { new: true }
        );

        if (!ownership) {
            throw new Error('Game not found in your library');
        }

        return ownership;
    }

    /**
     * List a game for sale
     */
    static async listForSale(userId: string, gameKey: string, askingPrice: number): Promise<IGameOwnership> {
        if (askingPrice <= 0) {
            throw new Error('Asking price must be greater than 0');
        }

        const ownership = await GameOwnershipModel.findOne({
            user_id: userId,
            game_key: gameKey
        });

        if (!ownership) {
            throw new Error('Game not found in your library');
        }

        if (ownership.for_sale) {
            throw new Error('Game is already listed for sale');
        }

        // FIX: Ensure game_name is present before saving
        if (!ownership.game_name) {
            const gameDetails = await Games.getGameById(String(ownership.game_id)) || await Games.getGameByName(ownership.game_key);
            ownership.game_name = gameDetails ? gameDetails.game_name : `Game ${ownership.game_key}`;
        }

        ownership.for_sale = true;
        ownership.asking_price = askingPrice;
        ownership.listed_at = new Date();
        ownership.installed = false; // Mark as uninstalled when listed

        return await ownership.save();
    }

    /**
     * Cancel a sale listing
     */
    static async cancelSale(userId: string, ownershipToken: string): Promise<IGameOwnership> {
        const ownership = await GameOwnershipModel.findOne({
            user_id: userId,
            ownership_token: ownershipToken
        });

        if (!ownership) {
            throw new Error('Listing not found');
        }

        ownership.for_sale = false;
        ownership.asking_price = null;
        ownership.listed_at = undefined;

        return await ownership.save();
    }

    /**
     * Get marketplace listings (games for sale)
     */
    static async getMarketplace(filters: any = {}, userId: string | null = null): Promise<any[]> {
        const query: any = { for_sale: true };

        // Exclude own listings if userId is provided
        if (userId) {
            query.user_id = { $ne: userId };
        }

        // Filter by price range
        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            query.asking_price = {};
            if (filters.minPrice !== undefined) query.asking_price.$gte = parseFloat(filters.minPrice);
            if (filters.maxPrice !== undefined) query.asking_price.$lte = parseFloat(filters.maxPrice);
        }

        const docs = await GameOwnershipModel.find(query)
            .populate('user_id', 'username')
            .sort({ listed_at: -1 })
            .limit(100)
            .lean();

        return await this._populateGameDetails(docs);
    }

    /**
     * Purchase a used game from marketplace
     * @deprecated Moved to WebSocket server
     */
    static async purchaseUsedGame(buyerId: string, ownershipToken: string, sellerId: string): Promise<any> {
        throw new Error('This endpoint is deprecated. Please use WebSocket transaction:purchase event.');
    }

    /**
     * Get market statistics for a specific game
     */
    static async getGameStats(gameKey: string): Promise<any> {
        // 1. Average Price (from historical sales)
        const sales = await GameOwnershipModel.find({
            game_key: gameKey,
            purchase_price: { $gt: 0 }, // Only actual sales
            is_manual_add: false
        });

        let averagePrice = 0;
        if (sales.length > 0) {
            const total = sales.reduce((sum, sale) => sum + (sale.purchase_price || 0), 0);
            averagePrice = total / sales.length;
        }

        // 2. Lowest Active Price
        const activeListings = await GameOwnershipModel.find({
            game_key: gameKey,
            for_sale: true
        }).sort({ asking_price: 1 }).limit(1);

        const lowestPrice = activeListings.length > 0 ? activeListings[0].asking_price : null;

        // 3. Total Active Listings
        const totalListings = await GameOwnershipModel.countDocuments({
            game_key: gameKey,
            for_sale: true
        });

        return {
            gameKey,
            averagePrice,
            lowestPrice,
            totalListings,
            totalSales: sales.length
        };
    }

    /**
     * Get user's active sales
     */
    static async getActiveSales(userId: string): Promise<any[]> {
        const docs = await GameOwnershipModel.find({
            user_id: userId,
            for_sale: true
        }).sort({ listed_at: -1 });
        return await this._populateGameDetails(docs);
    }

    /**
     * Get transaction history (persistent)
     */
    static async getTransactions(userId: string): Promise<any[]> {
        // Find all transactions where user is sender (seller) or receiver (buyer)
        const transactions = await BlockchainTxModel.find({
            $or: [
                { from_address: userId },
                { to_address: userId }
            ]
        }).sort({ timestamp: -1 }).limit(50).lean();

        // Populate details
        const enrichedTransactions = await Promise.all(transactions.map(async (tx) => {
            let name = 'Unknown';
            let type = 'unknown';

            if (tx.transaction_type === 'item_purchase') {
                type = 'item_purchase';
                if (tx.item_id) {
                    const item = await ItemModel.findById(tx.item_id);
                    name = item ? item.name : 'Unknown Item';
                }
            } else if (tx.transaction_type === 'game_redemption') {
                type = 'redemption';
                if (tx.game_id) {
                    const game = await Games.getGameById(tx.game_id.toString());
                    if (game) name = game.game_name;
                } else if (tx.game_key) {
                    const game = await Games.getGameByName(tx.game_key);
                    if (game) name = game.game_name;
                    else name = tx.game_key;
                }
            } else {
                // Game purchase/sale
                if (tx.game_id) {
                    const game = await Games.getGameById(tx.game_id.toString());
                    if (game) name = game.game_name;
                } else if (tx.game_key) {
                    const game = await Games.getGameByName(tx.game_key);
                    if (game) name = game.game_name;
                }

                if (tx.transaction_type === 'game_purchase') {
                    type = 'purchase';
                } else if (tx.transaction_type === 'game_sale') {
                    type = tx.from_address === userId ? 'sale' : 'purchase';
                }
            }

            return {
                id: (tx as any)._id,
                game_name: name, // Frontend uses 'game_name' for display, we can reuse it or add 'name'
                type: type,
                amount: tx.amount,
                currency: tx.currency || 'VTX', // Default to VTX if missing
                created_at: tx.timestamp
            };
        }));

        return enrichedTransactions;
    }

    /**
     * Delete a marketplace listing (Admin or Owner)
     */
    static async deleteListing(userId: string, ownershipToken: string): Promise<any> {
        // 1. Get the user to check if admin
        const user = await Users.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // 2. Find the listing
        const ownership = await GameOwnershipModel.findOne({
            ownership_token: ownershipToken
        });

        if (!ownership) {
            throw new Error('Listing not found');
        }

        // 3. Check permissions (Admin or Owner)
        const isOwner = ownership.user_id.toString() === userId;
        const isAdmin = user.isAdmin === true;

        if (!isOwner && !isAdmin) {
            throw new Error('Unauthorized: You can only delete your own listings unless you are an admin');
        }

        // 4. Remove from sale
        ownership.for_sale = false;
        ownership.asking_price = null;
        ownership.listed_at = undefined;

        await ownership.save();

        return { success: true, message: 'Listing removed successfully' };
    }
}
