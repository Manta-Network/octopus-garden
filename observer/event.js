'use strict';

import { MongoClient } from 'mongodb';
import { ApiPromise, WsProvider } from '@polkadot/api';
const uri = {
  scheme: 'mongodb+srv',
  host: 'chaincluster.oulrzox.mongodb.net',
  database: 'kusama-calamari',
  collection: 'reward',
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

async function main () {
  const api = await ApiPromise.create({ provider });
  await api.isReady;
  const db = client.db(uri.database);
  const collection = db.collection(uri.collection);
  while (true) {
    //const observedRounds = ((await roundCollection.find({}, { projection: { _id: false, number: true, first: true } }).toArray()) || []).map(r=>r.number);
    //const lastBlock = await api.rpc.chain.getBlock();
    const [
      round,
      lastBlock,
    ] = await Promise.all([
      api.query.parachainStaking.round(),
      api.rpc.chain.getBlock(),
    ]);
    const firstBlockNumber = 2196747;
    const lastBlockNumber = lastBlock.block.header.number;
    const roundLength = parseInt(round.length, 10);
    const rounds = range(1, round.current + 1).map((number) => ({
      number,
      first: round.first - ((round.current - number) * roundLength),
    }));
    //const startBlockNumber = rounds.find(r => r.number === 114).first - 1;
    const startBlockNumber = lastBlockNumber;
    const endBlockNumber = startBlockNumber - (roundLength * 3) + 1;
    for (let blockNumber = startBlockNumber; blockNumber >= endBlockNumber; blockNumber--) {
      const roundNumber = (rounds.find(r => blockNumber >= r.first && blockNumber < (r.first + roundLength)).number);
      const rewardsForRound = (roundNumber - 1);
      if (blockNumber > (rounds.find(r => r.number === roundNumber).first + 60)) {
        //console.log(`block: ${blockNumber}. skipped.`);
        continue;
      }
      //console.log(`seeking rewards for round: ${rewardsForRound}, in block: ${blockNumber}, round: ${roundNumber}...`);
      const [
        blockHash,
      ] = await Promise.all([
        api.rpc.chain.getBlockHash(blockNumber),
      ]);
      const [
        apiAt,
      ] = await Promise.all([
        api.at(blockHash),
      ]);
      const records = await apiAt.query.system.events();
      /*
      const extrinsics = signedBlock.block.extrinsics.map((extrinsic, eI) => ({
        extrinsic: JSON.stringify(extrinsic),
        events: records
          .filter(({ event, phase }) => event.section === 'parachainStaking' && event.method === 'Rewarded' && phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(eI))
          .map(({ event }) => ({
            account: event.data[0].toString(),
            amount: bnToHex(event.data[1]),
          }))
      })).filter(e=>!!e.events.length);
      extrinsics.forEach(console.log);
      */
      const events = records.filter(({ event }) => event.section === 'parachainStaking' && event.method === 'Rewarded').map(({ event }) => ({
        account: event.data[0].toString(),
        amount: bnToHex(event.data[1]),
      }));
      const rewarded = [...new Set(events.map(e=>e.account))].map(account => ({
        block: blockNumber,
        account,
        rewards: events.filter(e => e.account === account).map(e => ({
          amount: e.amount,
          round: rewardsForRound,
        })),
      }));
      let foundInBlock = 0;
      for (let aI = 0; aI < rewarded.length; aI++) {
        await collection.deleteMany( { account: rewarded[aI].account, block: rewarded[aI].block } );
        for (let rI = 0; rI < rewarded[aI].rewards.length; rI++) {
          const payout = {
            account: rewarded[aI].account,
            round: rewarded[aI].rewards[rI].round,
            block: rewarded[aI].block,
            amount: rewarded[aI].rewards[rI].amount,
          };
          const insert = await collection.insertOne(payout);
          if (insert.acknowledged) {
            foundInBlock++;
          }
          //console.log({ ...payout, insert });
        }
      }
      if (!!foundInBlock) {
        const roundIndex = rounds.findIndex(r => r.number === roundNumber);
        if (!!rounds[roundIndex].found) {
          rounds[roundIndex].found += foundInBlock;
        } else {
          if (!!rounds[roundIndex + 1].found) {
            console.log(`found ${rounds[roundIndex + 1].found} reward${(rounds[roundIndex + 1].found > 1) ? 's' : ''} for round: ${(rewardsForRound + 1)}, in round: ${(roundNumber + 1)}`);
          }
          rounds[roundIndex].found = foundInBlock;
        }
        console.log(`found ${foundInBlock} reward${(foundInBlock > 1) ? 's' : ''} for round: ${rewardsForRound}, in block: ${blockNumber} / round: ${roundNumber}`);
      } else {

      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(-1);
});
