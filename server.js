const express = require('express');
const fs = require('fs');
const Blockchain = require('./blockchain');
const Block = require('./block');
const Transaction = require('./transaction');
const Wallet = require('./wallet');

// Usage: node server.js [port] [peer urls...]
// Example: node server.js 3002 http://localhost:3001
const PORT = Number(process.argv[2]) || 3001;
const INITIAL_PEERS = process.argv.slice(3);
const SELF = `http://localhost:${PORT}`;
const CHAIN_FILE = `chain-${PORT}.json`;
const PEERS_FILE = `peers-${PORT}.json`;

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Each node keeps its own chain file
const coin = Blockchain.load(CHAIN_FILE);
const save = () => coin.save(CHAIN_FILE);

// Load saved wallets (alice, bob, miner...) from keys.json
function loadWallets() {
  if (!fs.existsSync('keys.json')) return {};
  const keys = JSON.parse(fs.readFileSync('keys.json', 'utf8'));
  const wallets = {};
  for (const name of Object.keys(keys)) {
    wallets[name] = new Wallet(keys[name]);
  }
  return wallets;
}
const wallets = loadWallets();

// Accept either a wallet name ("bob") or a raw address
function resolveAddress(value) {
  return wallets[value] ? wallets[value].address : value;
}

// ---------- Peers (the other nodes this node knows) ----------
const peers = new Set();

// The address book survives restarts
const savedPeers = fs.existsSync(PEERS_FILE)
  ? JSON.parse(fs.readFileSync(PEERS_FILE, 'utf8'))
  : [];
const savePeers = () => fs.writeFileSync(PEERS_FILE, JSON.stringify([...peers]));

async function postJSON(baseUrl, path, body) {
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// The town crier: tell every peer the news
async function broadcast(path, body) {
  await Promise.all(
    [...peers].map(async (peer) => {
      try {
        await postJSON(peer, path, body);
      } catch (e) {
        console.log('Could not reach', peer);
      }
    })
  );
}

// Introduce ourselves to a peer, then connect to everyone it knows
async function connectTo(peerUrl) {
  if (peerUrl === SELF || peers.has(peerUrl)) return;
  try {
    const data = await postJSON(peerUrl, '/peers/register', { url: SELF });
    peers.add(peerUrl);
    savePeers();
    console.log('Connected to', peerUrl);
    for (const other of data.peers) {
      await connectTo(other);
    }
  } catch (e) {
    console.log('Could not reach', peerUrl);
  }
}

// ---------- Catching up: longest valid chain wins ----------

// Ask every peer for its chain and adopt any longer chain that passes our audit
async function syncWithPeers() {
  let updated = false;
  for (const peer of peers) {
    try {
      const res = await fetch(peer + '/chain');
      const data = await res.json();
      const candidate = data.chain.map((b) => Block.fromJSON(b));
      coin.replaceChain(candidate);
      console.log(`Synced: adopted a chain of ${candidate.length} blocks from ${peer}`);
      updated = true;
    } catch (e) {
      if (!e.message.includes('not longer')) {
        console.log(`Did not adopt chain from ${peer}: ${e.message}`);
      }
    }
  }
  if (updated) save();
  return updated;
}

// A node says "I'm here": remember it, and share who we know
app.post('/peers/register', (req, res) => {
  const { url } = req.body || {};
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'Invalid peer url' });
  }
  if (url !== SELF) {
    peers.add(url);
    savePeers();
  }
  res.json({ message: 'Registered', peers: [...peers] });
});

app.get('/peers', (req, res) => {
  res.json({ node: SELF, peers: [...peers] });
});

// Manually ask this node to catch up
app.post('/sync', async (req, res) => {
  const updated = await syncWithPeers();
  res.json({ updated, blocks: coin.chain.length });
});

// ---------- Receiving news from other nodes ----------

