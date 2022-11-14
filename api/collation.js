'use strict';

const MongoClient = require('mongodb').MongoClient;
const { ApiPromise, WsProvider } = require("@polkadot/api");
const wsProvider = new WsProvider('wss://ws.archive.calamari.systems');
const databaseUri = (process.env.octopus_garden_db_read);
const connectToDatabase = async (dbName) => {
  const client = await MongoClient.connect(databaseUri);
  const db = await client.db(dbName);
  return db;
}
const fetchRoundBlocks = async (round) => {
  const testDb = await connectToDatabase('test');
  const blocks = await testDb.collection('kusama-calamari-block').find({ round }, { projection: { _id: 0 } }).toArray();
  return blocks;
};
const fetchCandidateBlocks = async (account) => {
  const api = await ApiPromise.create({ provider: wsProvider });
  const { nimbus } = JSON.parse(JSON.stringify(await api.query.session.nextKeys(account)));
  const testDb = await connectToDatabase('test');
  const [
    authorCountByRound,
    feeRewardByRound,
  ] = await Promise.all([
    testDb.collection('kusama-calamari-block').aggregate([
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
    ]).toArray(),
    testDb.collection('kusama-calamari-block').find({ author: nimbus, reward: { $exists: true, $ne: '0x00' } }, { projection: { _id: false,  reward: true,  number: true,  round: true } }).toArray()
  ]);
  //todo: refactor into earlier promise.all when everything is in the same db
  const prodDb = await connectToDatabase('kusama-calamari');
  const bondStakingRewardByRound = await prodDb.collection('reward').find({ account }, { projection: { _id: false,  amount: true,  block: true,  round: true } }).toArray();
  const rounds = [...new Set(authorCountByRound.map(r => parseInt(r._id.round, 10)))]
    .sort((a, b) => a > b ? 1 : a < b ? -1 : 0)
    .map(round => {
      const roundAuthors = authorCountByRound.filter((r) => (r._id.round === round));
      const length = roundAuthors.map((r) => r.count).reduce((acc, e) => acc + e, 0);
      const authors = roundAuthors.length;
      const target = Math.floor(length / authors);
      const authored = (roundAuthors.find((r) => (r._id.author === nimbus)) || { count: 0 }).count;
      const score = Math.floor((authored / target) * 100);
      const reward = bondStakingRewardByRound.find(r => r.round === round);
      // todo: remove the following fee-less-than-two check when the observer is patched
      const fees = feeRewardByRound.filter(f => f.round === round && ((BigInt(f.reward) / BigInt(1000000000000)) < 2));
      return {
        round,
        length,
        authored,
        target,
        authors,
        score,
        reward: (!!reward || !!fees.length) && {
          bond: (!!reward) && {
            amount: reward.amount,
            block: reward.block,
          },
          fees: (!!fees.length) && fees.map(fee => ({
            amount: fee.reward,
            block: fee.number,
          })),
        },
      };
    });
  return { rounds };
};

module.exports.list = async (event) => {
  const response = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
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
      'Access-Control-Allow-Credentials': true,
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
      'Access-Control-Allow-Credentials': true,
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
      'Access-Control-Allow-Credentials': true,
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
