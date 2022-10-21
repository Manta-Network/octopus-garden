'use strict';

const { ApiPromise, WsProvider } = require("@polkadot/api");
const { encodeAddress } = require("@polkadot/keyring");
const { extractAuthor } = require('@polkadot/api-derive/type/util');
const wsProvider = new WsProvider('wss://ws.archive.calamari.systems');

const response = {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  },
};

module.exports.list = async (event) => {
  try {
    const api = await ApiPromise.create({ provider: wsProvider });
    const candidatePool = await api.query.parachainStaking.candidatePool();
    const collators = candidatePool.map((c) => ({
      account: c.owner,
      stake: c.amount,
    }));
    response.statusCode = 200;
    response.body = JSON.stringify(
      {
        collators,
      },
      2
    );
  } catch (error) {
    response.statusCode = 500;
    response.body = JSON.stringify({ error }, null, 2);
    console.error(error);
  }
  return response;
};

module.exports.info = async (event) => {
  const { account } = event.pathParameters;
  try {
    const api = await ApiPromise.create({ provider: wsProvider });
    const candidateInfo = await api.query.parachainStaking.candidateInfo(account);
    response.statusCode = 200;
    response.body = JSON.stringify(
      {
        candidateInfo,
      },
      2
    );
  } catch (error) {
    response.statusCode = 500;
    response.body = JSON.stringify({ error }, null, 2);
    console.error(error);
  }
  return response;
};

module.exports.round = async (event) => {
  try {
    const api = await ApiPromise.create({ provider: wsProvider });
    const round = await api.query.parachainStaking.round();
    const blockHash = await api.rpc.chain.getBlockHash(round.first);
    const header = await api.derive.chain.getHeader(blockHash);
    const preRuntime = JSON.parse(JSON.stringify(header.digest.logs[0])).preRuntime[1];
    const author = encodeAddress(preRuntime, 78);
    response.statusCode = 200;
    response.body = JSON.stringify(
      {
        round,
        preRuntime,
        blockHash,
        header,
      },
      2
    );
  } catch (error) {
    response.statusCode = 500;
    response.body = JSON.stringify({ error }, null, 2);
    console.error(error);
  }
  return response;
};
