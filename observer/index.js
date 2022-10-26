'use strict';

import { MongoClient } from 'mongodb';
import { ApiPromise, WsProvider } from '@polkadot/api';
const wsProvider = new WsProvider('wss://ws.archive.calamari.systems');
const uri = {
  scheme: 'mongodb+srv',
  host: 'chaincluster.oulrzox.mongodb.net',
  database: 'test',
  collection: 'kusama-calamari-block',
  auth: {
    mechanism: 'MONGODB-X509',
    source: '$external',
  },
  tls: 'true',
  cert: `${process.env.HOME}/.mongodb/X509-cert-7650484215012813007.pem`,
};
const client = new MongoClient(`${uri.scheme}://${uri.host}/${uri.database}?authMechanism=${uri.auth.mechanism}&authSource=${encodeURIComponent(uri.auth.source)}&tls=${uri.tls}&tlsCertificateKeyFile=${encodeURIComponent(uri.cert)}`);

async function run() {
  try {
    const database = client.db(uri.database);
    const collection = database.collection(uri.collection);
    const api = await ApiPromise.create({ provider: wsProvider });
    const [
      round,
      lastHeader,
    ] = await Promise.all([
      api.query.parachainStaking.round(),
      api.rpc.chain.getHeader(),
    ]);
    const [ firstInCurrentRound, roundLength, currentRound ] = [ 'first', 'length', 'current' ].map((key) => parseInt(round[key], 10));
    const lastEver = parseInt(lastHeader.number, 10);
    const blocks = [];
    for (let round = currentRound; round > 0; round--) {
      const firstInThisRound = (round === currentRound)
        ? firstInCurrentRound
        : firstInCurrentRound - (roundLength * (currentRound - round));
      const lastInThisRound = (round === currentRound)
        ? lastEver
        : firstInThisRound + roundLength - 1;
      for (let number = lastInThisRound; number >= firstInThisRound; number--) {
        const hash = await api.rpc.chain.getBlockHash(number);
        const header = await api.derive.chain.getHeader(hash);
        const block = {
          round,
          number,
          hash: hash.toString(),
          author: JSON.parse(JSON.stringify(header.digest.logs))[0].preRuntime[1],
        };
        console.log({
          ...block,
          update: await collection.updateOne({ number }, { $set: block }, { upsert: true }),
        });
      }
    }
    
    /*
    const chunkSize = 10;
    const chunkedBlocks = blocks.reduce((accumulator, block, bI) => {
      const cI = Math.floor(bI / chunkSize);
      if(!accumulator[cI]) {
        accumulator[cI] = [];
      }
      accumulator[cI].push(block);
      return accumulator;
    }, []);
    console.log({
      rounds: [...new Set(blocks.map(b=>b.round))].length,
      blocks: blocks.length,
      chunks: chunkedBlocks.length,
    });
    chunkedBlocks.forEach(async (chunk, cI) => {
      const hashes = await Promise.all(chunk.map((block) => api.rpc.chain.getBlockHash(block.number)));
      const blocks = (await Promise.all(hashes.map((h) => api.derive.chain.getHeader(h)))).map((header, i) => ({
        number: header.number,
        hash: hashes[i],
        round: chunk[i].round,
        author: JSON.parse(JSON.stringify(header.digest.logs))[0].preRuntime[1],
      }));
      console.log({
        chunk: cI,
        blocks,
      });
    });
    */
    
    /*
    for (let i = 0; i < blocks.length; i++) {
      const { number, round } = blocks[i];
      const hash = await api.rpc.chain.getBlockHash(number);
      const header = await api.derive.chain.getHeader(hash);
      const block = {
        round,
        number,
        hash: hash.toString(),
        author: JSON.parse(JSON.stringify(header.digest.logs))[0].preRuntime[1],
      };
    }
    */
  } catch (error) {
    console.error(error);
  }
}

run().catch(console.dir);
