
import { ItemModel } from './items.model';
import { UserItemModel } from './userItems.model';
import { Users } from '@vext/database';
import { CloudinaryService } from '../../services/cloudinary.service';
import BlockchainTx from '../library/blockchainTx.model';
import mongoose from 'mongoose';
import crypto from 'crypto';

import { redisService } from '../../services/redis.service';

// Stub Cache removed, using redisService
const logger = { info: console.log, warn: console.warn, error: console.error };

export class ItemsService {
    static async getAllItems(filters: any = {}) {
        try {
            if (filters.is_archived === undefined) {
                filters.is_archived = { $ne: true };
            }

            const cacheKey = `items:store:${JSON.stringify(filters)}`;

            try {
                const cachedData = await redisService.get(cacheKey);
                if (cachedData) {
                    return JSON.parse(cachedData);
                }
            } catch (cacheError: any) {
                logger.warn('[Items] Redis cache error:', cacheError.message);
            }

            const docs = await ItemModel.find(filters).lean();
            const formattedDocs = docs.map((d: any) => ({ id: d._id.toString(), ...d }));

            try {
                // Cache with 24h TTL
                await redisService.setWithTTL(cacheKey, JSON.stringify(formattedDocs));
            } catch (cacheError: any) {
                logger.warn('[Items] Failed to save to Redis:', cacheError.message);
            }

            return formattedDocs;
        } catch (error) {
            logger.error('[Items] ❌ Error fetching items:', error);
            throw error;
        }
    }

