import fs from 'fs';
import { homedir } from 'os';
import { basename } from 'path';

import { sha256 } from 'js-sha256';
import bs58 from 'bs58';
import BN from 'bn.js';

import { Near, Contract, keyStores, utils, Account } from 'near-api-js';
import { NearConfig } from 'near-api-js/lib/near';
import { FinalExecutionOutcome } from 'near-api-js/lib/providers';

import { logger } from './utils';

import type { AccountContract, NftContract, Methods, MarketContract } from '../src';

const GAS = new BN(300000000000000);

export async function createProfiler<T extends NftContract | MarketContract>(
  contractPrefix: string,
  wasmPath: string,
  methods: Methods,
  init: { func: string; args: any } | null,
  config: NearConfig,
  ...userPrefixes: string[]
): Promise<{
  contractName: string;
  users: AccountContract<T>[];
}> {
  const keyDir = `${homedir()}/.near-credentials`;
  const keyStore = new keyStores.UnencryptedFileSystemKeyStore(keyDir);

  const near = new Near({
    deps: { keyStore },
    ...config,
  });

  const getAccountFor = async (prefix: string) => {
    logger.start(`Recovering account for ${logger.param(prefix)}`);
    const accountId = fs.readFileSync(`neardev/${prefix}-account`).toString();
    const account = await near.account(accountId);
    logger.prog(`found ${logger.param(accountId)}`);
    logger.done();
    return account;
  };

  const contractAccount = await getAccountFor(contractPrefix);
  const users = await Promise.all(
    userPrefixes.map(async (user) => {
      const account = await getAccountFor(user);
      const contract = <T & Contract>new Contract(account, contractAccount.accountId, {
        ...methods,
        // signer: account.accountId
      });
      return {
        account,
        contract,
        user,
      };
    })
  );

  const append = async (outcome: FinalExecutionOutcome | {}) => {
    const getState = async (account: Account, prefix: string) => {
      const state = await account.state();
      const balance = await account.getAccountBalance();

      if (!new BN(balance.total).eq(new BN(balance.stateStaked).add(new BN(balance.available)))) {
        console.log('Total neq staked+available');
      }

      const amountf = (value: string) => logger.warn(utils.format.formatNearAmount(value, 4));
      const isContract = state.code_hash == '11111111111111111111111111111111' ? '\u261e' : '\u270e';
      logger.info(`${isContract}${prefix}: Ⓝ S${amountf(balance.stateStaked)}+A${amountf(balance.available)}`);

      return { ...state, ...balance };
    };

    const entry = {
      ...outcome,
      contract: await getState(contractAccount, contractPrefix),
      ...Object.fromEntries(
        await Promise.all(users.map(async ({ account, user }) => [user, await getState(account, user)]))
      ),
    };
    logger.done();
    return entry;
  };

  logger.start('Initial entry');
  const initialEntry = await append({});

  await (async () => {
    logger.start(`Contract ${logger.param(basename(wasmPath))}`);
    const wasmData = fs.readFileSync(wasmPath);
    const wasmHash = sha256.array(wasmData);
    const wasmBase64 = bs58.encode(Buffer.from(wasmHash));
    logger.info(`sha256/base58:${wasmBase64}`);
    if (initialEntry.contract.code_hash !== wasmBase64) {
      logger.info('deploying');
      const outcome = await contractAccount.deployContract(wasmData);
      if (init) {
        await contractAccount.functionCall(contractAccount.accountId, init.func, init.args, GAS, new BN(0));
      }

      logger.done();
      await append(outcome);
    } else {
      logger.info('up to date');
      logger.done();
    }
  })();

  return {
    contractName: contractAccount.accountId,

    users: users.map(({ account, contract }) => {
      return {
        accountId: account.accountId,
        account,
        contract,
      };
    }),
  };
}
