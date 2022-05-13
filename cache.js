const fetch = require('node-fetch');
const { ApiPromise, WsProvider } = require("@polkadot/api");

let vestedBalances = [];

fetch(
  'https://app.gc.subsquid.io/beta/calamari/1/graphql',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({query:`{accounts(where:{balance_gt:0}){id}}`}),
  }
)
.then((response) => response.json())
.then((json) => {
  const accounts = json.data.accounts.map(a => a.id);
  ApiPromise.create({ provider: new WsProvider('wss://ws.calamari.systems') }).then((api) => {
    while (accounts.length) {
      const chunkedAccountsWithABalance = accounts.splice(0, Math.min(50, accounts.length));
      api.query.system.account.multi(chunkedAccountsWithABalance).then((balances) => {
        const chunk = balances
          .map((balance, i) => ({
            account: chunkedAccountsWithABalance[i],
            vested: BigInt(balance.data.miscFrozen),
          }))
          .filter(x => x.vested > 0);
        if (!!chunk.length) {
          vestedBalances.push(...chunk);
          if (vestedBalances.length <= 16184) {
            console.log(`${vestedBalances.length} / 16184 (${((vestedBalances.length / 16184) * 100).toFixed(2)}%)`);
          }
        }
        if (vestedBalances.length === 16184) {
          const vestedSum = vestedBalances.reduce((a, b) => a + b.vested, BigInt(0));
          console.log(`vested: ${vestedSum}`);
        }
      });
    }
  });
});
