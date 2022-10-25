'use strict';

const { ApiPromise, WsProvider } = require("@polkadot/api");
const { encodeAddress } = require("@polkadot/keyring");
const { extractAuthor } = require('@polkadot/api-derive/type/util');

const { Author } = require('@polkadot/types/interfaces');


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
    const [
      candidatePool,
      selectedCandidates,
      sessionValidators,
    ] = await Promise.all([
      api.query.parachainStaking.candidatePool(),
      api.query.parachainStaking.selectedCandidates(),
      api.query.session.validators(),
    ]);
    const sessionKeys = await Promise.all(candidatePool.map(cp => api.query.session.nextKeys(cp.owner)));
    const collators = candidatePool.map((c, cI) => ({
      account: c.owner,
      stake: c.amount,
      selected: selectedCandidates.includes(c.owner),
      collating: sessionValidators.includes(c.owner),
      session: JSON.parse(JSON.stringify(sessionKeys[cI])),
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
    const hash = await api.rpc.chain.getBlockHash(round.first);
    const header = await api.derive.chain.getHeader(hash);
    const digest = JSON.parse(JSON.stringify(header.digest.logs)).reduce((a, e)=>({ ...a, [Object.keys(e)[0]]: e[Object.keys(e)[0]][1]}), {});
    response.statusCode = 200;
    response.body = JSON.stringify(
      {
        round: {
          current: parseInt(round.current, 10),
          first: {
            number: header.number,
            hash,
            digest,
            author: {
              comment: "ignore this id. it's not correct.",
              account: encodeAddress(digest.preRuntime, 78),
            }
          },
          length: parseInt(round.length, 10),
        },
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
