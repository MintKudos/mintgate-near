import { addTestCollectible, generateId } from './utils';

import type { AccountContract, NftContract, MarketContract } from '../src';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      nftUsers: AccountContract<NftContract>[];
      marketUsers: AccountContract<MarketContract>[];
    }
  }
}

describe('Market contract', () => {
  let alice: AccountContract<NftContract>;
  let bob: AccountContract<NftContract>;
  let merchant: AccountContract<MarketContract>;

  beforeAll(async () => {
    [alice, bob] = global.nftUsers;

    [merchant] = global.marketUsers;
  });

  describe('nft_on_approve', () => {
    let gateId: string;
    let tokenId: string;

    const message = {
      min_price: '5',
    };

    beforeAll(async () => {
      gateId = await generateId();
      await addTestCollectible(bob.contract, { gate_id: gateId });

      tokenId = await alice.contract.claim_token({ gate_id: gateId });

      await merchant.contract.nft_on_approve({
        token_id: tokenId,
        owner_id: alice.accountId,
        approval_id: '5',
        msg: JSON.stringify(message),
      });
    });

    test('that market lists the token as for sale', async () => {
      const tokensForSale = await merchant.contract.get_tokens_for_sale();

      expect(tokensForSale).toContain(tokenId);
    });
  });
});
