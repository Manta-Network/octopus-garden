const fetch = require('node-fetch');
const { exec } = require("child_process");
const { ApiPromise, WsProvider } = require("@polkadot/api");

let vestedBalances = [];
let vestedCount;

exec(
  [
    'aws ssm get-parameter',
    '--profile pelagos-service',
    '--region eu-central-1',
    '--name octopus_garden_vested_count',
    '--query Parameter.Value',
    '--output text'
  ].join(' '),
  (error, stdout, stderr) => {
    if (!!error || !!stderr) {
      if (error) {
        console.error(`error: ${error.message}`);
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      process.exit(1);
    }
    vestedCount = parseInt(stdout);
    console.log(`vestedCount: ${vestedCount}`);
  }
);

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
          if (vestedBalances.length <= vestedCount) {
            console.log(`${vestedBalances.length} / ${vestedCount} (${((vestedBalances.length / vestedCount) * 100).toFixed(2)}%)`);
          }
        }
        if (vestedBalances.length === vestedCount) {
          const vestedSum = vestedBalances.reduce((a, b) => a + b.vested, BigInt(0));
          console.log(`vested: ${vestedSum}`);
          exec(
            [
              'aws ssm put-parameter',
              '--profile pelagos-service',
              '--region eu-central-1',
              '--name octopus_garden_vested_sum',
              '--type String',
              '--overwrite',
              '--value', vestedSum
            ].join(' '),
            (error, stdout, stderr) => {
              if (error) {
                console.log(`error: ${error.message}`);
              }
              if (stderr) {
                console.log(`stderr: ${stderr}`);
              }
              console.log(`stdout: ${stdout}`);
              process.exit(0);
            }
          );
        }
      });
    }
  });
});
