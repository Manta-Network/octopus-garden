'use strict';

const fetch = require('node-fetch');

const subscanApiKey = process.env.subscan_api_key;
const range = (start, end) => Array.from({length: ((end + 1) - start)}, (v, k) => k + start);
const response = {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  },
};
const treasury = 'dmwQify37xfGt1wDhAi8zfvovsAkdK3aD4iqW8dn8nfrsAYsX';

module.exports.over = async (event) => {
  try {
    const amount = Number(event.pathParameters.amount);
    const responses = await Promise.all(range(0, 1).map((page) => fetch(`https://calamari.api.subscan.io/api/scan/accounts`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `X-API-Key ${subscanApiKey}`,
      },
      method: 'POST',
      body: JSON.stringify({
        row: 100,
        page,
        order: 'desc',
        order_field: 'balance',
      }),
    })));
    const accounts = (await Promise.all(responses.map((response) => response.json()))).reduce((a, json) => ([
      ...a,
      ...(json.data.list || []).filter(({ address, balance }) => address != treasury && Number(balance) > amount).map(({ address, balance: total, balance_lock: locked }) => ({
        address,
        balance: {
          total,
          locked,
        },
      })),
    ]), []);
    response.statusCode = 200;
    response.body = JSON.stringify(
      accounts,
      2
    );
  } catch (error) {
    response.statusCode = 500;
    response.body = JSON.stringify({ error }, null, 2);
    console.error(error);
  }
  return response;
};
