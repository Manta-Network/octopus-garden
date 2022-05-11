'use strict';
const bigInt = require("big-integer");
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

module.exports.circulation = async (event) => {
  const api = await ApiPromise.create({ provider: wsProvider });
  const [chain, name, version] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.version(),
  ]);
  const genesis = api.genesisHash.toHex();
  const queuedKeys = await api.query.session.queuedKeys();
  const totalIssuance = new bigInt(await api.query.balances.totalIssuance(), 16);
  const balances = await api.query.system.account.multi([...[address.treasury], ...queuedKeys.map((qk) => qk[0])]);
  const bondedCollatorBalances = balances.filter(x => !!x.data.reserved);
  const treasurySum = new bigInt(balances[0].data.free, 16);
  const bondedSum = bondedCollatorBalances.map(x => new bigInt(x.data.reserved, 16)).reduce((a, i) => a.add(i), bigInt());
  const circulationSum = totalIssuance
    .subtract(treasurySum)
    .subtract(bondedSum);
  const body = {
    token: {
      chain,
      version,
      symbol: 'KMA',
      decimals: 12,
      genesis,
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
      }
    }
  };
  return {
    ...response,
    statusCode: 200,
    body: JSON.stringify(body, null, 2),
  };
};
