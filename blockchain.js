const fs = require("fs");
const Block = require("./block");
const Transaction = require("./transaction");

class Blockchain {
  constructor() {
    // Fixed timestamp so every node starts with the identical genesis block
    const genesis = new Block(0, [], "0");
    genesis.timestamp = 0;
    genesis.hash = genesis.calculateHash();

    this.chain = [genesis];
    this.difficulty = 3;
    this.pendingTransactions = [];
    this.miningReward = 100;
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  // Total coins this address has already promised in the pending box
  getPendingSpend(address) {
    return this.pendingTransactions
      .filter((tx) => tx.from === address)
      .reduce((sum, tx) => sum + tx.amount, 0);
  }

  // Has this exact signed transaction been used before?
  isDuplicate(transaction) {
    if (
      this.pendingTransactions.some(
        (tx) => tx.signature === transaction.signature,
      )
    ) {
      return true;
    }
    return this.chain.some((block) =>
      block.transactions.some((tx) => tx.signature === transaction.signature),
    );
  }

  addTransaction(transaction) {
    if (
      !transaction.to ||
      !Number.isFinite(transaction.amount) ||
      transaction.amount <= 0
    ) {
      throw new Error("Invalid transaction");
    }
    if (transaction.from === null) {
      throw new Error("Reward transactions cannot be added manually");
    }
    if (!transaction.isValid()) {
      throw new Error("Invalid signature");
    }
    if (this.isDuplicate(transaction)) {
      throw new Error("Duplicate transaction");
    }
    const available =
      this.getBalance(transaction.from) -
      this.getPendingSpend(transaction.from);
    if (available < transaction.amount) {
      throw new Error("Not enough balance");
    }
    this.pendingTransactions.push(transaction);
  }

  minePendingTransactions(minerAddress) {
    const reward = new Transaction(null, minerAddress, this.miningReward);
    const transactions = [...this.pendingTransactions, reward];

    const block = new Block(
      this.chain.length,
      transactions,
      this.getLatestBlock().hash,
    );
    block.mine(this.difficulty);

    this.chain.push(block);
    this.pendingTransactions = [];
  }

  // Accept a block mined by another node, but only after checking it ourselves
  addBlock(block) {
    const latest = this.getLatestBlock();
    if (block.index !== latest.index + 1 || block.previousHash !== latest.hash) {
      throw new Error("Block does not fit on top of our chain");
    }

    this.chain.push(block);
    if (!this.isValid()) {
      this.chain.pop(); // undo, the block was bad
      throw new Error("Invalid block");
    }

    // Those transactions are now confirmed, so they leave our pending box
    const confirmed = new Set(block.transactions.map((tx) => tx.signature));
    this.pendingTransactions = this.pendingTransactions.filter(
      (tx) => !confirmed.has(tx.signature),
    );
  }

  // Longest valid chain wins: swap ours for a longer chain, if it passes the audit
  replaceChain(newChain) {
    if (newChain.length <= this.chain.length) {
      throw new Error("Received chain is not longer than ours");
    }
    if (newChain[0].calculateHash() !== this.chain[0].hash) {
      throw new Error("Received chain has a different genesis block");
    }

    // Audit the other chain with a throwaway Blockchain object
    const candidate = new Blockchain();
    candidate.chain = newChain;
    if (!candidate.isValid()) {
      throw new Error("Received chain is invalid");
    }

    this.chain = newChain;

    // Re-check our waiting transactions against the new history
    // (confirmed ones count as duplicates and drop out, unaffordable ones too)
    const oldPending = this.pendingTransactions;
    this.pendingTransactions = [];
    for (const tx of oldPending) {
      try {
        this.addTransaction(tx);
      } catch (e) {
        // no longer valid, so it is dropped
      }
    }
  }

  getBalance(address) {
    let balance = 0;
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.from === address) balance -= tx.amount;
        if (tx.to === address) balance += tx.amount;
      }
    }
    return balance;
  }

  // Write the chain to a file
  save(file = "chain.json") {
    fs.writeFileSync(
      file,
      JSON.stringify(
        { chain: this.chain, pendingTransactions: this.pendingTransactions },
        null,
        2,
      ),
    );
  }

  // Read the chain back, and refuse it if it was tampered with
  static load(file = "chain.json") {
    const coin = new Blockchain();
    if (!fs.existsSync(file)) return coin;

    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    coin.chain = saved.chain.map((b) => Block.fromJSON(b));
    coin.pendingTransactions = saved.pendingTransactions.map((t) =>
      Transaction.fromJSON(t),
    );

    if (!coin.isValid()) {
      throw new Error("Saved chain is invalid. Refusing to load it.");
    }
    return coin;
  }

  // Re-check the whole chain from the start, like an auditor
  isValid() {
    const balances = {};
    const seen = new Set();

    for (let i = 0; i < this.chain.length; i++) {
      const block = this.chain[i];

      if (i > 0) {
        const previous = this.chain[i - 1];
        if (block.hash !== block.calculateHash()) return false;
        if (block.previousHash !== previous.hash) return false;
        if (!block.hash.startsWith("0".repeat(this.difficulty))) return false; // proof of work
        if (!block.hasValidTransactions()) return false;
      }

      let rewards = 0;
      for (const tx of block.transactions) {
        if (tx.amount <= 0) return false;

        if (tx.from === null) {
          rewards++;
          if (tx.amount !== this.miningReward) return false;
        } else {
          if (seen.has(tx.signature)) return false;
          seen.add(tx.signature);
          balances[tx.from] = (balances[tx.from] || 0) - tx.amount;
          if (balances[tx.from] < 0) return false;
        }
        balances[tx.to] = (balances[tx.to] || 0) + tx.amount;
      }
      if (rewards > 1) return false;
    }
    return true;
  }
}

module.exports = Blockchain;