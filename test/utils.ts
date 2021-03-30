import path from 'path';
import { readFile } from 'fs/promises';

import { Near, KeyPair, Contract, keyStores, Account } from 'near-api-js';

import { CoreMethods } from '../lib/CoreMethods';
import { getConfig } from './config';

interface Fraction {
  num: number;
  den: number;
}

interface CoreContract extends Contract {
  init(mintgateFee: { mintgate_fee: Fraction }): void;
}

export type AccountContract = {
  contract: CoreContract;
  accountId: string;
  account: Account;
};

const { InMemoryKeyStore } = keyStores;
const MINTGATE_FEE: Fraction = {
  num: 25,
  den: 1000,
};

const generateUniqueAccountId = (prefix: string) => `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000000)}`;

export const getContractName = async (): Promise<string> => {
  const errorMessage =
    'Either specify contract name as environment variable `CONTRACT_NAME` or build and deploy contract.';

  let contractName = process.env.CONTRACT_NAME;

  if (contractName) {
    return contractName;
  }

  try {
    contractName = (await readFile(path.resolve(__dirname, '../neardev/dev-account'))).toString();
  } catch (e) {
    throw errorMessage;
  }

  if (contractName) {
    return contractName;
  }

  throw errorMessage;
};

export const initContractWithNewTestAccount = async (): Promise<AccountContract> => {
  const keyStore = new InMemoryKeyStore();
  const contractName = await getContractName();
  const config = await getConfig('development', contractName);

  const near = new Near({
    deps: { keyStore },
    ...config,
  });

  const newKeyPair = KeyPair.fromRandom('ed25519');
  const account = await near.createAccount(generateUniqueAccountId('test'), newKeyPair.getPublicKey());

  await keyStore.setKey(config.networkId, account.accountId, newKeyPair);

  const contract = <CoreContract>(new Contract(account, config.contractName, { ...CoreMethods }));
  await contract.init({ mintgate_fee: MINTGATE_FEE });

  return {
    contract,
    accountId: account.accountId,
    account,
  };
};
