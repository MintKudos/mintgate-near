import BN from 'bn.js';
import { utils } from 'near-api-js';

import { addTestCollectible, generateId, getShare, formatNsToMs } from './utils';
import { MINTGATE_FEE } from './initialData';

import type { AccountContract, NftContract, MarketContract, Token, Fraction } from '../src';
import type { MarketApproveMsg, NftApproveMsg, TokenForSale } from '../src/mg-market';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      nftUsers: AccountContract<NftContract>[];
      marketUsers: AccountContract<MarketContract>[];
    }
  }
}

const {
  format: { parseNearAmount, formatNearAmount },
} = utils;

const GAS = new BN(300000000000000);

describe('Market contract', () => {
  let alice: AccountContract<NftContract>;
  let bob: AccountContract<NftContract>;
  let mintgate: AccountContract<NftContract>;
  let merchant: AccountContract<MarketContract>;
  let merchant2: AccountContract<MarketContract>;

  beforeAll(async () => {
    [alice, bob, mintgate] = global.nftUsers;

    [merchant, merchant2] = global.marketUsers;
  });

  describe('get_tokens_for_sale', () => {
    it('returns a list of tokens for sale', async () => {
      const numberOfTokensToAdd = 3;
      const message: NftApproveMsg = { min_price: '5' };

      const gateId = await generateId();
      await addTestCollectible(bob.contract, { gate_id: gateId });

      const newTokensIds = await Promise.all(
        new Array(numberOfTokensToAdd).fill(0).map(() =>
          (async () => {
            const tokenId = await bob.contract.claim_token({ gate_id: gateId });
            await bob.contract.nft_approve({
              token_id: tokenId,
              account_id: merchant.contract.contractId,
              msg: JSON.stringify(message),
            });

            return tokenId;
          })()
        )
      );

      const tokensForSale = await merchant.contract.get_tokens_for_sale();

      expect(tokensForSale.map(({ token_id }) => token_id)).toEqual(expect.arrayContaining(newTokensIds));
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

      expect(tokensForSale).toContainEqual(expect.objectContaining({ token_id: tokenId }));
    });
  });

  describe('buy_token', () => {
    const priceHrNear = '5';
    const priceInternalNear = parseNearAmount(priceHrNear);

    const royalty: Fraction = {
      num: 3,
      den: 10,
    };

    const mintgateShare = getShare(+priceHrNear, MINTGATE_FEE);
    const creatorShare = getShare(+priceHrNear, royalty);
    const sellerShare = +priceHrNear - mintgateShare - creatorShare;

    const message: NftApproveMsg = { min_price: priceInternalNear! };

    let gateId: string;
    let tokenId: string;

    let mintgateBalanceBefore: string;
    let mintgateBalanceAfter: string;
    let creatorBalanceBefore: string;
    let creatorBalanceAfter: string;
    let sellerBalanceBefore: string;
    let sellerBalanceAfter: string;
    let buyerBalanceBefore: string;
    let buyerBalanceAfter: string;

    let token: Token;

    beforeAll(async () => {
      gateId = await generateId();
      await addTestCollectible(bob.contract, {
        gate_id: gateId,
        royalty,
      });

      tokenId = await alice.contract.claim_token({ gate_id: gateId });
      await alice.contract.nft_approve({
        token_id: tokenId,
        account_id: merchant.contract.contractId,
        msg: JSON.stringify(message),
      });

      buyerBalanceBefore = (await merchant2.contract.account.getAccountBalance()).total;
      [
        { total: buyerBalanceBefore },
        { total: mintgateBalanceBefore },
        { total: creatorBalanceBefore },
        { total: sellerBalanceBefore },
      ] = await Promise.all([
        merchant2.contract.account.getAccountBalance(),
        mintgate.contract.account.getAccountBalance(),
        bob.contract.account.getAccountBalance(),
        alice.contract.account.getAccountBalance(),
      ]);

      await merchant2.contract.buy_token({ token_id: tokenId }, GAS, new BN(priceInternalNear!));

      [
        { total: buyerBalanceAfter },
        { total: mintgateBalanceAfter },
        { total: creatorBalanceAfter },
        { total: sellerBalanceAfter },
      ] = await Promise.all([
        merchant2.contract.account.getAccountBalance(),
        mintgate.contract.account.getAccountBalance(),
        bob.contract.account.getAccountBalance(),
        alice.contract.account.getAccountBalance(),
      ]);

      [token] = (await alice.contract.get_tokens_by_owner({ owner_id: merchant2.accountId })).filter(
        ({ token_id }) => token_id === tokenId
      );
    });

    it("should transfer mintgate's fee to its' wallet", async () => {
      const mintgateBalanceBeforeHr = formatNearAmount(mintgateBalanceBefore);
      const mintgateBalanceAfterHr = formatNearAmount(mintgateBalanceAfter);

      expect(+mintgateBalanceBeforeHr + mintgateShare).toBeCloseTo(+mintgateBalanceAfterHr, 5);
    });

    it("should transfer royalty to the creator's wallet", async () => {
      const creatorBalanceBeforeHr = formatNearAmount(creatorBalanceBefore);
      const creatorBalanceAfterHr = formatNearAmount(creatorBalanceAfter);

      expect(+creatorBalanceBeforeHr + creatorShare).toBeCloseTo(+creatorBalanceAfterHr, 5);
    });

    it("should transfer the remaining amount to the seller's wallet", async () => {
      const sellerBalanceBeforeHr = formatNearAmount(sellerBalanceBefore);
      const sellerBalanceAfterHr = formatNearAmount(sellerBalanceAfter);

      expect(+sellerBalanceBeforeHr + sellerShare).toBeCloseTo(+sellerBalanceAfterHr, 2);
    });

    it("should deduct token's price from buyer's wallet", async () => {
      const buyerBalanceBeforeHr = formatNearAmount(buyerBalanceBefore);
      const buyerBalanceAfterHr = formatNearAmount(buyerBalanceAfter);

      expect(+buyerBalanceBeforeHr - +priceHrNear).toBeCloseTo(+buyerBalanceAfterHr, 2);
    });

    describe('token transfer', () => {
      it("should associate token with it's new owner", () => {
        expect(token).not.toBeUndefined();
      });

      it("should disassociate token from it's previous owner", async () => {
        const [soldToken] = (await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId })).filter(
          ({ token_id }) => token_id === tokenId
        );

        expect(soldToken).toBeUndefined();
      });

      it("should set token's new owner", async () => {
        expect(token!.owner_id).toBe(merchant2.accountId);
      });

      it("should update token's modified_at property", async () => {
        expect(formatNsToMs(token!.modified_at)).toBeGreaterThan(formatNsToMs(token!.created_at));
      });

      it("should set token's sender", () => {
        expect(token!.sender_id).toBe(merchant2.contract.contractId);
      });
    });

    describe('delist token from the market', () => {
      let tokensForSale: TokenForSale[];
      let tokensByGateId: TokenForSale[];
      let tokensByPreviousOwnerId: TokenForSale[];
      let tokensByOwnerId: TokenForSale[];
      let tokensByCreatorId: TokenForSale[];

      beforeAll(async () => {
        [
          tokensForSale,
          tokensByGateId,
          tokensByPreviousOwnerId,
          tokensByOwnerId,
          tokensByCreatorId,
        ] = await Promise.all([
          merchant.contract.get_tokens_for_sale(),
          merchant.contract.get_tokens_by_gate_id({ gate_id: gateId }),
          merchant.contract.get_tokens_by_owner_id({ owner_id: alice.accountId }),
          merchant.contract.get_tokens_by_owner_id({ owner_id: merchant2.accountId }),
          merchant.contract.get_tokens_by_creator_id({ creator_id: bob.accountId }),
        ]);
      });

      test('all tokens', async () => {
        expect(tokensForSale).not.toContainEqual(expect.objectContaining({ token_id: token.token_id }));
      });

      test('by gate id', async () => {
        expect(tokensByGateId).not.toContainEqual(expect.objectContaining({ token_id: token.token_id }));
      });

      test('by previous owner id', async () => {
        expect(tokensByPreviousOwnerId).not.toContainEqual(expect.objectContaining({ token_id: token.token_id }));
      });

      test('by owner id', async () => {
        expect(tokensByOwnerId).not.toContainEqual(expect.objectContaining({ token_id: token.token_id }));
      });

      test('by creator id', async () => {
        expect(tokensByCreatorId).not.toContainEqual(expect.objectContaining({ token_id: token.token_id }));
      });
    });

    describe('errors', () => {
      it('should throw when the buyer and the seller are the same person', async () => {
        const tokenId2 = await alice.contract.claim_token({ gate_id: gateId });
        const approveMessage: MarketApproveMsg = {
          min_price: '5',
          gate_id: '',
          creator_id: '',
          royalty: {
            num: 2,
            den: 100,
          },
        };

        await alice.contract.nft_transfer({
          receiver_id: merchant2.accountId,
          token_id: tokenId2,
          enforce_approval_id: null,
          memo: null,
        });

        await merchant.contract.nft_on_approve({
          token_id: tokenId2,
          owner_id: merchant2.accountId,
          approval_id: '10',
          msg: JSON.stringify(approveMessage),
        });

        await expect(
          merchant2.contract.buy_token({ token_id: tokenId2 }, GAS, new BN(priceInternalNear!))
        ).rejects.toThrow(
          expect.objectContaining({
            type: 'GuestPanic',
            panic_msg: '{"err":"BuyOwnTokenNotAllowed","msg":"Buyer cannot buy own token"}',
          })
        );
      });

      it('should throw on buying not approved token', async () => {
        const tokenId3 = await alice.contract.claim_token({ gate_id: gateId });

        await expect(
          merchant2.contract.buy_token({ token_id: tokenId3 }, GAS, new BN(priceInternalNear!))
        ).rejects.toThrow(
          expect.objectContaining({
            type: 'GuestPanic',
            panic_msg: `{"err":"TokenIdNotFound","token_id":"${tokenId3}","msg":"Token ID \`U64(${tokenId3})\` was not found"}`,
          })
        );
      });

      it('should throw when not enough deposit provided', async () => {
        const tokenId4 = await alice.contract.claim_token({ gate_id: gateId });
        const notEnoughDeposit = new BN(priceInternalNear!).sub(new BN(1));

        await alice.contract.nft_approve({
          token_id: tokenId4,
          account_id: merchant.contract.contractId,
          msg: JSON.stringify(message),
        });

        await expect(merchant2.contract.buy_token({ token_id: tokenId4 }, GAS, notEnoughDeposit)).rejects.toThrow(
          expect.objectContaining({
            type: 'GuestPanic',
            panic_msg: '{"err":"NotEnoughDepositToBuyToken","msg":"Not enough deposit to cover token minimum price"}',
          })
        );
      });
    });
  });
});
