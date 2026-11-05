const nodes = ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(node, method, path, body) {
  const res = await fetch(node + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function snapshot(title) {
  console.log('\n' + title);
  const rows = [];
  for (const n of nodes) {
    const chain = await call(n, 'GET', '/chain');
    const pending = await call(n, 'GET', '/pending');
    const wallets = await call(n, 'GET', '/wallets');
    const bal = Object.fromEntries(wallets.map((w) => [w.name, w.balance]));
    rows.push({
      node: n.slice(-4),
      blocks: chain.length,
      lastHash: chain.chain[chain.length - 1].hash.slice(0, 10),
      pending: pending.length,
      alice: bal.alice,
      bob: bal.bob,
      miner: bal.miner,
    });
  }
  console.table(rows);
}

(async () => {
  await call(nodes[0], 'POST', '/mine', { miner: 'alice' });
  await wait(1500);
  await snapshot('After node 3001 mined a block for alice');

  await call(nodes[1], 'POST', '/transactions', { from: 'alice', to: 'bob', amount: 30 });
  await wait(1500);
  await snapshot('After node 3002 received alice -> bob 30');

  await call(nodes[2], 'POST', '/mine', { miner: 'miner' });
  await wait(1500);
  await snapshot('After node 3003 mined the block');
})();