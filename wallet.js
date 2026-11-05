const crypto = require('crypto');

class Wallet {
  constructor(privatePem = null) {
    if (privatePem) {
      this.privateKey = crypto.createPrivateKey(privatePem);
    } else {
      const { privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
      });
      this.privateKey = privateKey;
    }
    const publicKey = crypto.createPublicKey(this.privateKey);
    this.address = publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
  }

  sign(hash) {
    return crypto.sign('sha256', Buffer.from(hash), this.privateKey).toString('hex');
  }

  exportPrivateKey() {
    return this.privateKey.export({ type: 'pkcs8', format: 'pem' });
  }
}

module.exports = Wallet;