    static async getItemsFromCloudinary() {
        // Implementation reliant on Cloudinary library direct usage in original.
        // In Elysia backend we have CloudinaryService. We can use it or reimplement.
        // Original logic was listing files and parsing filenames.
        // We will assume CloudinaryService handles this or we can add it there if needed.
        // For now, let's keep it simple or delegate to CloudinaryService if possible, or stub it if not critical for backend migration immediate runtime.
        // The original method used `cloudinary.api.resources` which is Admin API.
        // We can create a Cloudinary instance here if needed if we import v2.
        const { v2: cloudinary } = require('cloudinary'); // Dynamic require akin to original

        try {
            const result = await cloudinary.api.resources({
                type: 'upload',
                prefix: 'items/',
                max_results: 500
            });

            const items = result.resources.map((resource: any, index: number) => {
                const pathParts = resource.public_id.split('/');
                const folderName = pathParts[1] || 'other';
                const filename = pathParts[pathParts.length - 1];

                let itemType = 'other';
                if (folderName === 'banners') itemType = 'banner';
                else if (folderName === 'avatar_frames') itemType = 'avatar_frame';
                else if (folderName === 'profile_pictures' || folderName === 'avatars') itemType = 'profile_picture';
                else if (folderName === 'badges') itemType = 'badge';
                else if (folderName === 'backgrounds') itemType = 'background';
                else itemType = 'other';

                const rarities = ['common', 'rare', 'epic', 'legendary'];
                const rarity = rarities[index % 4];

                let description = 'Un objet cosmétique';
                if (itemType === 'banner') description = 'Bannière de profil';
                if (itemType === 'avatar_frame') description = 'Cadre d\'avatar';
                if (itemType === 'profile_picture') description = 'Photo de profil';
                if (itemType === 'badge') description = 'Badge honorifique';
                if (itemType === 'background') description = 'Arrière-plan de profil';

                return {
                    id: resource.asset_id || resource.public_id.replace(/\//g, '_'),
                    name: filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
                    description: `${description} (${rarity})`,
                    image_url: resource.secure_url,
                    item_type: itemType,
                    rarity: rarity,
                    price: (rarity === 'common' ? 100 : rarity === 'rare' ? 250 : rarity === 'epic' ? 500 : 1000) * (itemType === 'banner' ? 2 : 1),
                    created_at: resource.created_at,
                    cloudinary_id: resource.public_id
                };
            });
            return items;
        } catch (e: any) {
            logger.error("Cloudinary fetch failed", e);
            return [];
        }
    }

    static async getItemById(itemId: string) {
        if (!mongoose.Types.ObjectId.isValid(itemId)) return null;
        const doc = await ItemModel.findById(itemId).lean();
        if (!doc) return null;
        return { id: doc._id.toString(), ...doc };
    }

    static async searchItems(query: string) {
        try {
            const docs = await ItemModel.find(
                { $text: { $search: query } },
                { score: { $meta: 'textScore' } }
            )
                .sort({ score: { $meta: 'textScore' } })
                .lean();

            if (docs.length > 0) {
                return docs.map((d: any) => ({ id: d._id.toString(), ...d }));
            }
        } catch (err: any) {
            logger.warn('[Items] Text search fallback:', err.message);
        }

        const regex = new RegExp(query, 'i');
        const docs = await ItemModel.find({ $or: [{ name: regex }, { description: regex }] }).lean();
        return docs.map((d: any) => ({ id: d._id.toString(), ...d }));
    }

    static async getUserItems(userId: string) {
        const docs = await UserItemModel.find({ user_id: userId })
            .populate('item_id')
            .lean();
        return docs.map((d: any) => {
            const item = d.item_id as any;
            return {
                id: d._id.toString(),
                item: item ? {
                    id: item._id ? item._id.toString() : item.id,
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    image_url: d.user_image_url || item.image_url,
                    item_type: item.item_type,
                    rarity: item.rarity
                } : null,
                purchased_at: d.purchased_at,
                is_equipped: d.is_equipped
            };
        }).filter(d => d.item !== null);
    }

    static async getUserItem(userId: string, itemId: string) {
        const doc = await UserItemModel.findOne({ user_id: userId, item_id: itemId })
            .populate('item_id')
            .lean();
        if (!doc) return null;
        return {
            id: doc._id.toString(),
            item: doc.item_id,
            purchased_at: doc.purchased_at,
            is_equipped: doc.is_equipped
        };
    }

    static async addUserItem(userId: string, itemId: string, userImageUrl: string | null = null) {
        try {
            const doc = await UserItemModel.create({
                user_id: userId,
                item_id: itemId,
                user_image_url: userImageUrl
            });
            return doc._id.toString();
        } catch (error: any) {
            if (error.code === 11000) {
                throw new Error('Vous possédez déjà cet item');
            }
            throw error;
        }
    }

    static async equipItem(userId: string, itemId: string) {
        const item = await this.getItemById(itemId);
        if (!item) throw new Error('Item non trouvé');

        const allUserItems = await UserItemModel.find({ user_id: userId })
            .populate('item_id')
            .lean();

        for (const userItem of allUserItems) {
            const currentItem = userItem.item_id as any;
            if (currentItem && currentItem.item_type === (item as any).item_type) {
                await UserItemModel.updateOne(
                    { _id: userItem._id },
                    { $set: { is_equipped: false } }
                );
            }
        }

        const result = await UserItemModel.updateOne(
            { user_id: userId, item_id: itemId },
            { $set: { is_equipped: true } }
        );
        return result.modifiedCount > 0;
    }

    static async getEquippedItem(userId: string, itemType: string) {
        try {
            const userIdObj = mongoose.Types.ObjectId.isValid(userId)
                ? (typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId)
                : null;

            if (!userIdObj) {
                return null;
            }

            const doc = await UserItemModel.findOne({
                user_id: userIdObj,
                is_equipped: true
            })
                .populate({
                    path: 'item_id',
                    match: { item_type: itemType }
                })
                .lean();

            if (!doc || !doc.item_id) {
                return null;
            }

            const item = { ...(doc.item_id as any) };
            if (doc.user_image_url) {
                item.image_url = doc.user_image_url;
            }
            return item;
        } catch (error: any) {
            logger.error(`[getEquippedItem] ❌ Erreur:`, error.message);
            return null;
        }
    }

    static async unequipItem(userId: string, itemId: string) {
        try {
            const result = await UserItemModel.updateOne(
                { user_id: userId, item_id: itemId },
                { $set: { is_equipped: false } }
            );

            return result.modifiedCount > 0;
        } catch (error: any) {
            logger.error(`[unequipItem] ❌ Erreur:`, error.message);
            throw error;
        }
    }

    static async getAll(userId: string | null = null, filters: any = {}) {
        try {
            const items = await this.getAllItems(filters);

            if (userId) {
                const userItems = await this.getUserItems(userId);
                const ownedItemIds = new Set(userItems.map((ui: any) => ui.item?.id));

                return items.map((item: any) => ({
                    ...item,
                    owned: ownedItemIds.has(item.id),
                    equipped: userItems.find((ui: any) => ui.item?.id === item.id && ui.is_equipped) !== undefined
                }));
            }

            return items;
        } catch (error) {
            logger.error('Erreur lors de la récupération de tous les items :', error);
            throw new Error('Erreur lors de la récupération de tous les items.');
        }
    }

    static async purchaseItem(userId: string, itemId: string) {
        try {
            const existingItem = await this.getUserItem(userId, itemId);
            if (existingItem) {
                throw new Error('Vous possédez déjà cet item');
            }

            const item = await this.getItemById(itemId);
            if (!item) {
                throw new Error('Item non trouvé');
            }

            if ((item as any).is_archived) {
                throw new Error('Cet item est "Legacy" (archivé) et n\'est plus disponible à l\'achat dans la boutique officielle.');
            }

            const user = await Users.getUserById(userId);
            if (!user) {
                throw new Error('Utilisateur non trouvé');
            }

            if ((user.tokens || 0) < (item.price || 0)) {
                throw new Error(`Solde insuffisant. Vous avez ${user.tokens} tokens, prix: ${item.price} tokens`);
            }

            const newTokens = (user.tokens || 0) - (item.price || 0);
            await Users.updateUserTokens(userId, newTokens);

            const userImageUrl = null;
            await this.addUserItem(userId, itemId, userImageUrl);

            if (item.item_type === 'profile_picture') {
                const equippedPDP = await this.getEquippedItem(userId, 'profile_picture');
                if (!equippedPDP) {
                    await this.equipItem(userId, itemId);
                }
            }

            await BlockchainTx.create({
                transaction_id: `tx_${crypto.randomBytes(8).toString('hex')}`,
                from_address: userId,
                to_address: 'system_store',
                amount: item.price,
                transaction_type: 'item_purchase',
                currency: 'VTX',
                item_id: itemId,
                timestamp: new Date()
            });

            return {
                success: true,
                remainingTokens: newTokens,
                item: item
            };
        } catch (error) {
            logger.error('Erreur lors de l\'achat de l\'item :', error);
            throw error;
        } finally {
            // Invalidate cache to reflect stock changes if any (optional, but good practice)
            // await redisService.deletePattern('items:all:*'); 
        }
    }

    static async equip(userId: string, itemId: string) {
        try {
            const userItem = await this.getUserItem(userId, itemId);
            if (!userItem) {
                throw new Error('Vous ne possédez pas cet item');
            }

            await this.equipItem(userId, itemId);

            const item = await this.getItemById(itemId);
            const newProfilePicUrl = item && item.item_type === 'profile_picture' ? item.image_url : null;

            if (newProfilePicUrl) {
                await Users.updateUserProfilePic(userId, newProfilePicUrl);
            }

            return {
                success: true,
                profile_pic_url: newProfilePicUrl
            };
        } catch (error) {
            logger.error('Erreur lors de l\'équipement de l\'item :', error);
            throw error;
        }
    }

    static async unequip(userId: string, itemId: string) {
        try {
            const userItem = await this.getUserItem(userId, itemId);
            if (!userItem) {
                throw new Error('Vous ne possédez pas cet item');
            }

            const success = await this.unequipItem(userId, itemId);
            return { success: success };
        } catch (error) {
            logger.error('Erreur lors du déséquipement de l\'item :', error);
            throw error;
        }
    }

    static async archiveItem(itemId: string) {
        try {
            const item = await ItemModel.findById(itemId);
            if (!item) {
                throw new Error('Item non trouvé');
            }

            item.is_archived = true;
            await item.save();

            return { success: true, message: 'Item archivé avec succès. Les propriétaires actuels le conservent.' };
        } catch (error) {
            logger.error('Erreur lors de l\'archivage de l\'item :', error);
            throw error;
        }
    }
}

export const itemsService = ItemsService;
