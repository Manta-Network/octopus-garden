'use strict';

import { MongoClient } from 'mongodb';
import { ApiPromise, WsProvider } from '@polkadot/api';
const uri = {
  scheme: 'mongodb+srv',
  host: 'chaincluster.oulrzox.mongodb.net',
  database: 'kusama-calamari',
  collection: 'round',
  auth: {
    mechanism: 'MONGODB-X509',
    source: '$external',
  },
  tls: 'true',
  cert: `${process.env.HOME}/.mongodb/X509-cert-7650484215012813007.pem`,
};
const client = new MongoClient(`${uri.scheme}://${uri.host}/${uri.database}?authMechanism=${uri.auth.mechanism}&authSource=${encodeURIComponent(uri.auth.source)}&tls=${uri.tls}&tlsCertificateKeyFile=${encodeURIComponent(uri.cert)}`);
const range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);
const randomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

//const provider = new WsProvider('wss://ws.archive.calamari.systems');
const provider = new WsProvider(`wss://a${randomInt(1, 4)}.calamari.systems`);


(async () => {
  const api = await ApiPromise.create({ provider });
  const collection = client.db(uri.database).collection(uri.collection);
  while(true) {
    try {
      const [
        round,
        lastHeader,
        candidatePool,
      ] = await Promise.all([
        api.query.parachainStaking.round(),
        api.rpc.chain.getHeader(),
        api.query.parachainStaking.candidatePool(),
      ]);
      const sessionKeys = await Promise.all(candidatePool.map(cp => api.query.session.nextKeys(cp.owner)));
      const collators = candidatePool.map((c, cI) => {
        return {
          account: c.owner,
          ...JSON.parse(JSON.stringify(sessionKeys[cI])),
        }
      });
      const [ firstBlockInCurrentRound, roundLength, currentRound ] = [ 'first', 'length', 'current' ].map((key) => parseInt(round[key], 10));
      const lastEver = parseInt(lastHeader.number, 10);
      const rounds = range(1, currentRound).reverse();
      for (let roundNumber = currentRound - 1; roundNumber > 0; roundNumber--) {
        const firstNumber = (firstBlockInCurrentRound - ((currentRound - roundNumber) * roundLength));
        const firstHash = await api.rpc.chain.getBlockHash(firstNumber);
        const firstBlock = await api.rpc.chain.getBlock(firstHash);
        const records = await (await api.at(firstHash)).query.system.events();
        const first = {
          number: firstNumber,
          hash: firstHash,
          events: firstBlock.block.extrinsics.map(({ method: { method, section } }, index) => ({
            method: `${section}.${method}`,
            events: records.filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index)).map(({ event }) => event),
          })),
        };
        const lastNumber = (firstNumber + roundLength - 1);
        const lastHash = await api.rpc.chain.getBlockHash(lastNumber);
        const last = {
          number: lastNumber,
          hash: lastHash,
        };


        const dbRound = {
          number: roundNumber,
          blocks: {
            first,
            last,
          },
         };
         console.log(JSON.stringify(dbRound));

        //const update = await collection.updateOne({ number: roundNumber }, { $set:  }, { upsert: true });
      }
      //await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.error(error);
    }
  }
})()
