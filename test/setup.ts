import fs from 'fs';
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

const createAccount = async (
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

export default async (): Promise<void> => {
  logger.infoln(`Using key store from ${logger.param(keyDir)}`);

  const contractPrefixes = [prefixes.nft.contract, prefixes.market.contract];
  const allPrefixes = [...contractPrefixes, ...prefixes.nft.users, ...prefixes.market.users];

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

    if (contractPrefixes.includes(prefix)) {
      await addFunds(contractId, near, config, keyStore);
    }

    logger.done();
  }
};