// A peer sends us a signed transaction
app.post('/transactions/receive', (req, res) => {
  try {
    const tx = Transaction.fromJSON(req.body || {});
    coin.addTransaction(tx); // full checks: signature, balance, duplicates
    save();
    console.log('Received transaction, passing it on');
    broadcast('/transactions/receive', tx); // duplicates get rejected, so this stops
    res.json({ accepted: true });
  } catch (e) {
    res.status(400).json({ accepted: false, reason: e.message });
  }
});

// A peer sends us a freshly mined block
app.post('/blocks/receive', async (req, res) => {
  try {
    const block = Block.fromJSON(req.body || {});

    // Already have it? Then stay quiet, which also stops the news going in circles
    const mine = coin.chain[block.index];
    if (mine && mine.hash === block.hash) {
      return res.json({ accepted: false, reason: 'Already have this block' });
    }

    try {
      coin.addBlock(block); // full checks: link, proof of work, signatures, rewards
    } catch (e) {
      if (e.message.startsWith('Block does not fit')) {
        // We probably missed something, so ask the neighbours for the full story
        console.log(`Block #${block.index} does not fit, checking peers for a longer chain...`);
        const synced = await syncWithPeers();
        return res.json({ accepted: synced, synced });
      }
      throw e;
    }

    save();
    console.log(`Received block #${block.index}, passing it on`);
    broadcast('/blocks/receive', block);
    res.json({ accepted: true });
  } catch (e) {
    console.log('Rejected a block:', e.message);
    res.status(400).json({ accepted: false, reason: e.message });
  }
});

// ---------- Blockchain API ----------

// Is the node alive?
app.get('/status', (req, res) => {
  res.json({ node: SELF, blocks: coin.chain.length, peers: [...peers] });
});

// View the whole chain
app.get('/chain', (req, res) => {
  res.json({ length: coin.chain.length, valid: coin.isValid(), chain: coin.chain });
});

// View transactions waiting to be mined
app.get('/pending', (req, res) => {
  res.json(coin.pendingTransactions);
});

// List wallets with balances
app.get('/wallets', (req, res) => {
  const list = Object.entries(wallets).map(([name, w]) => ({
    name,
    address: w.address,
    balance: coin.getBalance(w.address),
  }));
  res.json(list);
});

// Balance of one wallet (by name or address)
app.get('/balance/:who', (req, res) => {
  const address = resolveAddress(req.params.who);
  res.json({ address, balance: coin.getBalance(address) });
});

// Send coins: { "from": "alice", "to": "bob", "amount": 30 }
app.post('/transactions', (req, res) => {
  try {
    const { from, to, amount } = req.body || {};
    const sender = wallets[from];
    if (!sender) {
      return res.status(400).json({ error: 'Unknown sender wallet' });
    }
    const tx = new Transaction(sender.address, resolveAddress(to), Number(amount));
    tx.sign(sender);
    coin.addTransaction(tx);
    save();
    broadcast('/transactions/receive', tx); // tell the network
    res.status(201).json({ message: 'Transaction added to pending pool', transaction: tx });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Mine a block: { "miner": "miner" }
app.post('/mine', (req, res) => {
  const { miner } = req.body || {};
  const minerWallet = wallets[miner];
  if (!minerWallet) {
    return res.status(400).json({ error: 'Unknown miner wallet' });
  }
  coin.minePendingTransactions(minerWallet.address);
  save();
  const block = coin.getLatestBlock();
  broadcast('/blocks/receive', block); // tell the network
  res.json({ message: 'Block mined', block });
});

app.listen(PORT, async () => {
  console.log(`Blockchain node running at ${SELF} (saving to ${CHAIN_FILE})`);

  // Reconnect to remembered peers plus any given on the command line
  for (const peer of new Set([...savedPeers, ...INITIAL_PEERS])) {
    await connectTo(peer);
  }

  // Catch up on anything we missed while we were offline
  await syncWithPeers();
});