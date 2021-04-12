import { addTestCollectible, generateId } from './utils';

import type { AccountContract, NftContract, MarketContract } from '../src';
import { MarketApproveMsg, NftApproveMsg } from '../src/mg-market';

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

  describe('get_tokens_for_sale', () => {
    it('returns a list of ids of tokens for sale', async () => {
      const numberOfTokensToAdd = 3;
      const message: NftApproveMsg = { min_price: '5' };

      const initialTokensForSale = await merchant.contract.get_tokens_for_sale();

      const gateId = await generateId();
      await addTestCollectible(bob.contract, { gate_id: gateId });

      const newTokensIds = await Promise.all(
        new Array(numberOfTokensToAdd).fill(0).map(async () => {
          const tokenId = await bob.contract.claim_token({ gate_id: gateId });
          await bob.contract.nft_approve({
            token_id: tokenId,
            account_id: merchant.contract.contractId,
            msg: JSON.stringify(message),
          });

          return tokenId;
        })
      );

      const tokensForSale = await merchant.contract.get_tokens_for_sale();

      expect(tokensForSale.length).toBe(initialTokensForSale.length + numberOfTokensToAdd);
      expect(tokensForSale).toEqual(expect.arrayContaining(newTokensIds));
    });
  });

  describe('nft_on_approve', () => {
    let gateId: string;
    let tokenId: string;

    const message: MarketApproveMsg = {
      min_price: '5',
      gate_id: '',
      creator_id: '',
      royalty: { num: 2, den: 100 },
    };

    beforeAll(async () => {
      gateId = await generateId();

      message.creator_id = bob.contract.contractId;
      message.gate_id = gateId;

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
