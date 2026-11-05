const fs = require('fs');
const Wallet = require('./wallet');

const name = process.argv[2];
if (!name) {
  console.log('Usage: node createWallet.js <name>');
  process.exit(1);
}

const keys = fs.existsSync('keys.json')
  ? JSON.parse(fs.readFileSync('keys.json', 'utf8'))
  : {};

if (keys[name]) {
  console.log(`Wallet "${name}" already exists`);
  process.exit(1);
}

const wallet = new Wallet();
keys[name] = wallet.exportPrivateKey();
fs.writeFileSync('keys.json', JSON.stringify(keys, null, 2));

console.log(`Created wallet "${name}"`);
console.log('Address:', wallet.address);