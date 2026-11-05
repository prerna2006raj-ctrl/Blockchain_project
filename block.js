const crypto = require("crypto");
const Transaction = require("./transaction");
class Block {
  constructor(index, transactions, previousHash) {
    this.index = index;
    this.timestamp = Date.now();
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }
  static fromJSON(data) {
    const block = Object.assign(Object.create(Block.prototype), data);
    block.transactions = data.transactions.map((t) => Transaction.fromJSON(t));
    return block;
  }

  calculateHash() {
    return crypto
      .createHash("sha256")
      .update(
        this.index +
          this.timestamp +
          JSON.stringify(this.transactions) +
          this.previousHash +
          this.nonce,
      )
      .digest("hex");
  }

  mine(difficulty) {
    const target = "0".repeat(difficulty);
    while (!this.hash.startsWith(target)) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
  }

  hasValidTransactions() {
    return this.transactions.every((tx) => tx.isValid());
  }
}

module.exports = Block;
