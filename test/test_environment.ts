import NodeEnvironment from 'jest-environment-node';
import { CustomConsole } from '@jest/console';

import type { Script } from 'vm';

import { getConfig } from './config';
import { createProfiler } from './deploy';
import { AccountContract, Fraction, NftMethods } from '../src';

global.console = new CustomConsole(process.stdout, process.stderr, (_type, message) => message);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      users: AccountContract[],
      contractName: string,
    }
  }
}

const MINTGATE_FEE: Fraction = {
  num: 25,
  den: 1000,
};

export default class LocalTestEnvironment extends NodeEnvironment {
  async setup(): Promise<void> {
    await super.setup();

    const config = await getConfig('development', '');
    const { users } = await createProfiler(
      'nft',
      'target/wasm32-unknown-unknown/release/mg_nft.wasm',
      NftMethods,
      {
        func: 'init',
        args: { mintgate_fee: MINTGATE_FEE },
      },
      config,
      'alice',
      'bob',
    );

    this.global.users = users;

    const { contractName } = await createProfiler(
      'market',
      'target/wasm32-unknown-unknown/release/mg_market.wasm',
      NftMethods,
      {
        func: 'init',
        args: { mintgate_fee: MINTGATE_FEE },
      },
      config,
      'alice',
      'bob',
    );

    this.global.contractName = contractName;
  }

  async teardown(): Promise<void> {
    await super.teardown();
  }

  runScript<T = unknown>(script: Script): T | null {
    return super.runScript(script);
  }
}
