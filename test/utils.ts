import path from 'path';
import { readFile } from 'fs/promises';

import { Near, KeyPair, Contract, keyStores } from 'near-api-js';
import { v4 as uuidv4 } from 'uuid';

import { NftMethods } from '../lib/NftMethods';
import { getConfig } from './config';

import type { Fraction, NftContract, AccountContract } from '../src';

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

  const contract = <NftContract>(new Contract(account, config.contractName, { ...NftMethods }));
  await contract.init({ mintgate_fee: MINTGATE_FEE });

  return {
    contract,
    accountId: account.accountId,
    account,
  };
};

const collectibleDefaultData = {
  gate_url: 'Test gate url',
  title: 'Test title',
  description: 'Test description',
  supply: '100',
  royalty: {
    num: 3,
    den: 10,
  },
};

export const addTestCollectible = async (
  contract: NftContract,
  collectibleData: {
    gate_id?: string;
    gate_url?: string;
    title?: string;
    description?: string;
    supply?: string;
    royalty?: Fraction;
  } = {},
): Promise<void> => {
  let { gate_id } = collectibleData;

  if (!gate_id) {
    gate_id = uuidv4();
  }

  return contract.create_collectible({ ...collectibleDefaultData, ...collectibleData, gate_id });
};
