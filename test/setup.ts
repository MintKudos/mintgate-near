import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

import { KeyPair, keyStores, Near } from 'near-api-js';

import { prefixes } from './initialData';
import { getConfig } from './config';
import { logger } from './utils';

import type { ConfigLocal, ConfigNet } from '../src';

const keyDir = `${homedir()}/.near-credentials`;

const accountExists = (prefix: string) => fs.existsSync(path.resolve(__dirname, `../neardev/${prefix}-account`));

const generateUniqueAccountId = (prefix: string) => `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000000)}`;

export const createAccount = async (
  prefix: string,
  config: ConfigLocal | ConfigNet,
  near: Near,
  keyStore: keyStores.UnencryptedFileSystemKeyStore
): Promise<string> => {
  const accountId = generateUniqueAccountId(prefix);
  const newKeyPair = KeyPair.fromRandom('ed25519');
  const account = await near.createAccount(accountId, newKeyPair.getPublicKey());

  await keyStore.setKey(config.networkId, account.accountId, newKeyPair);

  fs.writeFileSync(`neardev/${prefix}-account`, accountId);

  return accountId;
};

const addFunds = async (
  contractId: string,
  near: Near,
  config: ConfigLocal | ConfigNet,
  keyStore: keyStores.UnencryptedFileSystemKeyStore
) => {
  logger.prog('adding funds to account');

  const accountIdSponsor = generateUniqueAccountId('sponsor');
  const newKeyPairSponsor = KeyPair.fromRandom('ed25519');
  const accountSponsor = await near.createAccount(accountIdSponsor, newKeyPairSponsor.getPublicKey());

  await keyStore.setKey(config.networkId, accountSponsor.accountId, newKeyPairSponsor);

  await accountSponsor.deleteAccount(contractId);
};

const updateCollectionVariable = (postmanCollection: string, key: string, value: string): string => {
  const collectionParsed = JSON.parse(postmanCollection.toString());
  const variableObject = collectionParsed.variable.find((variable: Record<string, string>) => variable.key === key);

  if (variableObject) {
    variableObject.value = value;
  } else {
    collectionParsed.variable.push({
      key,
      value,
    });
  }

  return JSON.stringify(collectionParsed, null, '\t');
};

const getPrivateKey = async (accountId: string): Promise<string> => {
  const accountData = (await fsp.readFile(path.resolve(keyDir, 'default', `${accountId}.json`))).toString();

  return JSON.parse(accountData).private_key;
};

const updateContractInPostmanCollection = async (prefix: string, contractId: string): Promise<void> => {
  logger.prog('updating postman collection');

  const collectionFile = path.resolve(__dirname, './mintgatePostmanCollection.json');
  const postmanCollection = (await fsp.readFile(collectionFile)).toString();

  let postmanCollectionUpdated = updateCollectionVariable(postmanCollection, prefix, contractId);

  const privateKey = await getPrivateKey(contractId);
  postmanCollectionUpdated = updateCollectionVariable(postmanCollectionUpdated, `${prefix}PrivateKey`, privateKey);

  await fsp.writeFile(collectionFile, postmanCollectionUpdated);
};

export default async (): Promise<void> => {
  logger.infoln(`Using key store from ${logger.param(keyDir)}`);

  const contractPrefixes = [prefixes.nft.contract, prefixes.market.contract];
  const allPrefixes = [
    ...contractPrefixes,
    ...prefixes.nft.users,
    ...prefixes.market.users,
    prefixes.nft.feeUser,
    prefixes.nft.admin,
  ];

  const keyStore = new keyStores.UnencryptedFileSystemKeyStore(keyDir);
  const config = await getConfig('development', '');

  const near = new Near({
    deps: { keyStore },
    ...config,
  });

  // eslint-disable-next-line no-restricted-syntax
  for (const prefix of allPrefixes) {
    if (accountExists(prefix)) {
      continue;
    }

    if (!fs.existsSync('neardev')) {
      fs.mkdirSync('neardev');
    }

    logger.start(`Creating account for ${logger.param(prefix)}`);

    const contractId = await createAccount(prefix, config, near, keyStore);

    await updateContractInPostmanCollection(prefix, contractId);

    if (contractPrefixes.includes(prefix)) {
      await addFunds(contractId, near, config, keyStore);
    }

    logger.done();
  }
};
