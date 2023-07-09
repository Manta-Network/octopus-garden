'use strict';

//import { MongoClient } from 'mongodb';
import { ApiPromise, WsProvider } from '@polkadot/api';

const apiCache = {};
const provider = new WsProvider('wss://ws.archive.calamari.systems');
const firstNimbusBlock = 2196747;
const nimbusRoundSize = 1800;
/*
const uri = {
  scheme: 'mongodb+srv',
  host: 'chaincluster.oulrzox.mongodb.net',
  database: 'kusama-cal20170708-video-fullamari',
  collection: 'block',
  auth: {
    mechanism: 'MONGODB-X509',
    source: '$external',
  },
  tls: 'true',
  cert: `${process.env.HOME}/.mongodb/X509-cert-7650484215012813007.pem`,
};
const client = new MongoClient(`${uri.scheme}://${uri.host}/${uri.database}?authMechanism=${uri.auth.mechanism}&authSource=${encodeURIComponent(uri.auth.source)}&tls=${uri.tls}&tlsCertificateKeyFile=${encodeURIComponent(uri.cert)}`);
*/
const getLastBlockNumber = async (api) => {
  console.log(`getLastBlockNumber`);
  await api.isReady;
  const lastBlock = await api.rpc.chain.getBlock();
  return lastBlock.block.header.number
};

const getBlockWithProvenance = async (number, api) => {
  await api.isReady;
  const hash = await api.rpc.chain.getBlockHash(number);
  const consensus = (number >= firstNimbusBlock) ? 'nimbus' : 'aura';
  const header = await api.derive.chain.getHeader(hash);
  console.log(JSON.stringify(header.digest.logs))
  const author = JSON.parse(JSON.stringify(header.digest.logs))[0].preRuntime[1];
  let collator;
  let collatorIndex;
  switch (consensus) {
    case 'nimbus':
      const roundNumber = Math.floor((number - firstNimbusBlock) / nimbusRoundSize) + 1;
      const roundStartBlockNumber = (firstNimbusBlock + ((roundNumber - 1) * nimbusRoundSize));
      /*
      console.log(`roundNumber: `, roundNumber);
      console.log(`roundStartBlockNumber: `, roundStartBlockNumber);
      console.log(`apiCache.at: `, apiCache.at);
      */
      if (apiCache.at !== roundStartBlockNumber) {
        const roundStartBlockHash = await api.rpc.chain.getBlockHash(roundStartBlockNumber);
        apiCache.api = await api.at(roundStartBlockHash);
        apiCache.at = roundStartBlockNumber;
        await apiCache.api.isReady;
        apiCache.collators = await apiCache.api.query.parachainStaking.candidatePool();
        apiCache.nextKeys = await apiCache.api.query.session.nextKeys.multi(apiCache.collators.map(c => c.owner));
      }
      collatorIndex = apiCache.nextKeys.findIndex((nk) => JSON.parse(JSON.stringify(nk))[consensus] === author);
      collator = JSON.parse(JSON.stringify(apiCache.collators[collatorIndex])).owner;
      break;
    case 'aura':
      if (number < apiCache.at) {
        const roundStartBlockNumber = (apiCache.at - apiCache.collators.length);
        const roundStartBlockHash = await api.rpc.chain.getBlockHash(roundStartBlockNumber);
        apiCache.api = await api.at(roundStartBlockHash);
        apiCache.at = roundStartBlockNumber;
        await apiCache.api.isReady;
        apiCache.collators = await apiCache.api.query.session.validators();
        //console.log(apiCache.collators);
        apiCache.nextKeys = await apiCache.api.query.session.nextKeys.multi(apiCache.collators);
        for (let i = 0; i < apiCache.collators.length; i++) {
          console.log(
            `collator: `, JSON.parse(JSON.stringify(apiCache.collators[i])),
            `aura: `, JSON.parse(JSON.stringify(apiCache.nextKeys[i])).aura
          );
        }
      }
      collatorIndex = apiCache.nextKeys.findIndex((nk) => JSON.parse(JSON.stringify(nk))[consensus] === author);
      //console.log(author, JSON.parse(JSON.stringify(apiCache.nextKeys[0])), collatorIndex);
      if (collatorIndex > 0) {
        collator = JSON.parse(JSON.stringify(apiCache.collators[collatorIndex]));
      }
      break;
    default:
  }

  return {
    number,
    hash: hash.toString(),
    author,
    ...(!!collator) && {
      collator,
    },
    consensus,
  };
  //const apiAt = await api.at(blockHash);
  //await apiAt.isReady;
};

async function main () {
  //const collection = client.db(uri.database).collection(uri.collection);
  const api = await ApiPromise.create({ provider });
  //const lastBlockNumber = await getLastBlockNumber(api);
  const lastBlockNumber = firstNimbusBlock + 5;
  console.log(`lastBlockNumber:`, lastBlockNumber);
  for (let blockNumber = lastBlockNumber; blockNumber > (lastBlockNumber - 10); blockNumber--) {
    console.log(`block:`, blockNumber);
    const block = await getBlockWithProvenance(blockNumber, api);
    console.log(block);
  }
  process.exit();
};

main().catch((error) => {
  console.error(error);
  process.exit(-1);
});
