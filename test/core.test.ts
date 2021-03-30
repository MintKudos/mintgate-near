import { initContractWithNewTestAccount } from './utils';
import type { AccountContract } from './utils';

const TEST_BENEFICIARY = 'corgis-nft.testnet'; // todo: remove corgis from here

describe('Nft contract', () => {
  let jen: AccountContract;
  let bob: AccountContract;
  let ted: AccountContract;

  beforeAll(async () => {
    [jen, bob, ted] = await Promise.all([
      initContractWithNewTestAccount(),
      initContractWithNewTestAccount(),
      initContractWithNewTestAccount(),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      jen.account.deleteAccount(TEST_BENEFICIARY),
      bob.account.deleteAccount(TEST_BENEFICIARY),
      ted.account.deleteAccount(TEST_BENEFICIARY),
    ]);
  });

  test('that test accounts are different', async () => {
    expect(jen.accountId).not.toBe(bob.accountId);
  });
});
