import fs from 'fs';
import { homedir } from 'os';
import { basename } from 'path';

import { sha256 } from 'js-sha256';
import bs58 from 'bs58';
import BN from 'bn.js';

import { Contract, keyStores, Near, utils } from 'near-api-js';

import type { AccountBalance, AccountState } from 'near-api-js/lib/account';

import type { Account } from 'near-api-js';

import { logger } from './utils';
import { getConfig } from './config';

import type { AccountContract, MarketContract, Methods, NftContract } from '../src';

const GAS = new BN(300000000000000);

const keyDir = `${homedir()}/.near-credentials`;
const keyStore = new keyStores.UnencryptedFileSystemKeyStore(keyDir);

let near: Near;

const getNear = async () => {
  if (near) {
    return near;
  }

  const config = await getConfig('development', '');

  return new Near({
    deps: { keyStore },
    ...config,
  });
};

export const getAccountFor = async (prefix: string): Promise<Account> => {
  logger.start(`Recovering account for ${logger.param(prefix)}`);

  const accountId = fs.readFileSync(`neardev/${prefix}-account`).toString();

  const nearHere = await getNear();
  const account = await nearHere.account(accountId);

  logger.prog(`found ${logger.param(accountId)}`);
  logger.done();

  return account;
};

export const getUsers = async (usersPrefixes: string[]): Promise<Account[]> =>
  Promise.all(usersPrefixes.map(async (prefix: string) => getAccountFor(prefix)));

const logAmount = (value: string) => logger.warn(utils.format.formatNearAmount(value, 4));

export const getState = async (account: Account, prefix: string): Promise<AccountState & AccountBalance> => {
  const state = await account.state();
  const balance = await account.getAccountBalance();

  if (!new BN(balance.total).eq(new BN(balance.stateStaked).add(new BN(balance.available)))) {
    logger.infoln('Total neq staked+available');
  }

  const isContract = state.code_hash === '11111111111111111111111111111111' ? '\u261e' : '\u270e';
  logger.info(`${isContract}${prefix}: Ⓝ S${logAmount(balance.stateStaked)}+A${logAmount(balance.available)}`);

  return { ...state, ...balance };
};

export const getContract = async <T, S extends keyof T & string>(
  contractPrefix: string,
  wasmPath: string,
  init: { func: S; args: T[S] } | null
): Promise<Account> => {
  logger.start('Initial entry');

  const contractAccount = await getAccountFor(contractPrefix);
  const contract = await getState(contractAccount, contractPrefix);

  logger.start(`Contract ${logger.param(basename(wasmPath))}`);

  const wasmData = fs.readFileSync(wasmPath);
  const wasmHash = sha256.array(wasmData);
  const wasmBase64 = bs58.encode(Buffer.from(wasmHash));

  logger.info(`sha256/base58:${wasmBase64}`);

  if (contract.code_hash !== wasmBase64) {
    logger.info('deploying');

    await contractAccount.deployContract(wasmData);

    if (init) {
      await contractAccount.functionCall(contractAccount.accountId, init.func, init.args, GAS, new BN(0));
    }

    logger.done();

    await getState(contractAccount, contractPrefix);
  } else {
    logger.info('up to date');
    logger.done();
  }

  return contractAccount;
};

export const createProfilers = <T extends NftContract | MarketContract>(
  users: Account[],
  contractAccount: Account,
  methods: Methods
): AccountContract<T>[] => {
  return users.map((userAccount: Account) => {
    const contract = <T & Contract & { [key: string]: (args: unknown) => unknown }>(
      new Contract(userAccount, contractAccount.accountId, {
        ...methods,
      })
    );

    return {
      accountId: userAccount.accountId,
      account: userAccount,
      contract,
      contractAccount,
    };
  });
};
