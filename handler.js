'use strict';
const { ApiPromise, WsProvider } = require("@polkadot/api");
const wsProvider = new WsProvider('wss://ws.calamari.systems');
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
  const totalIssuance = BigInt(await api.query.balances.totalIssuance());
  const accounts = [
    ...[address.treasury],
    ...queuedKeys.map((qk) => qk[0])
  ];
  const balances = (await api.query.system.account.multi(accounts)).map((balance, i) => ({
    account: accounts[i],
    ...balance,
  }));
  const bondedCollatorBalances = balances.filter(x => x.account !== address.treasury && BigInt(x.data.reserved) > 0);
  const treasurySum = BigInt(balances[0].data.free);
  const bondedSum = bondedCollatorBalances.map(x => BigInt(x.data.reserved)).reduce((a, i) => a + i, BigInt(0));
  const circulationSum = totalIssuance - treasurySum - bondedSum;
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
        note: "not implemented",
        account: {
          count: 0,
          balance: {
            sum: 0,
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
      circulation: {
        account: {
          //count: 0,
          balance: {
            sum: circulationSum,
          },
        },
      },
    },
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
