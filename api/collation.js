'use strict';


const cache = {
  lifetime: 3600
};
const cacheAppend = (key, value) => {
  cache[key] = {
    expires: Date.now() + cache.lifetime * 1000,
    value
  };
}
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
  const [
    nominatorStakingRewardByRound,
    stakingRounds,
  ] = await Promise.all([
    prodDb.collection('reward').find({ account: { $ne: account }, block: { $in: bondStakingRewardByRound.map(x => x.block) } }, { projection: { _id: false } }).toArray(),
    prodDb.collection('round').find({}, { projection: { _id: false } }).toArray(),
  ]);
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
      const nominators = nominatorStakingRewardByRound.filter(r => r.round === round).map(n => ({
        account: n.account,
        stake: {
          amount: (stakingRounds
            .find(r => r.number === round)
            .stakeholders.find(sh => sh.collator.owner === account)
            .nominators.find(x => x.owner === n.account) || {})
            .amount,
        },
        reward: {
          amount: n.amount,
          block: n.block,
        },
      }));
      // todo: remove the following fee-less-than-two check when the observer is patched
      const fees = feeRewardByRound.filter(f => f.round === round && ((BigInt(f.reward) / BigInt(1000000000000)) < 2));
      return {
        round,
        length,
        authored,
        target,
        authors,
        score,
        nominators,
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
const fetchCandidateSummary = async (account, start, end) => {
  const cacheKey = `summary-${account}-${start}-${end}`;
  if (!cache[cacheKey] || cache[cacheKey].expires < Date.now()) {
    const rounds = (await fetchCandidateBlocks(account)).rounds
      .filter((r) => (!!r.score && r.round >= start && r.round <= end));
    const summary = {
      rounds: rounds.map((round) => ({
        ...round,
        nominators: {
          count: round.nominators.length,
          stake: Number(round.nominators.reduce((a, n) => (a + BigInt(n.stake.amount)), BigInt(0)) * BigInt(10 ** 6) / BigInt(1000000000000)) / (10 ** 6),
          reward: Number(round.nominators.reduce((a, n) => (a + BigInt(n.reward.amount)), BigInt(0)) * BigInt(10 ** 6) / BigInt(1000000000000)) / (10 ** 6)
        },
      })),
      score: Math.round(rounds.map((r) => r.score).reduce((acc, e) => acc + e, 0) / rounds.length),
      nominators: {
        top: rounds.filter(r => !!r.nominators.length).slice(-1)[0].nominators.sort((a, b) => (a.stake.amount > b.stake.amount) ? 1 : (a.stake.amount < b.stake.amount) ? -1 : 0).slice(-9).map((n) => n.account).map((account) => ({
          account,
          data: rounds.map((r) => (r.nominators.some(n => n.account === account))
            ? Number(BigInt(r.nominators.find(n => n.account === account).reward.amount) / BigInt(1000000000000))
            : null
          ),
        })),
        stake: rounds.map((round) => Number(round.nominators.reduce((a, n) => (a + BigInt(n.stake.amount)), BigInt(0)) * 100n / BigInt(1000000000000)) / 100),
      },
      bond: {
        rewards: 0,//rounds.map((round) => Number(BigInt(round.reward.bond.amount || 0) / BigInt(1000000000000))),
      },
      total: {
        reward: {
          bond: Number(rounds.reduce((acc, round) => (acc + BigInt((!!round.reward && !!round.reward.bond) ? round.reward.bond.amount : 0)), BigInt(0)) / BigInt(1000000000000)),
          nominators: Number(rounds.reduce((acc, round) => (acc + BigInt(round.nominators.reduce((a, n) => (a + BigInt(n.reward.amount)), BigInt(0)) * BigInt(10 ** 6))), BigInt(0)) / BigInt(1000000000000)) / (10 ** 6),
        }
      },
    };
    cacheAppend(cacheKey, summary);
  }
  return cache[cacheKey].value;
};

const nick = {
  dmxa3MJczFGT92BUQjwsxguUC2t5qFaDdagfpBQWdGkNPJYQ5: 'Anonstake',
  dmup6erAb8iJHQ2UXyHkA1G6m1hnSLRM55PdSD7DDbN1Ww4ZN: 'Validatrium',
  dmzbaFDDoYwXrX7Fa5mT2SfLapMZD8dynXPH4JviFEmMQz9Fu: 'bwarelabs-collator-a',
  dmuuG83f3JeXBmMp7e3XssJzq7rUAuNgAT3z7HoUPWueqpD1V: 'lh',
  dmy6WPM2KfD7WBxJYS6UG17GHJVCv8kewiwTr6ciVeXLbBpvf: 'CrypTech',
  dmvFayQJ9S7BgbHE2kmnoVq9UfdbfwHpZ4d1revJfVA6X9dGR: 'SeaFoodShop',
  dmu7rmwTa35Ec5cnNMpn8EpnFPA727sDtpCQwu9uCo2sfnmg1: 'черно море',
  dmvuGKcNe4VEv1rBVcTFEavAsccciEXcWoEi5iQrdR1NNMD1w: 'orange skies',
  dmx4WhyUDhAjsMf1mRD55qApjxnqSXcSsmweHgcv8seGkrN4R: 'staker-space',
  dmyZopEVaerkgSWWTd4WScPkhQgHTeLfMcHVCkQUyL1gu29c3: 'mini rocket',
  dmzWDne3MxniVDcF4i2nGkfPZa4pfkWL1AXqgSvWgZmDoTcYw: 'StakeBaby Calamari WS',
  dmx7NaUig7rdhwTJcnj6VPFaeou4KsvTqkMTcvHz25LcZtNrT: 'Brightlystake',
  dmzEUqQGSWsFewzpomYcjhLYkeSAvHYwEoKzG2yXcF8YQoJkL: 'MARJA',
  dmwM2xeWD2BjmCVYddTjB8QyYsktPsx2gySEZYbpdKFNnSGKd: 'FULLSTACK',
  dmxbgDpKK6V3Sayr3jz8MpoUJyxiWese6FtL42RRfZXnWewTD: 'ACV|TEAM',
  dmxyqP33GNwS6mA8bsWHQjeyKJM2eUVeCueER44b254ZCMy23: 'TopShot',
  dmycXK86XZfJV8CuJWoufuY3wq5mnRwhzQmsfQjDvNypyrUDM: 'Ketchup',
  dmzh2ESTJAy1MJ8Ekg9zs1653HFBUqCQeErihJZSHfFXGgNUh: 'Insight Finance',
  dmuomPgt6hJzKpDcEbz2BNNo9uPFXDvzBk7vnLQx6TLBQG85L: 'nettle',
  dmyEgR9K8hsgqt47XYnDDJJMaXgHnPLVjTFW8nfRa2RKoj17U: 'TheMilkyWayGang',
  dmvPNCD8YaHusmrdtvpB6HG72BibVSpnbHugT893x4Hw9P186: 'STAKECRAFT',
  dmyhGCWjejSyze6Hcqx43f8PNR9RWwm4EEobo8HehtBb8W8aU: 'CJ Calamari',
  dmuPiPzqGwuKsik8XLLPPi2xHCEwADyrfxakgiQbjtYEh7bDy: 'kooltek68',
  dmvvqrfK5AUYH294zTCCiimJRV7CQDDQyC7RAkd5aZgUn9S6f: '255 DAO',
  dmvoKqM8n2PVKyiYhm5VpMMnzMdk1z1WZAYDJEDmSLSqRgrbQ: 'Polkadotters',
  dmz1cxDw6nC5impJMZVfDwve5AG2s5AeaqSkZvQnEuqVwLYnL: 'pithecus-calamari-john316',
  dmuazX1JVi1XSd3g7ifaQQnJpodUfmbJVgqP8LXvgXBnsPGtA: 'calamari-bitManna',
  dmuaG34aVnxirpMsHXu6Mg7RxNN3cxG74ZyjLVEgvzNqBXm2U: 'SunshineAutosKma',
  dmyxfU1bJM5UR5RWsypKm9KQDkVofm3ifp5gVjzs8uQHUmBZb: 'pathrocknetwork',
  dmvVY24KwgNwoYnHw5EbC8mTUF9CtZeJzCnSGBawWzaRkNHH4: 'lets_node',
  dmyhNFR1qUuA8efaYvpW75qGKrYfzrK8ejygttHojeL4ujzUb: '🧊Iceberg Nodes🧊 | C1',
  dmu7ke7UqHb9oh4zbA9z7sUe9SjTEqqXyWF39dXva2aBuYyDR: 'CertHum',
  dmz8r5YJUBZp4zc5RbhBYQHCNAxN2WnfPUkMhDyqmMLTfK31E: 'P2P_ORG_1',
  dmzE9ZpFEiZMYTJ5JTcnhUxVenjpoKgEVNsRe3wHULui4XA44: 'ERN VENTURES',
  dmvPeJ8vK8TDkDHZUbcgd1ceGWDd5PDhzb4tnAho3FBBV3xXX: 'Masternode24.de',
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
        nick: nick[c.owner],
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

module.exports.summary = async (event) => {
  const response = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Content-Type': 'application/json',
    },
  };
  const { account, start, end } = event.pathParameters;
  try {
    const result = await fetchCandidateSummary(account, start, end);
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
