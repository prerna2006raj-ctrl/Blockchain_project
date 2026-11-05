const base = 'http://localhost:3001';

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

(async () => {
  console.log('1. Mine for alice:', (await call('POST', '/mine', { miner: 'alice' })).data.message);
  console.log('2. Send 30 alice -> bob:', (await call('POST', '/transactions', { from: 'alice', to: 'bob', amount: 30 })).data.message);
  console.log('3. Overspend:', (await call('POST', '/transactions', { from: 'alice', to: 'bob', amount: 999 })).data);
  console.log('4. Bad amount:', (await call('POST', '/transactions', { from: 'alice', to: 'bob', amount: 'abc' })).data);
  console.log('5. Mine for miner:', (await call('POST', '/mine', { miner: 'miner' })).data.message);

  const wallets = (await call('GET', '/wallets')).data;
  console.table(wallets.map((w) => ({ name: w.name, balance: w.balance })));

  console.log('6. Chain valid?', (await call('GET', '/chain')).data.valid);
})();