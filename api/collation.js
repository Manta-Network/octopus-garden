'use strict';

const MongoClient = require('mongodb').MongoClient;
const { ApiPromise, WsProvider } = require("@polkadot/api");
//const { encodeAddress } = require("@polkadot/keyring");
const wsProvider = new WsProvider('wss://ws.archive.calamari.systems');
const response = {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  },
};
const databaseUri = (process.env.octopus_garden_db_read);
const connectToDatabase = async () => {
  const client = await MongoClient.connect(databaseUri);
  const db = await client.db('test');
  return db;
}
const fetchBlocks = async (round) => {
  const db = await connectToDatabase();
  const blocks = await db.collection('kusama-calamari-block').find({ round }, { projection: { _id: 0 } }).toArray();
  return blocks;
};

module.exports.list = async (event) => {
  try {
    const api = await ApiPromise.create({ provider: wsProvider });
    const [
      candidatePool,
      selectedCandidates,
      sessionValidators,
      round,
    ] = await Promise.all([
      api.query.parachainStaking.candidatePool(),
      api.query.parachainStaking.selectedCandidates(),
      api.query.session.validators(),
      api.query.parachainStaking.round(),
    ]);
    const [ sessionKeys, blocks ] = await Promise.all([
      Promise.all(candidatePool.map(cp => api.query.session.nextKeys(cp.owner))),
      fetchBlocks(parseInt(round.current, 10))
    ]);
    const collators = candidatePool.map((c, cI) => {
      const session = JSON.parse(JSON.stringify(sessionKeys[cI]));
      return {
        account: c.owner,
        stake: c.amount,
        selected: selectedCandidates.includes(c.owner),
        collating: sessionValidators.includes(c.owner),
        session,
        blocks: blocks.filter((b) => b.author === session.nimbus),
      }
    });
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
    const round = parseInt(((!!event.pathParameters && !!event.pathParameters.round) ? event.pathParameters.round : (await api.query.parachainStaking.round()).current), 10);
    response.statusCode = 200;
    response.body = JSON.stringify(
      {
        round: {
          current: round,
          blocks: (await fetchBlocks(round)),
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
