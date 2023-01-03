'use strict';

//import { workerData, parentPort } from 'worker_threads';
import { MongoClient } from 'mongodb';
import { ApiPromise, WsProvider } from '@polkadot/api';
const uri = {
  scheme: 'mongodb+srv',
  host: 'chaincluster.oulrzox.mongodb.net',
  database: 'kusama-calamari',
  auth: {
    mechanism: 'MONGODB-X509',
    source: '$external',
  },
  tls: 'true',
  cert: `${process.env.HOME}/.mongodb/X509-cert-7650484215012813007.pem`,
};
const client = new MongoClient(`${uri.scheme}://${uri.host}/${uri.database}?authMechanism=${uri.auth.mechanism}&authSource=${encodeURIComponent(uri.auth.source)}&tls=${uri.tls}&tlsCertificateKeyFile=${encodeURIComponent(uri.cert)}`);
//const client = new MongoClient(`mongodb://localhost:27017`);
const range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);
const randomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}
function bnToHex(bn) {
  bn = BigInt(bn);

  var pos = true;
  if (bn < 0) {
    pos = false;
    bn = bitnot(bn);
  }

  var hex = bn.toString(16);
  if (hex.length % 2) { hex = '0' + hex; }

  if (pos && (0x80 & parseInt(hex.slice(0, 2), 16))) {
    hex = '00' + hex;
  }

  return `0x${hex}`;
}

function bitnot(bn) {
  bn = -bn;
  var bin = (bn).toString(2)
  var prefix = '';
  while (bin.length % 8) { bin = '0' + bin; }
  if ('1' === bin[0] && -1 !== bin.slice(1).indexOf('1')) {
    prefix = '11111111';
  }
  bin = bin.split('').map(function (i) {
    return '0' === i ? '1' : '0';
  }).join('');
  return BigInt('0b' + prefix + bin) + BigInt(1);
}

const provider = new WsProvider('wss://ws.archive.calamari.systems');
//const provider = new WsProvider(`wss://a${randomInt(1, 5)}.calamari.systems`);

const observationThreshold = 0.9;

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

/*
module.exports = (input, callback) => {
  callback(null, input + ' ' + world)
}
*/

async function main () {
  const api = await ApiPromise.create({ provider });
  await api.isReady;
  const db = client.db(uri.database);
  const rewardCollection = db.collection('reward');
  const roundCollection = db.collection('round');
  let iteration = 1;
  while (true) {
    const rounds = ((await roundCollection.find({}, {
      allowDiskUse: true,
      projection: { _id: false },
      sort: [
        [ 'number', -1 ],
      ],
    }).toArray()) || []);
    //shuffle(rounds);
    const roundLength = 1800;

    for (let roundIndex = 1; roundIndex < rounds.length; roundIndex++) {
      const roundNumber = rounds[roundIndex].number;
      const rewardForRoundIndex = roundIndex - 1;
      const rewardForRoundNumber = roundNumber - 1;
      const stakeholderCount = rounds[rewardForRoundIndex].stakeholders.reduce((sA, s) => (sA + 1 + s.nominators.length), 0);
      const observedRoundRewards = ((await rewardCollection.find({ round: rewardForRoundNumber }, { projection: { _id: false } }).toArray()) || []);
      let observedRoundRewardCount = observedRoundRewards.length;
      if (observedRoundRewardCount > stakeholderCount) {
        const deleteRound = await rewardCollection.deleteMany( { round: rewardForRoundNumber } );
        if (deleteRound.acknowledged) {
          observedRoundRewardCount = 0;
          console.log(deleteRound);
        }
      }
      const observationScore = (Number(observedRoundRewardCount * 100 / stakeholderCount) / 100);
      console.log(`iteration: ${iteration}, round: ${roundNumber} (${rounds[roundIndex].first} - ${(rounds[roundIndex].first + roundLength - 1)}), stakeholders: ${stakeholderCount}, observed reward count: ${observedRoundRewardCount}, observation score: ${observationScore}`);
      if (observationScore < observationThreshold) {
        for (let blockNumber = rounds[roundIndex].first; blockNumber < (rounds[roundIndex].first + roundLength); blockNumber++) {
          const observedBlockRewards = ((await rewardCollection.find({ block: blockNumber }, { projection: { _id: false } }).toArray()) || []);
          const observedBlockRewardCount = observedBlockRewards.length;
          if (!observedBlockRewardCount) {
            //await rewardCollection.deleteMany( { block: blockNumber } );
            const blockHash = await api.rpc.chain.getBlockHash(blockNumber)
            const apiAt = await api.at(blockHash);
            const records = await apiAt.query.system.events();
            const events = records.filter(({ event }) => event.section === 'parachainStaking' && event.method === 'Rewarded').map(({ event }) => ({
              account: event.data[0].toString(),
              amount: bnToHex(event.data[1]),
            }));
            const blockRewards = [];
            for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
              const reward = {
                account: events[eventIndex].account,
                round: rewardForRoundNumber,
                block: blockNumber,
                amount: events[eventIndex].amount,
              };
              const update = await rewardCollection.updateOne(reward, { $set: reward }, { upsert: true });
              if (update.acknowledged) {
                blockRewards.push({
                  account: reward.account,
                  amount: reward.amount,
                });
              }
            }
            console.log(`- block: ${blockNumber}, observed reward count: ${blockRewards.length}`);
            if (!blockRewards.length) {
              break;
            }
          }
        }
      }
    }
    iteration++;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(-1);
});
