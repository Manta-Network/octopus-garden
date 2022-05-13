'use strict';

const { ApiPromise, WsProvider } = require("@polkadot/api");
const wsProvider = new WsProvider('wss://ws.calamari.systems');

//const fetch = require('node-fetch');

const response = {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  },
};
const address = {
  treasury: 'dmwQify37xfGt1wDhAi8zfvovsAkdK3aD4iqW8dn8nfrsAYsX',
};
let zip = (xs, ys) => {
  let iter = (zs, [x, ...xs], [y, ...ys]) =>
    (!x || !y) ? zs : iter(zs.concat([[x,y]]), xs, ys)
  return iter([], xs, ys);
};

module.exports.circulation = async (event) => {
  try {
    const api = await ApiPromise.create({ provider: wsProvider });
    const genesis = api.genesisHash.toHex();
    const [name, version, { ss58Format, tokenDecimals, tokenSymbol }, queuedKeys, totalIssuanceString] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.version(),
      api.registry.getChainProperties(),
      api.query.session.queuedKeys(),
      api.query.balances.totalIssuance(),
    ]);
    /*
    api.registry.getChainProperties() returns array-like objects with an equal number of zero-based numeric keys for tokenDecimals and tokenSymbol.
    below we tidy this construct by:
    - using json parse and stringify to create actual arrays from the array-like objects
    - zipping the decimals and symbols into an array of tupples (see: https://stackoverflow.com/a/32027887)
    - map the zipped tupples to an array of objects
    - if the resulting array has only one element, we return that element, otherwise the array
    */
    const zippedTokens = zip(
      JSON.parse(JSON.stringify(tokenDecimals)),
      JSON.parse(JSON.stringify(tokenSymbol))
    ).map(t => ({ decimals: t[0], symbol: t[1] }));
    const token = (zippedTokens.length === 1) ? zippedTokens[0] : zippedTokens;
    const totalIssuance = BigInt(totalIssuanceString);
    const accounts = [
      ...[address.treasury],
      ...queuedKeys.map((qk) => qk[0])
    ];
    const balances = (await api.query.system.account.multi(accounts)).map((balance, i) => ({
      account: accounts[i],
      ...balance,
    }));
    const bondedCollatorBalances = balances.filter(x => x.account !== address.treasury && BigInt(x.data.reserved) > 0);

    /*
    let allAccountsWithABalance;
    let error;
    try {
      const response = await fetch(
        'https://app.gc.subsquid.io/beta/calamari/1/graphql',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({query:`{accounts(where:{id_not_eq:"${address.treasury}",balance_gt:0}){id}}`}),
        }
      );
      allAccountsWithABalance = (await response.json()).data.accounts.map(a => a.id);
    } catch (exception) {
      error = {
        exception
      };
    }
    const vestedBalances = (await api.query.system.account.multi(allAccountsWithABalance)).filter(x => BigInt(x.data.reserved) > 0);

    const vestedSum = vestedBalances.reduce((a, b) => a + BigInt(b.data.miscFrozen), BigInt(0));
    */
    const vestedSum = BigInt("1253870932248133540291");
    const treasurySum = BigInt(balances[0].data.free);
    const bondedSum = bondedCollatorBalances.map(x => BigInt(x.data.reserved)).reduce((a, i) => a + i, BigInt(0));
    const circulationSum = totalIssuance - treasurySum - bondedSum - vestedSum;

    const body = {
      chain: {
        name,
        properties: {
          ss58: {
            format: ss58Format,
          },
          token,
        },
        version,
        genesis,
      },
      distribution: {
        vested: {
          account: {
            count: 16184,
            balance: {
              sum: vestedSum,
            },
          },
        },
        bonded: {
          account: {
            count: bondedCollatorBalances.length,
            balance: {
              sum: bondedSum,
            },
          },
        },
        treasury: {
          account: {
            count: 1,
            balance: {
              sum: treasurySum,
            },
          },
        },
        circulation: circulationSum,
        totalIssuance,
      },
    };
    response.statusCode = 200;
    response.body = JSON.stringify(
      body,
      (k, v) => (typeof v === 'bigint') ? v.toString() : v,
      2
    );
  } catch (error) {
    response.statusCode = 500;
    response.body = JSON.stringify({ error }, null, 2);
  }
  return response;
};

module.exports.vested = async (event) => {

  const api = await ApiPromise.create({ provider: wsProvider });
  const genesis = api.genesisHash.toHex();
  const [name, version, { ss58Format, tokenDecimals, tokenSymbol }, queuedKeys] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.version(),
    api.registry.getChainProperties(),
    api.query.session.queuedKeys(),
  ]);
  /*
  api.registry.getChainProperties() returns array-like objects with an equal number of zero-based numeric keys for tokenDecimals and tokenSymbol.
  below we tidy this construct by:
  - using json parse and stringify to create actual arrays from the array-like objects
  - zipping the decimals and symbols into an array of tupples (see: https://stackoverflow.com/a/32027887)
  - map the zipped tupples to an array of objects
  - if the resulting array has only one element, we return that element, otherwise the array
  */
  const zippedTokens = zip(
    JSON.parse(JSON.stringify(tokenDecimals)),
    JSON.parse(JSON.stringify(tokenSymbol))
  ).map(t => ({ decimals: t[0], symbol: t[1] }));
  const token = (zippedTokens.length === 1) ? zippedTokens[0] : zippedTokens;

  let allAccountsWithABalance;
  let error;
  try {
    const response = await fetch(
      'https://app.gc.subsquid.io/beta/calamari/1/graphql',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({query:`{accounts(where:{id_not_eq:"${address.treasury}",balance_gt:0}){id}}`}),
      }
    );
    allAccountsWithABalance = (await response.json()).data.accounts.map(a => a.id);
  } catch (exception) {
    error = {
      exception
    };
  }
  let vestedBalances = [];
  while (allAccountsWithABalance.length) {
    const chunkedAccountsWithABalance = allAccountsWithABalance.splice(0, Math.min(50, allAccountsWithABalance.length));
    vestedBalances = [
      ...vestedBalances,
      ...(await api.query.system.account.multi(chunkedAccountsWithABalance))
        .map(
          (balance, i) => ({
            account: chunkedAccountsWithABalance[i],
            ...balance,
          })
        )
        .filter(x => BigInt(x.data.reserved) > 0)
    ];
  }
  const vestedSum = vestedBalances.reduce((a, b) => a + BigInt(b.data.miscFrozen), BigInt(0));

  const body = {
    chain: {
      name,
      properties: {
        ss58: {
          format: ss58Format,
        },
        token,
      },
      version,
      genesis,
    },
    vesting: {
      balances: vestedBalances,
      count: vestedBalances.length,
      sum: vestedSum,
    },
    error,
  };
  return {
    ...response,
    statusCode: 200,
    body: JSON.stringify(
      body,
      (k, v) => (typeof v === 'bigint') ? v.toString() : v,
      2
    ),
  };
};
