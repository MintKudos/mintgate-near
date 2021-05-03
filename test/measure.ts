import { argv } from 'process';
import fsp from 'fs/promises';
import path from 'path';

import BN from 'bn.js';
import { formatNearAmount, parseNearAmount } from 'near-api-js/lib/utils/format';

import type { Account } from 'near-api-js';

import setup from './setup';
import { createProfilers, getAccountFor, getContract, getUsers, getState } from './deploy';
import { MAX_GAS_ALLOWED, addTestCollectible, generateGateId, logger } from './utils';

import { MarketContractMethods, NftContractMethods } from '../src';
import { contractMetadata, MINTGATE_FEE, prefixes, royalty } from './initialData';

import type { MarketContract, NftContract } from '../src';

interface DataEntry {
  key: string;
  nftStaked: string;
  marketStaked: string;
}

const collectiblesToAdd = Number(argv.find((arg, i) => argv[i - 1] === '--collectibles') || 20);
const tokensToAdd = Number(argv.find((arg, i) => argv[i - 1] === '--tokens') || 40);

const collectiblesConcurrently = 5;
const tokensConcurrently = 5;
const approvalsConcurrently = 5;
const buysConcurrently = 2;

const getDataEntry = async (
  key: string,
  nftContractAccount: Account,
  marketContractAccount: Account
): Promise<DataEntry> => {
  const { stateStaked: nftStateStaked } = await getState(nftContractAccount, 'nft');
  const { stateStaked: marketStateStaked } = await getState(marketContractAccount, 'market');

  return {
    key,
    nftStaked: formatNearAmount(nftStateStaked),
    marketStaked: formatNearAmount(marketStateStaked),
  };
};

