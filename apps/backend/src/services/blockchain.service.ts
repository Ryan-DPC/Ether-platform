
import crypto from 'crypto';

export class Transaction {
    fromAddress: string | null;
    toAddress: string | null;
    amount: number;
    type: string;
    gameId: string | null;
    timestamp: number;
    transactionId: string;

    constructor(fromAddress: string | null, toAddress: string | null, amount: number, type = 'transfer', gameId: string | null = null) {
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
        this.type = type; // 'transfer', 'game_purchase', 'game_sale', 'commission', 'mining_reward'
        this.gameId = gameId;
        this.timestamp = Date.now();
        this.transactionId = this.generateTransactionId();
    }

    generateTransactionId(): string {
        return crypto
            .createHash('sha256')
            .update(
                (this.fromAddress || '') +
                (this.toAddress || '') +
                this.amount +
                this.timestamp +
                Math.random()
            )
            .digest('hex');
    }

    isValid(): boolean {
        // Les récompenses de minage peuvent avoir fromAddress = null
        if (this.type === 'mining_reward') {
            return this.amount > 0 && !!this.toAddress;
        }
        // Pour les autres transactions, fromAddress et toAddress sont requis
        return this.amount > 0 && !!this.fromAddress && !!this.toAddress;
    }
}

export class Block {
    timestamp: number;
    transactions: Transaction[];
    previousHash: string;
    nonce: number;
    hash: string;

    constructor(timestamp: number, transactions: Transaction[], previousHash = '') {
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.nonce = 0;
        this.hash = this.calculateHash();
    }

    calculateHash(): string {
        return crypto
            .createHash('sha256')
            .update(
                this.previousHash +
                this.timestamp +
                JSON.stringify(this.transactions) +
                this.nonce
            )
            .digest('hex');
    }

    mineBlock(difficulty: number): void {
        const target = Array(difficulty + 1).join('0');

        while (this.hash.substring(0, difficulty) !== target) {
            this.nonce++;
            this.hash = this.calculateHash();
        }

        console.log(`Block mined: ${this.hash}`);
    }
}

export class Blockchain {
    chain: Block[];
    difficulty: number;
    pendingTransactions: Transaction[];
    miningReward: number;

    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 1;
        this.pendingTransactions = [];
        this.miningReward = 100; // Tokens de récompense pour le minage
    }

    createGenesisBlock(): Block {
        return new Block(Date.now(), [], '0');
    }

    getLatestBlock(): Block {
        return this.chain[this.chain.length - 1];
    }

    minePendingTransactions(miningRewardAddress: string): void {
        const rewardTransaction = new Transaction(
            null,
            miningRewardAddress,
            this.miningReward,
            'mining_reward'
        );
        this.pendingTransactions.push(rewardTransaction);

        const block = new Block(
            Date.now(),
            this.pendingTransactions,
            this.getLatestBlock().hash
        );

        block.mineBlock(this.difficulty);

        this.chain.push(block);
        this.pendingTransactions = [];
    }

    createTransaction(transaction: Transaction): void {
        if (!transaction.fromAddress || !transaction.toAddress) {
            throw new Error('Transaction must include from and to address');
        }

        if (!transaction.isValid()) {
            throw new Error('Cannot add invalid transaction to chain');
        }

        this.pendingTransactions.push(transaction);
    }

    getBalanceOfAddress(address: string): number {
        let balance = 0;

        for (const block of this.chain) {
            for (const trans of block.transactions) {
                if (trans.fromAddress === address) {
                    balance -= trans.amount;
                }
                if (trans.toAddress === address) {
                    balance += trans.amount;
                }
            }
        }

        return balance;
    }

    isChainValid(): boolean {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
        }

        return true;
    }
}
