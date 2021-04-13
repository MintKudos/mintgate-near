import fs from 'fs';
import { homedir } from 'os';

import { keyStores, Near } from 'near-api-js';
import BN from 'bn.js';

import type { Account } from 'near-api-js';

import { contractMetadata } from './initialData';
import { getConfig } from './config';
import { createAccount } from './setup';

import type { ConfigLocal, ConfigNet } from '../lib';
import type { Fraction } from '../src';
import { AccountContract, MarketContract, NftContract } from '../src';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      nftUsers: AccountContract<NftContract>[];
      marketUsers: AccountContract<MarketContract>[];
    }
  }
}

const GAS = new BN(300000000000000);

const getAccountFor = async (
  prefix: string,
  config: ConfigLocal | ConfigNet,
  near: Near,
  keyStore: keyStores.UnencryptedFileSystemKeyStore
) => {
  const contractId = await createAccount(prefix, config, near, keyStore);
  return near.account(contractId);
};

const callNftInit = async (contractAccount: Account, min_royalty: Fraction, max_royalty: Fraction) => {
  const initiationArgs = {
    admin_id: 'some_nonexistent_account_id',
    metadata: contractMetadata,
  };

  return contractAccount.functionCall(
    contractAccount.accountId,
    'init',
    {
      ...initiationArgs,
      min_royalty,
      max_royalty,
    },
    GAS,
    new BN(0)
  );
};

describe('Initiation of contracts', () => {
  let mintgate: AccountContract<NftContract>;

  const keyDir = `${homedir()}/.near-credentials`;
  const keyStore = new keyStores.UnencryptedFileSystemKeyStore(keyDir);

  let config: ConfigLocal | ConfigNet;
  let near: Near;

  beforeAll(async () => {
    [, , mintgate] = global.nftUsers;

    config = await getConfig('development', '');
    near = new Near({
      deps: { keyStore },
      ...config,
    });
  });

  describe('nft contract', () => {
    let contractAccount: Account;

    beforeAll(async () => {
      const wasmData = fs.readFileSync('target/wasm32-unknown-unknown/release/mg_nft.wasm');

      contractAccount = await getAccountFor('nft-init-test', config, near, keyStore);
      await contractAccount.deployContract(wasmData);
    });

    it('should throw if max royalty is less than min royalty', async () => {
      const minNum = 10;
      const maxNum = 9;
      const den = 100;

      const min_royalty = {
        num: minNum,
        den,
      };

      const max_royalty = {
        num: maxNum,
        den,
      };

      await expect(callNftInit(contractAccount, min_royalty, max_royalty)).rejects.toThrow(
        expect.objectContaining({
          type: 'GuestPanic',
          panic_msg: `{"err":"MaxRoyaltyLessThanMinRoyalty","min_royalty":${JSON.stringify(
            min_royalty
          )},"max_royalty":${JSON.stringify(
            max_royalty
          )},"msg":"Min royalty \`${minNum}/${den}\` must be less or equal to max royalty \`${maxNum}/${den}\`"}`,
        })
      );
    });

    it('should throw if denominator of min royalty is `0`', async () => {
      const min_royalty = {
        num: 10,
        den: 0,
      };
      const max_royalty = {
        num: 15,
        den: 100,
      };

      await expect(callNftInit(contractAccount, min_royalty, max_royalty)).rejects.toThrow(
        expect.objectContaining({
          type: 'GuestPanic',
          panic_msg: `{"err":"ZeroDenominatorFraction","msg":"Denominator must be a positive number, but was 0"}`,
        })
      );
    });

    it('should throw if denominator of max royalty is `0`', async () => {
      const min_royalty = {
        num: 10,
        den: 100,
      };
      const max_royalty = {
        num: 15,
        den: 0,
      };

      await expect(callNftInit(contractAccount, min_royalty, max_royalty)).rejects.toThrow(
        expect.objectContaining({
          type: 'GuestPanic',
          panic_msg: `{"err":"ZeroDenominatorFraction","msg":"Denominator must be a positive number, but was 0"}`,
        })
      );
    });

    it('should throw if fraction of min royalty is greater than `1`', async () => {
      const min_royalty = {
        num: 101,
        den: 100,
      };
      const max_royalty = {
        num: 10,
        den: 100,
      };

      await expect(callNftInit(contractAccount, min_royalty, max_royalty)).rejects.toThrow(
        expect.objectContaining({
          type: 'GuestPanic',
          panic_msg: `{"err":"FractionGreaterThanOne","msg":"The fraction must be less or equal to 1"}`,
        })
      );
    });

    it('should throw if fraction of max royalty is greater than `1`', async () => {
      const min_royalty = {
        num: 10,
        den: 100,
      };
      const max_royalty = {
        num: 101,
        den: 100,
      };

      await expect(callNftInit(contractAccount, min_royalty, max_royalty)).rejects.toThrow(
        expect.objectContaining({
          type: 'GuestPanic',
          panic_msg: `{"err":"FractionGreaterThanOne","msg":"The fraction must be less or equal to 1"}`,
        })
      );
    });
  });

  describe('market contract', () => {
    let contractAccount: Account;

    beforeAll(async () => {
      const wasmData = fs.readFileSync('target/wasm32-unknown-unknown/release/mg_market.wasm');

      contractAccount = await getAccountFor('market-init-test', config, near, keyStore);
      await contractAccount.deployContract(wasmData);
    });

    it('should throw if denominator of market fee fraction is `0`', async () => {
      const mintgate_fee = {
        num: 10,
        den: 0,
      };

      await expect(
        contractAccount.functionCall(
          contractAccount.accountId,
          'init',
          {
            mintgate_fee,
            mintgate_account_id: mintgate.accountId,
          },
          GAS,
          new BN(0)
        )
      ).rejects.toThrow(
        expect.objectContaining({
          type: 'GuestPanic',
          panic_msg: `{"err":"ZeroDenominatorFraction","msg":"Denominator must be a positive number, but was 0"}`,
        })
      );
    });

    it('should throw if fraction of mintgate fee is greater than `1`', async () => {
      const mintgate_fee = {
        num: 10,
        den: 9,
      };

      await expect(
        contractAccount.functionCall(
          contractAccount.accountId,
          'init',
          {
            mintgate_fee,
            mintgate_account_id: mintgate.accountId,
          },
          GAS,
          new BN(0)
        )
      ).rejects.toThrow(
        expect.objectContaining({
          type: 'GuestPanic',
          panic_msg: `{"err":"FractionGreaterThanOne","msg":"The fraction must be less or equal to 1"}`,
        })
      );
    });
  });
});
