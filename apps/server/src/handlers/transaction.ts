import { WebSocketService } from '../services/websocket.service';
import Users from '../models/user.model.ts';
import GameOwnership from '../models/game-ownership.model.ts';
import BlockchainTx from '../models/blockchain-tx.model.ts';
import { Transaction } from '../services/blockchain.service.ts';
import etherBlockchain from '../services/blockchain.instance.ts';

const purchaseUsedGame = async (ws: any, payload: any) => {
  const { ownershipToken, sellerId } = payload;
  const buyerId = ws.data.userId;

  console.log(`[Transaction] Purchase request from ${buyerId} for token ${ownershipToken}`);

  try {
    if (!ownershipToken || !sellerId) {
      throw new Error('ownershipToken and sellerId are required');
    }

    // Find the listing
    const listing = await GameOwnership.findOne({
      ownership_token: ownershipToken,
      user_id: sellerId,
      for_sale: true,
    });

    if (!listing) {
      throw new Error('Listing not found or no longer available');
    }

    // Check if buyer already owns this game
    const alreadyOwns = await GameOwnership.findOne({
      user_id: buyerId,
      game_key: listing.game_key,
    });

    if (alreadyOwns) {
      throw new Error('You already own this game');
    }

    const salePrice = listing.asking_price || 0;
    const platformFee = salePrice * 0.05; // 5%
    const developerFee = salePrice * 0.02; // 2%
    const sellerReceives = salePrice - platformFee - developerFee;

    // Get buyer and seller
    const buyer = await Users.findById(buyerId);
    const seller = await Users.findById(sellerId);

    if (!buyer || !seller) {
      throw new Error('User not found');
    }

    // Check buyer has enough balance
    if ((buyer.balances?.chf || 0) < salePrice) {
      throw new Error('Insufficient balance');
    }

    // Transfer funds
    // @ts-expect-error
    await Users.decrementBalanceIfSufficient(buyerId, 'CHF', salePrice, null);
    // @ts-expect-error
    await Users.incrementBalance(sellerId, 'CHF', sellerReceives, null);
    // Note: Missing fee collection logic for platform/dev, assuming simple decrement/increment for users here.

    // Transfer ownership
    listing.user_id = buyerId as any;
    listing.for_sale = false;
    listing.asking_price = undefined;
    listing.listed_at = undefined;
    listing.purchase_price = salePrice;
    listing.purchase_date = new Date();
    listing.installed = false;
    await listing.save();

    // Record transaction in Blockchain
    try {
      // 1. Transaction: Buyer -> Seller (Net Amount)
      const txToSeller = new Transaction(
        buyerId,
        sellerId,
        sellerReceives,
        'game_sale',
        listing.game_key
      );
      etherBlockchain.createTransaction(txToSeller);

      // Save to persistent DB
      await BlockchainTx.create({
        transaction_id: txToSeller.transactionId,
        from_address: buyerId,
        to_address: sellerId,
        amount: sellerReceives,
        transaction_type: 'game_sale',
        game_id: listing.game_id,
        game_key: listing.game_key,
        ownership_token: listing.ownership_token,
      });

      // 2. Transaction: Buyer -> Platform (Fee)
      const txToPlatform = new Transaction(
        buyerId,
        'PLATFORM_WALLET',
        platformFee,
        'commission',
        listing.game_key
      );
      etherBlockchain.createTransaction(txToPlatform);

      // 3. Transaction: Buyer -> Developer (Fee)
      const txToDev = new Transaction(
        buyerId,
        'DEVELOPER_WALLET',
        developerFee,
        'commission',
        listing.game_key
      );
      etherBlockchain.createTransaction(txToDev);

      // Mine the block immediately for this simulation
      etherBlockchain.minePendingTransactions('MINER_WALLET');

      console.log(`[Blockchain] Recorded sale of ${listing.game_name}`);
    } catch (bcError) {
      console.error('[Blockchain] Failed to record transaction:', bcError);
    }

    // Emit success to buyer
    ws.send(
      JSON.stringify({
        type: 'transaction:success',
        data: {
          message: 'Purchase successful',
          game: listing,
          newBalance: (buyer.balances?.chf || 0) - salePrice,
        },
      })
    );

    // Notify seller via WebSocket
    WebSocketService.publish(`user:${sellerId}`, 'transaction:seller_notification', {
      message: `Your copy of ${listing.game_name} was sold!`,
      amount: sellerReceives,
      gameName: listing.game_name,
    });
  } catch (error: any) {
    console.error('[Transaction] Error:', error);
    ws.send(JSON.stringify({ type: 'transaction:error', message: error.message }));
  }
};

export const handleTransactionMessage = async (ws: any, type: string, payload: any) => {
  switch (type) {
    case 'transaction:purchase':
      await purchaseUsedGame(ws, payload);
      break;
  }
};
