#!/usr/bin/env bash

tmp_dir=$(mktemp -d)
subl ${tmp_dir}

curl \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"query":"{accounts(where:{balance_gt:0}){id}}"}' \
  https://app.gc.subsquid.io/beta/calamari/1/graphql \
  | jq -r '.data.accounts[].id' \
  | sort \
  > ${tmp_dir}/calamari-accounts-with-balance.csv
while read account; do
  polkadot-js-api --ws wss://ws.calamari.systems query.system.account.multi ${account} 2>/dev/null > ${tmp_dir}/balance-${account}.json
done < ${tmp_dir}/calamari-accounts-with-balance.csv
