const fs = require('fs');
const Blockchain = require('./blockchain');
const Transaction = require('./transaction');
const Wallet = require('./wallet');

// Load saved wallets
const keys = JSON.parse(fs.readFileSync('keys.json', 'utf8'));
const alice = new Wallet(keys.alice);
const bob = new Wallet(keys.bob);
const miner = new Wallet(keys.miner);

const myCoin = new Blockchain();
const short = (addr) => addr.slice(-8);

// 1. Alice mines a block to get coins
myCoin.minePendingTransactions(alice.address);
console.log('Alice balance:', myCoin.getBalance(alice.address)); // 100

// 2. A properly signed transaction
const tx1 = new Transaction(alice.address, bob.address, 40);
tx1.sign(alice);
myCoin.addTransaction(tx1);
myCoin.minePendingTransactions(miner.address);
console.log('Alice:', myCoin.getBalance(alice.address)); // 60
console.log('Bob:', myCoin.getBalance(bob.address));     // 40
console.log('Valid?', myCoin.isValid());                 // true

// 3. Attack: Bob tries to sign a transaction that spends Alice's coins
try {
  const fake = new Transaction(alice.address, bob.address, 50);
  fake.sign(bob);
} catch (e) {
  console.log('Attack 1 blocked:', e.message);
}

// 4. Attack: no signature at all
try {
  const unsigned = new Transaction(alice.address, bob.address, 10);
  myCoin.addTransaction(unsigned);
} catch (e) {
  console.log('Attack 2 blocked:', e.message);
}

// 5. Attack: change the amount after signing
try {
  const tx2 = new Transaction(alice.address, bob.address, 5);
  tx2.sign(alice);
  tx2.amount = 50; // sneaky edit
  myCoin.addTransaction(tx2);
} catch (e) {
  console.log('Attack 3 blocked:', e.message);
}

console.log('Alice address ends with:', short(alice.address));