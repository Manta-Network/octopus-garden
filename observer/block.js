'use strict';

import { MongoClient } from 'mongodb';
import { ApiPromise, WsProvider } from '@polkadot/api';
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
//const client = new MongoClient(`mongodb://localhost:27017`);
const range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);
const randomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

const provider = new WsProvider('wss://ws.archive.calamari.systems');
//const provider = new WsProvider(`wss://a${randomInt(1, 5)}.calamari.systems`);


(async () => {
  const api = await ApiPromise.create({ provider });
  const collection = client.db(uri.database).collection(uri.collection);
  while(true) {
    try {
      const [
        round,
        lastHeader,
      ] = await Promise.all([
        api.query.parachainStaking.round(),
        api.rpc.chain.getHeader(),
      ]);
      const [ firstBlockInCurrentRound, roundLength, currentRound ] = [ 'first', 'length', 'current' ].map((key) => parseInt(round[key], 10));
      const lastEver = parseInt(lastHeader.number, 10);
      const rounds = range(1, currentRound).reverse();
      for (let roundNumber = currentRound - 1; roundNumber > 0; roundNumber--) {
        const firstBlockInRound = (firstBlockInCurrentRound - ((currentRound - roundNumber) * roundLength));
        const lastBlockInRound = (firstBlockInRound + roundLength - 1);
        const dbBlocks = (await collection.find(
          {
            round: roundNumber,
          },
          {
            projection: {
              _id: false,
              round: true,
              number: true,
            }
          },
        ).toArray()) || [];
        console.log({
          round: roundNumber,
          first: firstBlockInRound,
          last: lastBlockInRound,
        });
        const blocks = range(firstBlockInRound, (lastBlockInRound + 1));
        const missing = blocks.filter(b => !dbBlocks.find(x=>x.number===b)).map((number) => ({ number, round: roundNumber }));
        for (let mI = missing.length - 1; mI >= 0; mI--) {
          const hash = await api.rpc.chain.getBlockHash(missing[mI].number);
          const header = await api.derive.chain.getHeader(hash);
          const block = {
            ...missing[mI],
            hash: hash.toString(),
            author: JSON.parse(JSON.stringify(header.digest.logs))[0].preRuntime[1],
          };
          const update = await collection.updateOne({ number: block.number }, { $set: block }, { upsert: true });
          console.log({block, update});
          //await new Promise(r => setTimeout(r, 10000));
        }
      }
      //await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.error(error);
    }
  }
})()
