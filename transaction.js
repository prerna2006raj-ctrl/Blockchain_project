const crypto = require("crypto");

class Transaction {
  constructor(from, to, amount) {
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.timestamp = Date.now();
    this.signature = null;
  }
  // Rebuild a Transaction from plain data (from a file or from another node)
  static fromJSON(data) {
    return Object.assign(Object.create(Transaction.prototype), data);
  }

  calculateHash() {
    return crypto
      .createHash("sha256")
      .update(this.from + this.to + this.amount + this.timestamp)
      .digest("hex");
  }

  sign(wallet) {
    if (wallet.address !== this.from) {
      throw new Error("You cannot sign transactions for other wallets");
    }
    this.signature = wallet.sign(this.calculateHash());
  }

  isValid() {
    if (this.from === null) return true; // mining reward
    if (!this.signature) return false;

    try {
      const publicKey = crypto.createPublicKey({
        key: Buffer.from(this.from, "hex"),
        format: "der",
        type: "spki",
      });
      return crypto.verify(
        "sha256",
        Buffer.from(this.calculateHash()),
        publicKey,
        Buffer.from(this.signature, "hex"),
      );
    } catch (e) {
      return false;
    }
  }
}

module.exports = Transaction;
