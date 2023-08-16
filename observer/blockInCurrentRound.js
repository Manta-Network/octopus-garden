'use strict';

import { MongoClient } from 'mongodb';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { temujin } from './constants.js';
import { randomInt, range } from './utils.js';

const databaseName = 'kusama-calamari';
const collectionName = 'block';
const client = new MongoClient(`${temujin.scheme}://${temujin.host}/${databaseName}?authMechanism=${temujin.auth.mechanism}&authSource=${encodeURIComponent(temujin.auth.source)}&tls=${temujin.tls}&tlsCertificateKeyFile=${encodeURIComponent(temujin.cert)}&tlsCAFile=${encodeURIComponent(temujin.ca)}`);
const provider = new WsProvider('wss://ws.archive.calamari.systems');

(async () => {
  const api = await ApiPromise.create({ provider });
  await api.isReady;
  const collection = client.db(databaseName).collection(collectionName);
  while(true) {
    try {
      const [
        round,
        lastHeader,
      ] = await Promise.all([
        api.query.parachainStaking.round(),
        api.rpc.chain.getHeader(),
      ]);
      const [ firstBlockInRound, roundNumber ] = [ 'first', 'current' ].map((key) => parseInt(round[key], 10));
      const lastEver = parseInt(lastHeader.number, 10);
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
        last: lastEver,
      });
      const blocks = range(firstBlockInRound, (lastEver + 1));
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
        console.log(`round: ${block.round}, block: ${block.number} ${block.hash}, author: ${block.author}, upsert: ${(!!update.modifiedCount) ? 'update' : (!!update.upsertedCount) ? 'insert' : (!!update.acknowledged) ? 'observed' : 'error'}`);
        if (!update.modifiedCount && !update.upsertedCount && !update.acknowledged) {
          console.log(JSON.stringify(update));
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
})()
