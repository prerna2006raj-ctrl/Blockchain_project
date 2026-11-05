const Blockchain = require('./blockchain');
const Block = require('./block');
const Transaction = require('./transaction');
const Wallet = require('./wallet');

function report(name, blocked) {
  console.log((blocked ? '✅ BLOCKED      ' : '❌ NOT BLOCKED  ') + name);
}

// true if the function throws an error (meaning the chain refused it)
function refuses(fn) {
  try { fn(); return false; } catch (e) { return true; }
}

// A healthy chain: Alice ends with 70 coins, Bob has 30
function setup() {
  const coin = new Blockchain();
  const alice = new Wallet();
  const bob = new Wallet();
  const miner = new Wallet();

  coin.minePendingTransactions(alice.address);          // block 1
  const tx = new Transaction(alice.address, bob.address, 30);
  tx.sign(alice);
  coin.addTransaction(tx);
  coin.minePendingTransactions(miner.address);          // block 2
  coin.minePendingTransactions(miner.address);          // block 3
  return { coin, alice, bob, miner };
}

console.log('Healthy chain valid?', setup().coin.isValid()); // true
console.log('');

// 1. Double spend: Alice has 70, tries to promise 50 twice
{
  const { coin, alice, bob } = setup();
  const a = new Transaction(alice.address, bob.address, 50);
  a.sign(alice);
  coin.addTransaction(a);
  const b = new Transaction(alice.address, bob.address, 50);
  b.sign(alice);
  report('Double spend (50 + 50 with only 70 coins)', refuses(() => coin.addTransaction(b)));
}

// 2. Replay in the pending box: same signed transaction sent twice
{
  const { coin, alice, bob } = setup();
  const tx = new Transaction(alice.address, bob.address, 10);
  tx.sign(alice);
  coin.addTransaction(tx);
  report('Replay (pending box)', refuses(() => coin.addTransaction(tx)));
}

// 3. Replay after it was already mined
{
  const { coin, alice, bob, miner } = setup();
  const tx = new Transaction(alice.address, bob.address, 10);
  tx.sign(alice);
  coin.addTransaction(tx);
  coin.minePendingTransactions(miner.address);
  report('Replay (already mined)', refuses(() => coin.addTransaction(tx)));
}

// 4. Zero or negative amount
{
  const { coin, alice, bob } = setup();
  const tx = new Transaction(alice.address, bob.address, -50);
  tx.sign(alice);
  report('Negative amount', refuses(() => coin.addTransaction(tx)));
}

// 5. Adding a free reward by hand
{
  const { coin, bob } = setup();
  const free = new Transaction(null, bob.address, 1000);
  report('Free coins by hand', refuses(() => coin.addTransaction(free)));
}

// 6. Editing an amount inside an old block
{
  const { coin } = setup();
  coin.chain[2].transactions[0].amount = 90;
  report('Edit amount in old block', !coin.isValid());
}

// 7. Editing a block AND re-mining it to hide the edit
{
  const { coin } = setup();
  const block = coin.chain[2];
  block.transactions[0].amount = 90;
  block.hash = block.calculateHash();
  block.mine(coin.difficulty);
  report('Edit + re-mine old block', !coin.isValid());
}

// 8. Mining a block that pays the miner 1000 instead of 100
{
  const { coin, bob } = setup();
  const evil = new Block(
    coin.chain.length,
    [new Transaction(null, bob.address, 1000)],
    coin.getLatestBlock().hash
  );
  evil.mine(coin.difficulty);
  coin.chain.push(evil);
  report('Fake mining reward', !coin.isValid());
}