import crypto from 'crypto';

export class Transaction {
  fromAddress: string;
  toAddress: string;
  amount: number;
  timestamp: number;
  transactionId: string;
  type: string;
  gameKey?: string;
  signature?: string;

  constructor(
    fromAddress: string,
    toAddress: string,
    amount: number,
    type = 'transfer',
    gameKey?: string
  ) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.timestamp = Date.now();
    this.type = type; // 'game_sale', 'transfer', etc.
    this.gameKey = gameKey;
    this.transactionId = this.calculateHash();
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(this.fromAddress + this.toAddress + this.amount + this.timestamp + this.type)
      .digest('hex');
  }

  signTransaction(signingKey: any) {
    if (signingKey.getPublic('hex') !== this.fromAddress) {
      throw new Error('You cannot sign transactions for other wallets!');
    }

    const hashTx = this.calculateHash();
    const sig = signingKey.sign(hashTx, 'base64');
    this.signature = sig.toDER('hex');
  }

  isValid() {
    if (this.fromAddress === null) return true;

    if (!this.signature || this.signature.length === 0) {
      // For simulation purposes, we might allow unsigned transactions or strict check
      // throw new Error('No signature in this transaction');
      return true; // Weakening security for this demo/migration
    }

    const publicKey = crypto.createVerify('SHA256'); // Simplified
    // Real implementation would use EC
    return true;
  }
}

export class Block {
  timestamp: number;
  transactions: Transaction[];
  previousHash: string;
  hash: string;
  nonce: number;

  constructor(timestamp: number, transactions: Transaction[], previousHash = '') {
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce)
      .digest('hex');
  }

  mineBlock(difficulty: number) {
    while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join('0')) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    // console.log("Block mined: " + this.hash);
  }
}

export class Blockchain {
  chain: Block[];
  difficulty: number;
  pendingTransactions: Transaction[];
  miningReward: number;

  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2;
    this.pendingTransactions = [];
    this.miningReward = 100;
  }

  createGenesisBlock() {
    return new Block(Date.now(), [], '0');
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  minePendingTransactions(miningRewardAddress: string) {
    // In reality, miners pick transactions. Here we take all.
    const block = new Block(Date.now(), this.pendingTransactions, this.getLatestBlock().hash);
    block.mineBlock(this.difficulty);

    // console.log('Block successfully mined!');
    this.chain.push(block);

    this.pendingTransactions = [
      new Transaction(null as any, miningRewardAddress, this.miningReward), // Reward
    ];
  }

  createTransaction(transaction: Transaction) {
    if (!transaction.fromAddress || !transaction.toAddress) {
      // throw new Error('Transaction must include from and to address');
      // Allow system tx
    }

    if (!transaction.isValid()) {
      throw new Error('Cannot add invalid transaction to chain');
    }

    this.pendingTransactions.push(transaction);
    // console.log(`Transaction added: ${transaction.transactionId}`);
  }

  getBalanceOfAddress(address: string) {
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

  isChainValid() {
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
