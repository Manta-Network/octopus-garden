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
  await api.isReady;
  const collection = client.db(uri.database).collection(uri.collection);
  for (let o = 0; o < Infinity; o++) {
    try {
      const observedRounds = ((await collection.find({}, { projection: { _id: false, number: true } }).toArray()) || []).map(r=>r.number);
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
      for (let number = currentRound; number > 0; number--) {
        if (observedRounds.includes(number)) {
          console.log(`iteration ${o}: skipping previously observed round ${number}`);
          continue;
        }
        const first = (firstBlockInCurrentRound - ((currentRound - number) * roundLength));
        const roundStartHash = await api.rpc.chain.getBlockHash(first);
        const apiAtRoundStart = await api.at(roundStartHash);
        const apiAtRoundEnd = (number === currentRound)
          ? api
          : await api.at(await api.rpc.chain.getBlockHash(first + roundLength));
        const collators = await apiAtRoundStart.query.parachainStaking.candidatePool();
        const [
          topDelegations,
          awardedPts,
          nextKeys,
        ] = await Promise.all([
          apiAtRoundStart.query.parachainStaking.topDelegations.multi(collators.map(c => c.owner)),
          apiAtRoundEnd.query.parachainStaking.awardedPts.multi(collators.map(c => [number, c.owner])),
          apiAtRoundStart.query.session.nextKeys.multi(collators.map(c => c.owner)),
        ]);
        const top = JSON.parse(JSON.stringify(topDelegations));
        const points = JSON.parse(JSON.stringify(awardedPts));
        const round = {
          number: number,
          first,
          stakeholders: JSON.parse(JSON.stringify(collators)).map((collator, i) => ({
            collator: {
              ...collator,
              nimbus: JSON.parse(JSON.stringify(nextKeys[i])).nimbus,
              points: points[i],
            },
            nominators: top[i].delegations,
          })),
        };
        const update = await collection.updateOne({ number: round.number }, { $set: round }, { upsert: true });
        console.log({
          number: round.number,
          collators: round.stakeholders.length,
          authors: round.stakeholders.map(sh=>sh.collator.nimbus).length,
          nominators: round.stakeholders.reduce((a, c) => (a + c.nominators.length), 0),
          stake: round.stakeholders.reduce((aC, c) => (aC + BigInt(c.nominators.reduce((aN, n) => (aN + BigInt(n.amount)), BigInt(0)))), BigInt(0)),
          update,
        });
      }
    } catch (error) {
      console.error(error);
    }
    console.log(`iteration ${o}: sleeping for a minute...`);
    await new Promise(r => setTimeout(r, 60000));
  }
})()
