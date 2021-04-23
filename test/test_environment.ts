import type { Script } from 'vm';

import NodeEnvironment from 'jest-environment-node';
import { CustomConsole } from '@jest/console';

import type { Account } from 'near-api-js';

import { getAccountFor, getContract, getUsers, createProfilers } from './deploy';
import { contractMetadata, prefixes, royalty, MINTGATE_FEE } from './initialData';
import { NftContractMethods, MarketContractMethods } from '../src';

import type { AccountContract, NftContract, MarketContract } from '../src';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      nftUsers: AccountContract<NftContract>[];
      marketUsers: AccountContract<MarketContract>[];
      nftFeeUser: Account;
      adminUser: Account;
    }
  }
}

global.console = new CustomConsole(process.stdout, process.stderr, (_type, message) => message);

export default class LocalTestEnvironment extends NodeEnvironment {
  async setup(): Promise<void> {
    await super.setup();

    const nftFeeUser = await getAccountFor(prefixes.nft.feeUser);
    const adminUser = await getAccountFor(prefixes.nft.admin);

    const nftUsers = await getUsers(prefixes.nft.users);
    const marketUsers = await getUsers(prefixes.market.users);

    // todo: use more realistic data
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

    this.global.nftFeeUser = nftFeeUser;
    this.global.adminUser = adminUser;
    this.global.nftUsers = createProfilers<NftContract>(nftUsers, nftContract, NftContractMethods);
    this.global.marketUsers = createProfilers<MarketContract>(marketUsers, marketContract, MarketContractMethods);
  }

  async teardown(): Promise<void> {
    await super.teardown();
  }

  runScript<T = unknown>(script: Script): T | null {
    return super.runScript(script);
  }
}
