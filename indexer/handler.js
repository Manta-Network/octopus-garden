'use strict';

import { ApiPromise, WsProvider } from '@polkadot/api';
import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';

const provider = new WsProvider('wss://ws.archive.calamari.systems');
const uri = {
  //scheme: 'mongodb+srv',
  //host: 'chaincluster.oulrzox.mongodb.net',
  database: 'kusama-calamari',
  collection: 'block',
  string: process.env.db_readwrite,
  /*
  auth: {
    mechanism: 'MONGODB-X509',
    source: '$external',
  },
  tls: 'true',
  cert: `./X509-cert-7650484215012813007.pem`,
  */
};
const subscanApiKey = process.env.subscan_api_key;
//const client = new MongoClient(`${uri.scheme}://${uri.host}/${uri.database}?authMechanism=${uri.auth.mechanism}&authSource=${encodeURIComponent(uri.auth.source)}&tls=${uri.tls}&tlsCertificateKeyFile=${encodeURIComponent(uri.cert)}`);
const client = new MongoClient(uri.string);

const chunk = (list, size) => {
  let segment = [];
  let result = [];
  for (let i = 0; i < list.length; i++) {
    if (i % size !== size - 1) {
      segment.push(list[i]);
    } else {
      segment.push(list[i]);
      result.push(segment);
      segment = [];
    }
  }
  if (segment.length !== 0) {
    result.push(segment);
  }
  return result;
};


export const getMissingBlockInfo = async (api) => {
  const [
    parachainStakingRound,
    latestBlockHeader,
  ] = await Promise.all([
    api.query.parachainStaking.round(),
    api.rpc.chain.getHeader(),
  ]);
  const [ firstBlockInCurrentRound, roundLength, currentRound ] = [ 'first', 'length', 'current' ].map((key) => parseInt(parachainStakingRound[key], 10));
  const latestBlockNumber = parseInt(latestBlockHeader.number, 10);
  const { missing } = (await client.db(uri.database).collection(uri.collection).aggregate([
    {
      $match: {
        number: {
          $gte: (latestBlockNumber - (roundLength * 100)),
        },
      },
    },
    {
      $group: {
        _id: null,
        all: {
          $push: '$number',
        },
      },
    },
    {
      $addFields: {
        missing: {
          $setDifference: [
            {
              $range: [
                (latestBlockNumber - (roundLength * 100)),
                latestBlockNumber,
              ],
            },
            '$all',
          ]
        },
      },
    },
  ], { allowDiskUse: true }).toArray())[0];
  console.log(`observed ${missing.length} missing blocks between ${(latestBlockNumber - (roundLength * 100))} and ${latestBlockNumber}.`);
  return {
    missing,
    current: {
      block: {
        number: latestBlockNumber,
      },
      round: {
        number: currentRound,
        first: firstBlockInCurrentRound,
        size: roundLength,
      },
    },
  };
}

const getRound = (blockNumber, currentRound) => (
  (blockNumber >= currentRound.first)
    ? currentRound.number
    : (currentRound.number - (Math.floor((currentRound.first - blockNumber) / currentRound.size) + 1))
);

export const author = async () => {
  const api = await ApiPromise.create({ provider });
  await api.isReady;
  const missingBlockInfo = await getMissingBlockInfo(api);
  //console.log(missingBlockInfo);
  const missingBlocks = await Promise.all(missingBlockInfo.missing.map(async (number) => {
    const round = getRound(number, missingBlockInfo.current.round);
    const hash = await api.rpc.chain.getBlockHash(number);
    const header = (round > 0)
      ? await api.derive.chain.getHeader(hash)
      : undefined;
    const block = {
      number,
      ...(!!header) && {
        author: JSON.parse(JSON.stringify(header.digest.logs))[0].preRuntime[1],
      },
      hash: hash.toString(),
      ...(round > 0) && {
        round,
      },
    };
    const update = await client.db(uri.database).collection(uri.collection).updateOne(
      {
        number,
      },
      {
        $set: block,
      },
      {
        upsert: true,
      }
    );
    //console.log({block, update});
    if (update.acknowledged) {
      if (!!update.upsertedCount) {
        console.log(`inserted block: ${number}`);
      } else if (!!update.modifiedCount) {
        console.log(`updated block: ${number}`);
      } else if (!!update.matchedCount) {
        console.log(`skipped block: ${number}`);
      }
    }
    return block;
  }));
};

export const block = async () => {
  const incompleteBlocks = (await client.db(uri.database).collection(uri.collection).find(
    {
      timestamp: {
        $exists: false,
      },
      collator: {
        $exists: false,
      },
    },
    {
      projection: {
        _id: false,
        number: true,
      }
    },
  ).sort({ number: 1 }).limit(36).toArray()).map((b) => b.number);

  /*
  the old school loop and sleep is used intentionally here in order
  to throttle subscan queries to no more than 2 requests per second
  */
  for (let i = 0; i < incompleteBlocks.length; i++) {
    const number = incompleteBlocks[i];
    const response = await fetch(
      'https://calamari.api.subscan.io/api/scan/block',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': subscanApiKey,
        },
        body: JSON.stringify({ block_num: number, only_head: true }),
      }
    );
    if (response.status === 429) {
      console.error(`block ${number} not fetched from subscan (api request throttled)`);
      await new Promise(r => setTimeout(r, 1000));
    } else if (!response.ok) {
      console.error(response);
    } else {
      const json = await response.json();
      const block = {
        number,
        hash: json.data.hash,
        timestamp: json.data.block_timestamp,
        collator: json.data.validator,
      };
      const update = await client.db(uri.database).collection(uri.collection).updateOne(
        {
          number: block.number
        },
        {
          $set: {
            collator: block.collator,
            hash: block.hash,
            timestamp: new Date(block.timestamp * 1000),
          }
        }
      );
      if (!!update.modifiedCount) {
        console.log(`block ${number} updated`);
      } else if (!!update.acknowledged && !update.modifiedCount && !!update.matchedCount) {
        console.log(`block ${number} update skipped`);
      } else {
        console.error(`block ${number} update failed`);
        console.error(update);
      }
    }
  }
};

export const dedupe = async () => {
  const duplicateBlocks = (await client.db(uri.database).collection(uri.collection).aggregate([
    {
      $group: {
        _id: '$number',
        count: {
          $sum: 1,
        },
      },
    },
    {
      $match: {
        count: {
          $gt: 1,
        },
      },
    },
    {
      $project: {
        _id: false,
        number: "$_id",
      }
    },
  ], { allowDiskUse: true }).toArray()).map((b) => b.number);
  await Promise.all(duplicateBlocks.map((number) => client.db(uri.database).collection(uri.collection).deleteOne({ number })));
  console.log(`deduped ${duplicateBlocks.length} blocks`);
};
