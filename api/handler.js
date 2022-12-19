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

const toDecimal = (amount) => {
  return (Number(BigInt(amount) * BigInt(10 ** 6) / BigInt(10 ** 12)) / (10 ** 6))
};

const account = async (address) => {
  const a = (await (await ApiPromise.create({ provider: wsProvider })).query.system.account(address));
  const { nonce, data } = {
    ...a,
    nonce: a.nonce,
    data: {
      free: toDecimal(a.data.free),
      reserved: toDecimal(a.data.reserved),
      miscFrozen: toDecimal(a.data.miscFrozen),
      feeFrozen: toDecimal(a.data.feeFrozen),
    },
  };
  return {
    ...a,
    data,
  };
};

const circulatingSupply = async () => {
  const api = await ApiPromise.create({ provider: wsProvider });
  await api.isReady;
  const [
    totalIssuanceString,
    treasuryBalance,
  ] = await Promise.all([
    api.query.balances.totalIssuance(),
    api.query.system.account(address.treasury),
  ]);
  const issuance = BigInt(totalIssuanceString);
  const treasury = BigInt(treasuryBalance.data.free);
  return { issuance, treasury, supply: (issuance - treasury) };
};

module.exports.circulation = async (event) => {
  try {
    const { supply } = await circulatingSupply();
    response.statusCode = 200;
    response.body = JSON.stringify(
      supply.toString(),
      null,
      2
    );
  } catch (error) {
    response.statusCode = 500;
    response.body = JSON.stringify({ error }, null, 2);
    console.error(error);
  }
  return response;
};

module.exports.circulationAsDecimal = async (event) => {
  try {
    const { supply } = await circulatingSupply();
    response.statusCode = 200;
    response.body = JSON.stringify(
      (Number(supply * BigInt(10 ** 6) / BigInt(10 ** 12)) / (10 ** 6)),
      null,
      2
    );
  } catch (error) {
    response.statusCode = 500;
    response.body = JSON.stringify({ error }, null, 2);
    console.error(error);
  }
  return response;
};

module.exports.circulatingSupply = async (event) => {
  try {
    response.statusCode = 200;
    response.body = JSON.stringify(
      (await circulatingSupply()),
      (k, v) => ((typeof v === 'bigint') ? v.toString() : v),
      2
    );
  } catch (error) {
    response.statusCode = 500;
    response.body = JSON.stringify({ error }, null, 2);
    console.error(error);
  }
  return response;
};

module.exports.account = async (event) => {
  const { address } = event.pathParameters;
  try {
    response.statusCode = 200;
    response.body = JSON.stringify(
      (await account(address)),
      null,
      2
    );
  } catch (error) {
    response.statusCode = 500;
    response.body = JSON.stringify({ error }, null, 2);
    console.error(error);
  }
  return response;
};
