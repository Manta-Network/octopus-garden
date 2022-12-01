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

const circulatingSupply = async () => {
  const api = await ApiPromise.create({ provider: wsProvider });
  const totalIssuanceString = await api.query.balances.totalIssuance();
  const totalIssuance = BigInt(totalIssuanceString);
  const treasuryBalance = await api.query.system.account(address.treasury);
  const treasurySum = BigInt(treasuryBalance.data.free);
  return (totalIssuance - treasurySum);
};

module.exports.circulation = async (event) => {
  try {
    const supply = await circulatingSupply();
    response.statusCode = 200;
    response.body = JSON.stringify(
      supply.toString(),
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
    const supply = await circulatingSupply();
    response.statusCode = 200;
    response.body = JSON.stringify(
      (Number(supply * BigInt(10 ** 6) / BigInt(10 ** 12)) / (10 ** 6)),
      2
    );
  } catch (error) {
    response.statusCode = 500;
    response.body = JSON.stringify({ error }, null, 2);
    console.error(error);
  }
  return response;
};
