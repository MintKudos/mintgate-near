import type { Script } from 'vm';

import NodeEnvironment from 'jest-environment-node';
import { CustomConsole } from '@jest/console';

import { getConfig } from './config';
import { createProfiler } from './deploy';
import prefixes from './prefixes';
import contractMetadata from './contractMetadata';
import { NftMethods, MarketMethods } from '../src';

import type { AccountContract, Fraction, NftContract, MarketContract } from '../src';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      nftUsers: AccountContract<NftContract>[];
      marketUsers: AccountContract<MarketContract>[];
    }
  }
}

global.console = new CustomConsole(process.stdout, process.stderr, (_type, message) => message);

const MINTGATE_FEE: Fraction = {
  num: 25,
  den: 1000,
};

// todo: use more realistic data
const nftContractArguments = {
  admin_id: 'zzz-1111111111111-111111',
  metadata: contractMetadata,
};

export default class LocalTestEnvironment extends NodeEnvironment {
  async setup(): Promise<void> {
    await super.setup();

    const config = await getConfig('development', '');
    const { users: nftUsers } = await createProfiler<NftContract>(
      prefixes.nft.contract,
      'target/wasm32-unknown-unknown/release/mg_nft.wasm',
      NftMethods,
      {
        func: 'init',
        args: nftContractArguments,
      },
      config,
      ...prefixes.nft.users
    );

    this.global.nftUsers = nftUsers;

    const { users: marketUsers } = await createProfiler<MarketContract>(
      prefixes.market.contract,
      'target/wasm32-unknown-unknown/release/mg_market.wasm',
      MarketMethods,
      {
        func: 'init',
        args: { mintgate_fee: MINTGATE_FEE },
      },
      config,
      ...prefixes.market.users
    );

    this.global.marketUsers = marketUsers;
  }

  async teardown(): Promise<void> {
    await super.teardown();
  }

  runScript<T = unknown>(script: Script): T | null {
    return super.runScript(script);
  }
}
