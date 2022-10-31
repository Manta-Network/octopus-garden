'use strict';

const MongoClient = require('mongodb').MongoClient;
const { ApiPromise, WsProvider } = require("@polkadot/api");
//const { encodeAddress } = require("@polkadot/keyring");
const wsProvider = new WsProvider('wss://ws.archive.calamari.systems');
const databaseUri = (process.env.octopus_garden_db_read);
const connectToDatabase = async () => {
  const client = await MongoClient.connect(databaseUri);
  const db = await client.db('test');
  return db;
}
const fetchRoundBlocks = async (round) => {
  const db = await connectToDatabase();
  const blocks = await db.collection('kusama-calamari-block').find({ round }, { projection: { _id: 0 } }).toArray();
  return blocks;
};
const fetchCandidateBlocks = async (account) => {
  const api = await ApiPromise.create({ provider: wsProvider });
  const { nimbus } = JSON.parse(JSON.stringify(await api.query.session.nextKeys(account)));
  const db = await connectToDatabase();
  const authorCountByRound = await db.collection('kusama-calamari-block').aggregate([
    {
      $match: {
        round: { $gt: 0 },
      }
    },
    {
      $group: {
        _id: {
          round : "$round",
          author : "$author",
      },
        count: { $sum: 1 },
      },
    }
  ]).toArray();
  const rounds = [...new Set(authorCountByRound.map(r => parseInt(r._id.round, 10)))]
    .sort((a, b) => a > b ? 1 : a < b ? -1 : 0)
    .map(round => ({
      round,
      length: 1800, // todo: get length of round from chain
      authored: authorCountByRound.some((acbr) => (acbr._id.round === round && acbr._id.author === nimbus))
        ? authorCountByRound.find((acbr) => (acbr._id.round === round && acbr._id.author === nimbus)).count
        : 0,
      authors: authorCountByRound.filter((acbr) => (acbr._id.round === round)).length,
    }));
  return { rounds };
};

module.exports.list = async (event) => {
  const response = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  };
  try {
    const api = await ApiPromise.create({ provider: wsProvider });
    const [
      candidatePool,
      selectedCandidates,
      round,
    ] = await Promise.all([
      api.query.parachainStaking.candidatePool(),
      api.query.parachainStaking.selectedCandidates(),
      api.query.parachainStaking.round(),
    ]);
    const [ sessionKeys, blocks ] = await Promise.all([
      Promise.all(candidatePool.map(cp => api.query.session.nextKeys(cp.owner))),
      fetchRoundBlocks(parseInt(round.current, 10))
    ]);
    const collators = candidatePool.map((c, cI) => {
      const session = JSON.parse(JSON.stringify(sessionKeys[cI]));
      return {
        account: c.owner,
        stake: c.amount,
        selected: selectedCandidates.includes(c.owner),
        collating: blocks.some((b) => b.author === session.nimbus),
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
  const response = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  };
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

module.exports.history = async (event) => {
  const response = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  };
  const { account } = event.pathParameters;
  try {
    const result = await fetchCandidateBlocks(account);
    response.statusCode = 200;
    response.body = JSON.stringify(
      result,
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
  const response = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  };
  try {
    const api = await ApiPromise.create({ provider: wsProvider });
    const [ currentRound, latestHeader ] = await Promise.all([
      api.query.parachainStaking.round(),
      api.rpc.chain.getHeader(),
    ]);
    response.statusCode = 200;
    response.body = JSON.stringify(
      {
        round: {
          number: parseInt(currentRound.current, 10),
          length: parseInt(currentRound.length, 10),
          first: parseInt(currentRound.first, 10),
          latest: parseInt(latestHeader.number, 10),
        }
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