const measure = async () => {
  await setup();

  const priceHrNear = '1';
  const priceInternalNear = <string>parseNearAmount(priceHrNear);

  const nftFeeUser = await getAccountFor(prefixes.nft.feeUser);
  const adminUser = await getAccountFor(prefixes.nft.admin);

  const nftUsers = await getUsers(prefixes.nft.users);
  const marketUsers = await getUsers(prefixes.market.users);
  const nftContractArguments: NftContract['init'] = {
    admin_id: adminUser.accountId,
    metadata: contractMetadata,
    mintgate_fee: MINTGATE_FEE,
    mintgate_fee_account_id: nftFeeUser.accountId,
    ...royalty,
  };

  const nftContract = await getContract<NftContract, keyof NftContract>(
    prefixes.nft.contract,
    'target/wasm32-unknown-unknown/release/mg_nft.wasm',
    {
      func: 'init',
      args: nftContractArguments,
    }
  );

  const marketContract = await getContract<MarketContract, keyof MarketContract>(
    prefixes.market.contract,
    'target/wasm32-unknown-unknown/release/mg_market.wasm',
    {
      func: 'init',
      args: {},
    }
  );

  const [alice, bob] = createProfilers<NftContract>(nftUsers, nftContract, NftContractMethods);
  const [merchant1, merchant2] = createProfilers<MarketContract>(marketUsers, marketContract, MarketContractMethods);

  const data: DataEntry[] = [];
  data.push(await getDataEntry('init', alice.contractAccount, merchant1.contractAccount));

  for (let i = 0; i <= collectiblesToAdd; i += collectiblesConcurrently) {
    const collectiblesToAddNow =
      i + collectiblesConcurrently > collectiblesToAdd ? collectiblesToAdd - i : collectiblesConcurrently;

    if (!collectiblesToAddNow) {
      break;
    }

    await Promise.all(
      Array.from({ length: collectiblesToAddNow }, async () =>
        addTestCollectible(alice.contract, { gate_id: await generateGateId() })
      )
    );

    data.push(
      await getDataEntry(`collectibles: ${i + collectiblesToAddNow}`, alice.contractAccount, merchant1.contractAccount)
    );
  }

  let collectibles = (await alice.contract.get_collectibles_by_creator({ creator_id: alice.accountId })).reverse();
  const collectiblesToDelete = collectiblesToAdd - 1;

  for (let i = 0; i <= collectiblesToDelete; i += collectiblesConcurrently) {
    const collectiblesToDeleteNow =
      i + collectiblesConcurrently > collectiblesToDelete ? collectiblesToDelete - i : collectiblesConcurrently;

    if (!collectiblesToDeleteNow) {
      break;
    }

    await Promise.all(
      // eslint-disable-next-line no-loop-func
      Array.from({ length: collectiblesToDeleteNow }, async (_, index) =>
        alice.contract.delete_collectible({
          gate_id: collectibles[index + i].gate_id,
        })
      )
    );

    data.push(
      await getDataEntry(
        `collectibles: ${collectiblesToAdd - i - collectiblesToDeleteNow}`,
        alice.contractAccount,
        merchant1.contractAccount
      )
    );
  }

  collectibles = await alice.contract.get_collectibles_by_creator({ creator_id: alice.accountId });
  const gateId = collectibles[collectibles.length - 1].gate_id;

  await bob.contract.claim_token({ gate_id: gateId });

  for (let i = 0; i <= tokensToAdd - 1; i += tokensConcurrently) {
    const tokensToAddNow = i + tokensConcurrently > tokensToAdd - 1 ? tokensToAdd - 1 - i : tokensConcurrently;

    if (!tokensToAddNow) {
      break;
    }

    await Promise.all(
      Array.from({ length: tokensToAddNow }, async () => bob.contract.claim_token({ gate_id: gateId }))
    );

    data.push(
      await getDataEntry(`tokens added: ${i + tokensToAddNow + 1}`, alice.contractAccount, merchant1.contractAccount)
    );
  }

  const tokens = (await bob.contract.get_tokens_by_owner({ owner_id: bob.accountId })).reverse();

  for (let i = 0; i <= tokensToAdd; i += tokensConcurrently) {
    const tokensToTransferNow = i + tokensConcurrently > tokensToAdd ? tokensToAdd - i : tokensConcurrently;

    if (!tokensToTransferNow) {
      break;
    }

    await Promise.all(
      // eslint-disable-next-line no-loop-func
      Array.from({ length: tokensToTransferNow }, async (_, index) =>
        bob.contract.nft_transfer({
          receiver_id: alice.accountId,
          token_id: tokens[i + index].token_id,
          enforce_approval_id: null,
          memo: null,
        })
      )
    );

    data.push(
      await getDataEntry(
        `tokens transferred: ${i + tokensToTransferNow}`,
        alice.contractAccount,
        merchant1.contractAccount
      )
    );
  }

  for (let i = 0; i <= tokensToAdd; i += approvalsConcurrently) {
    const tokensToApproveNow = i + approvalsConcurrently > tokensToAdd ? tokensToAdd - i : approvalsConcurrently;

    if (!tokensToApproveNow) {
      break;
    }

    await Promise.all(
      Array.from({ length: tokensToApproveNow }, async (_, index) =>
        alice.contract.nft_approve(
          {
            token_id: tokens[i + index].token_id,
            account_id: merchant1.contract.contractId,
            msg: JSON.stringify({ min_price: priceInternalNear }),
          },
          MAX_GAS_ALLOWED
        )
      )
    );

    data.push(
      await getDataEntry(`tokens approved: ${i + tokensToApproveNow}`, alice.contractAccount, merchant1.contractAccount)
    );
  }

  for (let i = 0; i <= tokensToAdd; i += approvalsConcurrently) {
    const tokensToRevokeNow = i + approvalsConcurrently > tokensToAdd ? tokensToAdd - i : approvalsConcurrently;

    if (!tokensToRevokeNow) {
      break;
    }

    await Promise.all(
      Array.from({ length: tokensToRevokeNow }, async (_, index) =>
        alice.contract.nft_revoke(
          {
            token_id: tokens[i + index].token_id,
            account_id: merchant1.contract.contractId,
          },
          MAX_GAS_ALLOWED
        )
      )
    );

    data.push(
      await getDataEntry(`tokens revoked: ${i + tokensToRevokeNow}`, alice.contractAccount, merchant1.contractAccount)
    );
  }

  for (let i = 0; i <= tokensToAdd; i += approvalsConcurrently) {
    const tokensToApproveNow = i + approvalsConcurrently > tokensToAdd ? tokensToAdd - i : approvalsConcurrently;

    if (!tokensToApproveNow) {
      break;
    }

    await alice.contract.batch_approve(
      {
        tokens: tokens.slice(i, i + approvalsConcurrently).map(({ token_id }) => [token_id, priceInternalNear]),
        account_id: merchant1.contract.contractId,
      },
      MAX_GAS_ALLOWED
    );

    data.push(
      await getDataEntry(
        `tokens batch approved: ${i + tokensToApproveNow}`,
        alice.contractAccount,
        merchant1.contractAccount
      )
    );
  }

  for (let i = 0; i <= tokensToAdd; i += buysConcurrently) {
    const tokensToBuyNow = i + buysConcurrently > tokensToAdd ? tokensToAdd - i : buysConcurrently;

    if (!tokensToBuyNow) {
      break;
    }

    await Promise.all(
      Array.from({ length: tokensToBuyNow }, async (_, index) => {
        return merchant2.contract.buy_token(
          {
            nft_contract_id: bob.contractAccount.accountId,
            token_id: tokens[i + index].token_id,
          },
          MAX_GAS_ALLOWED,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          new BN(priceInternalNear!)
        );
      })
    );

    data.push(
      await getDataEntry(`tokens bought: ${i + tokensToBuyNow}`, alice.contractAccount, merchant1.contractAccount)
    );
  }

  logger.infoln(`Writing data.`);
  await fsp.writeFile(path.resolve(__dirname, 'data.js'), `const data = ${JSON.stringify(data)}`);
};

(async () => {
  try {
    await measure();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e);
  }
})();
