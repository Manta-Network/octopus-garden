'use strict';

import { workerData, parentPort } from 'worker_threads';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { MongoClient } from 'mongodb';

const { rewardedRoundNumber, mongoUri } = workerData;

const bnToHex = (bn) => {
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
};
const bitnot = (bn) => {
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
};

const syncRoundRewards = async (rewardedRoundNumber, mongoUri) => {
  //parentPort.postMessage(`rewarded round: ${rewardedRoundNumber}, payout round: ${payoutRoundNumber}`);
  const api = await ApiPromise.create({ provider: new WsProvider('wss://ws.archive.calamari.systems') });
  const mongoClient = new MongoClient(`${mongoUri.scheme}://${mongoUri.host}/${mongoUri.database}?authMechanism=${mongoUri.auth.mechanism}&authSource=${encodeURIComponent(mongoUri.auth.source)}&tls=${mongoUri.tls}&tlsCertificateKeyFile=${encodeURIComponent(mongoUri.cert)}`);
  const db = mongoClient.db(mongoUri.database);
  const rewardCollection = db.collection('reward');
  const roundCollection = db.collection('round');

  const observationThreshold = 0.9;
  const payoutRoundNumber = (rewardedRoundNumber + 1);
  const roundLength = 1800;
  const [ rewardedRound, payoutRound ] = (await roundCollection.find({ number: { $in: [ rewardedRoundNumber, payoutRoundNumber ] } }, { projection: { _id: false } }).sort({ number: 1 }).toArray());
  const stakeholderCount = rewardedRound.stakeholders.reduce((sA, s) => (sA + 1 + s.nominators.length), 0);
  const observedRoundRewards = ((await rewardCollection.find({ round: rewardedRoundNumber }, { projection: { _id: false } }).toArray()) || []);
  let observedRoundRewardCount = observedRoundRewards.length;
  /*
  if (observedRoundRewardCount > stakeholderCount) {
    const deleteRound = await rewardCollection.deleteMany( { round: rewardedRoundNumber } );
    if (deleteRound.acknowledged) {
      observedRoundRewardCount = 0;
      console.log(deleteRound);
    }
  }
  */
  const observationScore = (Number(observedRoundRewardCount * 100 / stakeholderCount) / 100);
  parentPort.postMessage(`rewarded round: ${rewardedRoundNumber} (${rewardedRound.first} - ${(rewardedRound.first + roundLength - 1)}), payout round: ${payoutRoundNumber} (${payoutRound.first} - ${(payoutRound.first + roundLength - 1)}), stakeholders: ${stakeholderCount}, observed reward count: ${observedRoundRewardCount}, observation score: ${observationScore}`);
  if (observationScore < observationThreshold) {
    for (let blockNumber = payoutRound.first; blockNumber < (payoutRound.first + roundLength); blockNumber++) {
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
            round: rewardedRoundNumber,
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
        parentPort.postMessage(`- rewarded round: ${rewardedRoundNumber}, payout round: ${payoutRoundNumber}, payout block: ${blockNumber}, observed reward count: ${blockRewards.length}`);
        if (!blockRewards.length) {
          process.exit(0);
        }
      }
    }
  } else {
    process.exit(0);
  }
}

syncRoundRewards(rewardedRoundNumber, mongoUri).catch((error) => {
  //parentPort.postError(error);
  console.error(error);
  process.exit(-1);
});
