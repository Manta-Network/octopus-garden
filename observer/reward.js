'use strict';

import { MongoClient } from 'mongodb';
import { ApiPromise, WsProvider } from '@polkadot/api';

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
//const client = new MongoClient(`mongodb://localhost:27017`);
const range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);
const randomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
};
const roundAuthorsCache = [];

//const provider = new WsProvider('wss://ws.archive.calamari.systems');
const provider = new WsProvider(`wss://a${randomInt(1, 5)}.calamari.systems`);

function bnToHex(bn) {
  //bn = BigInt(bn);

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

(async () => {
  const api = await ApiPromise.create({ provider });
  const collection = client.db(uri.database).collection(uri.collection);
  const candidatePool = await api.query.parachainStaking.candidatePool();
  const sessionKeys = await Promise.all(candidatePool.map(cp => api.query.session.nextKeys(cp.owner)));
  const collators = candidatePool.map((c, cI) => ({
    account: c.owner.toString(),
    ...JSON.parse(JSON.stringify(sessionKeys[cI])),
  }));

  console.log({collators});

  while(true) {
    try {
      const blocks = (await collection.find(
        {
          reward: { $exists: false }
        },
        {
          projection: {
            _id: false,
            round: true,
            number: true,
            hash: true,
            author: true,
            reward: true,
          }
        },
      ).sort( { number: -1 } ).limit(6000).toArray()) || [];
      for (let bI = 0; bI < blocks.length; bI++) {
        const block = blocks[bI];
        if (collators.some(c => c.nimbus === block.author)) {
          const { account } = collators.find(c => c.nimbus === block.author);
          const balance = {
            after: BigInt(JSON.parse(JSON.stringify(await (await api.at(block.hash)).query.system.account(account))).data.free),
            before: BigInt(JSON.parse(JSON.stringify(await (await api.at((await api.rpc.chain.getHeader(block.hash)).parentHash)).query.system.account(account))).data.free),
          };
          const reward = bnToHex(balance.after - balance.before);
          if (!!reward) {
            const update = await collection.updateOne({ number: block.number }, { $set: { reward } }, { upsert: true });
            console.log({block: {...block, reward}, update});
          }
        }
      }
      //await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.error(error);
    }
  }
})()
