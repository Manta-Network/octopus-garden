import { Worker } from 'worker_threads';
import { MongoClient } from 'mongodb';
//import { ApiPromise, WsProvider } from '@polkadot/api';
const mongoUri = {
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
const mongoClient = new MongoClient(`${mongoUri.scheme}://${mongoUri.host}/${mongoUri.database}?authMechanism=${mongoUri.auth.mechanism}&authSource=${encodeURIComponent(mongoUri.auth.source)}&tls=${mongoUri.tls}&tlsCertificateKeyFile=${encodeURIComponent(mongoUri.cert)}`);
const db = mongoClient.db(mongoUri.database);
const rewardCollection = db.collection('reward');
const wsUri = 'wss://ws.archive.calamari.systems';
//const wsProvider = new WsProvider(wsUri);

const range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);

const runObservers = (observer) => {
  return range(10, 20).map((rewardedRoundNumber, worker) => {
    return new Promise((resolve, reject) => (
      new Worker(`./${observer}.js`, { workerData: { mongoUri, rewardedRoundNumber, } })
        .on('message', (message) => console.log(`worker`, worker, message))
        .on('error', reject)
        .on('exit', (code) => ((code !== 0) ? reject(new Error(`exit code: ${code}`)) : resolve(`exit code: ${code}`)))
    ));
  });
}

async function run() {
  const results = await Promise.all(runObservers('roundReward'));
  results.map((result, worker) => {
    console.log(`worker`, worker, result);
  });
}

run().catch(err => console.error(err))