'use strict';

import { MongoClient } from 'mongodb';
import { ApiPromise, WsProvider } from '@polkadot/api';
const provider = new WsProvider('wss://ws.archive.calamari.systems');
const uri = {
  scheme: 'mongodb+srv',
  host: 'chaincluster.oulrzox.mongodb.net',
  database: 'kusama-calamari',
  collection: 'block',
  auth: {
    mechanism: 'MONGODB-X509',
    source: '$external',
  },
  tls: 'true',
  cert: `${process.env.HOME}/.mongodb/X509-cert-7650484215012813007.pem`,
};
const client = new MongoClient(`${uri.scheme}://${uri.host}/${uri.database}?authMechanism=${uri.auth.mechanism}&authSource=${encodeURIComponent(uri.auth.source)}&tls=${uri.tls}&tlsCertificateKeyFile=${encodeURIComponent(uri.cert)}`);

const range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);

const unsyncedBlockNumbers = async (collection, first, last) => {
  const allBlockNumbers = range(first, (last + 1));
  const syncedBlockNumbers = ((await collection.find(
    {
      number: {
        $gte: first,
        $lte: last,
      },
    },
    {
      projection: {
        _id: false,
        number: true,
      }
    },
  ).toArray() || []).map((x) => x.number));
  return allBlockNumbers.filter((b) => !syncedBlockNumbers.some((x) => x === b));
};

const unsyncedRoundNumbers = async (collection, last, roundLength) => {
  const allRoundNumbers = range(1, (last + 1));
  const syncedRoundNumbers = ((await collection.aggregate([
    {
      $group: {
        _id: '$round',
        count: {
          $sum: 1,
        },
      },
    },
  ]).toArray() || []).filter((x) => x.count === roundLength).map((x) => x._id));
  return allRoundNumbers.filter((b) => !syncedRoundNumbers.some((x) => x === b));
};

const syncBlock = async (api, collection, blockNumber, roundNumber) => {
  const hash = await api.rpc.chain.getBlockHash(blockNumber);
  const header = await api.derive.chain.getHeader(hash);
  const block = {
    round: roundNumber,
    number: blockNumber,
    hash: hash.toString(),
    author: JSON.parse(JSON.stringify(header.digest.logs))[0].preRuntime[1],
  };
  return {
    block,
    update: await collection.updateOne({ number: block.number }, { $set: block }, { upsert: true }),
  };
};

const syncRound = async (api, collection, roundNumber, firstBlockNumber, lastBlockNumber) => {
  const unsynced = await unsyncedBlockNumbers(collection, firstBlockNumber, lastBlockNumber);
  for (let blockNumber = lastBlockNumber; blockNumber >= firstBlockNumber; blockNumber--) {
    if (unsynced.some((u) => u === blockNumber)) {
      const blockSync = await syncBlock(api, collection, blockNumber, roundNumber);
      console.log(`round: ${roundNumber}, block: ${blockNumber}, author: ${blockSync.block.author}, db: ${(!!blockSync.update.modifiedCount) ? 'updated' : (!!blockSync.update.upsertedCount) ? 'inserted' : 'observed'}`);
    }/* else {
      console.log(`round: ${roundNumber}, block: ${blockNumber}, skipped: true`);
    }*/
  }
};

(async () => {
  const database = client.db(uri.database);
  const collection = database.collection(uri.collection);
  const api = await ApiPromise.create({ provider });
  await api.isReady;
  const firstRoundNumber = 2;
  while(true) {
    const [ lastRound, lastBlockHeader ] = await Promise.all([ api.query.parachainStaking.round(), api.rpc.chain.getHeader() ]);
    const [ firstBlockNumberInLastRound, roundLength, lastRoundNumber ] = [ 'first', 'length', 'current' ].map((key) => parseInt(lastRound[key], 10));
    const lastEverBlockNumber = parseInt(lastBlockHeader.number, 10);
    const unsynced = await unsyncedRoundNumbers(collection, lastRoundNumber, roundLength);
    for (let roundNumber = lastRoundNumber; roundNumber >= firstRoundNumber; roundNumber--) {
      if (unsynced.some((u) => u === roundNumber)) {
        const firstBlockNumber = (roundNumber === lastRoundNumber)
          ? firstBlockNumberInLastRound
          : firstBlockNumberInLastRound - ((lastRoundNumber - roundNumber) * roundLength);
        const lastBlockNumber = (roundNumber === lastRoundNumber)
          ? lastEverBlockNumber
          : firstBlockNumber + roundLength;
        await syncRound(api, collection, roundNumber, firstBlockNumber, lastBlockNumber);
      }/* else {
        console.log(`round: ${roundNumber}, skipped: true`);
      }*/
    }
    await new Promise(r => setTimeout(r, 2000));
  };
})()
