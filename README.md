# My Blockchain

A blockchain built from scratch in **Node.js**, with no blockchain libraries. It has signed transactions, proof of work, mining rewards, a REST API, a web dashboard, and a multi-node peer-to-peer network that stays in sync using the "longest valid chain wins" rule.

![Dashboard](E:\Blockchain project\my-blockchain\screenshot\Screenshot 2026-11-04 183507.png)

## Features

- **Blocks and hashing:** every block stores the previous block's SHA-256 hash, so changing old data breaks every block after it.
- **Proof of work:** a block is only valid if its hash starts with `000`, found by trying nonces.
- **Transactions and mining rewards:** a pending pool, and a reward paid to whoever mines the block.
- **Wallets and signatures:** ECDSA (secp256k1) key pairs. Only the owner of an address can spend from it, and any edit after signing invalidates the signature.
- **Validation:** the whole chain is re-audited from the first block, checking hashes, links, proof of work, signatures, rewards, and that no balance goes negative.
- **Persistence:** the chain is saved to a file after every change. A tampered file is refused on load.
- **REST API and dashboard:** view the chain, wallets and pending transactions, send coins, and mine blocks from the browser.
- **Peer-to-peer network:** nodes find each other, broadcast new transactions and blocks, and catch up on anything they missed.

## How it works

| Idea | In this project |
|---|---|
| Fingerprint of a block | `calculateHash()` in `block.js` |
| Making tampering expensive | `mine(difficulty)` in `block.js` |
| Proving who owns coins | `sign()` and `isValid()` in `transaction.js` |
| The auditor | `isValid()` in `blockchain.js` |
| Agreeing on one history | `replaceChain()` in `blockchain.js` |

### Consensus: longest valid chain wins

If a node receives a block that does not fit on its chain, it asks its peers for their full chains. It adopts a longer chain only after auditing it: the genesis block must match, and every hash, proof of work, signature and balance must be valid. A node that was offline catches up automatically when it starts.

When a shorter chain is replaced, its blocks become orphans and their mining rewards disappear, as on real blockchains.

## Project structure

```
my-blockchain/
├── block.js          Block, hashing, proof of work
├── transaction.js    Transactions, signing, verification
├── wallet.js         Key pairs and addresses
├── blockchain.js     Chain, validation, mining, consensus, persistence
├── server.js         Express API and peer-to-peer networking
├── createWallet.js   Creates a named wallet in keys.json
├── attacks.js        Tests that try to cheat the chain
├── test-api.js       Calls the API on one node
├── test-network.js   Checks three nodes stay in sync
└── public/index.html The dashboard
```

## Getting started

Requires **Node.js 18 or newer**.

```bash
npm install
node createWallet.js alice
node createWallet.js bob
node createWallet.js miner
```

Start three nodes in three terminals, in this order:

```bash
node server.js 3001
node server.js 3002 http://localhost:3001
node server.js 3003 http://localhost:3001
```

Open `http://localhost:3001`, `3002` and `3003` in your browser. Mine a block on one node and watch it appear on the others within a few seconds.

Each node saves its chain to `chain-<port>.json` and its peers to `peers-<port>.json`, so it can be restarted without losing anything.

## API

| Method | Endpoint | What it does |
|---|---|---|
| GET | `/status` | Node address, block count, peers |
| GET | `/chain` | The full chain and whether it is valid |
| GET | `/pending` | Transactions waiting to be mined |
| GET | `/wallets` | Wallets with their balances |
| GET | `/balance/:who` | Balance of a wallet name or address |
| POST | `/transactions` | Send coins: `{ "from": "alice", "to": "bob", "amount": 30 }` |
| POST | `/mine` | Mine a block: `{ "miner": "miner" }` |
| GET | `/peers` | Peers this node knows |
| POST | `/peers/register` | Used by nodes to introduce themselves |
| POST | `/sync` | Ask this node to catch up with its peers |
| POST | `/transactions/receive` | Used by nodes to share a transaction |
| POST | `/blocks/receive` | Used by nodes to share a mined block |

## Attacks it blocks

Run `node attacks.js` to see each one fail:

- Double spend (queueing payments that together exceed the balance)
- Replay of a signed transaction, both while pending and after it was mined
- Zero or negative amounts
- Creating free coins by hand
- Editing an amount inside an old block
- Editing a block and re-mining it to hide the edit
- Mining a block that pays the miner more than the reward
- A block with no proof of work
- A tampered `chain.json`, which the node refuses to load

## Limitations and future scope

- **Signing happens on the server.** The API holds the private keys in `keys.json` and signs for the named wallets. This is a demo shortcut. A real system signs on the user's device and sends only the signed transaction.
- **All nodes share one `keys.json`** because they run on the same machine.
- **Fixed difficulty** and no transaction fees.
- **Peers are not authenticated.** Any URL can register as a peer.
- **Equal-length forks** are only resolved when the next block extends one of them.
- Ideas for next steps: client-side wallets, dynamic difficulty, transaction fees, Merkle trees, and a websocket-based peer connection.