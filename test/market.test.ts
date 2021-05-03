import BN from 'bn.js';
import { utils } from 'near-api-js';

import type { Account } from 'near-api-js';

import { MAX_GAS_ALLOWED, createAddTestCollectible, generateGateId, getShare, formatNsToMs, logger } from './utils';
import { MINTGATE_FEE } from './initialData';
import { Panics } from '../src/mg-market';

import type { AccountContract, NftContract, MarketContract, Token, Fraction } from '../src';
import type { MarketApproveMsg, NftApproveMsg, TokenForSale } from '../src/mg-market';

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

const {
  format: { parseNearAmount, formatNearAmount },
} = utils;

jest.retryTimes(2);

describe('Market contract', () => {
  const [alice, bob] = global.nftUsers;
  const [merchant, merchant2] = global.marketUsers;

  const mintgate = global.nftFeeUser;
  const admin = global.adminUser;

  const addTestCollectible = createAddTestCollectible(admin);

  beforeEach(() => {
    logger.title(`${expect.getState().currentTestName}`);
  });

  describe('get_tokens_for_sale', () => {
    it('returns a list of tokens for sale', async () => {
      const numberOfTokensToAdd = 3;
      const message: NftApproveMsg = { min_price: '5' };
      const newTokensIds: string[] = [];

      const gateId = await generateGateId();
      await addTestCollectible(bob, { gate_id: gateId });

      for (let i = 0; i < numberOfTokensToAdd; i += 1) {
        newTokensIds.push(await bob.contract.claim_token({ gate_id: gateId }));
      }

      await Promise.all(
        newTokensIds.map((tokenId) =>
          bob.contract.nft_approve(
            {
              token_id: tokenId,
              account_id: merchant.contract.contractId,
              msg: JSON.stringify(message),
            },
            MAX_GAS_ALLOWED
          )
        )
      );

      const tokensForSale = await merchant.contract.get_tokens_for_sale();

      expect(tokensForSale.map(({ token_id }) => token_id)).toEqual(expect.arrayContaining(newTokensIds));
    });
  });

  describe.each(['gate_id', 'owner_id', 'creator_id'])('get_tokens_by_%s', (by) => {
    const numberOfTokensToCreate = 3;

    let bys: { [key: string]: string; gate_id: string; owner_id: string; creator_id: string };
    let gateId: string;
    const newTokensIds: string[] = [];

    beforeAll(async () => {
      gateId = await generateGateId();

      await addTestCollectible(alice, { gate_id: gateId });

      for (let i = 0; i < numberOfTokensToCreate; i += 1) {
        newTokensIds.push(await bob.contract.claim_token({ gate_id: gateId }));
      }

      await Promise.all(
        newTokensIds.map((tokenId) =>
          bob.contract.nft_approve(
            {
              token_id: tokenId,
              account_id: merchant.contract.contractId,
              msg: JSON.stringify({ min_price: '5' }),
            },
            MAX_GAS_ALLOWED
          )
        )
      );

      bys = {
        gate_id: gateId,
        owner_id: bob.accountId,
        creator_id: alice.accountId,
      };
    });

    it(`returns a list of tokens for sale by ${by}`, async () => {
      const tokensForSale = <(TokenForSale & { [key: string]: string })[]>await merchant.contract.get_tokens_for_sale();
      const tokensForSaleBy = await merchant.contract[`get_tokens_by_${by}`]({ [by]: bys[by] });

      expect(tokensForSale.filter((token) => token[by] === bys[by])).toEqual(tokensForSaleBy);
    });

    it('returns an empty array if no tokens found', async () => {
      const nonExistentId = 'non_existent_id';

      expect(await merchant.contract[`get_tokens_by_${by}`]({ [by]: nonExistentId })).toEqual([]);
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
      gateId = await generateGateId();
      await addTestCollectible(bob, {
        gate_id: gateId,
        royalty,
      });

      tokenId = await alice.contract.claim_token({ gate_id: gateId });
      await alice.contract.nft_approve(
        {
          token_id: tokenId,
          account_id: merchant.contract.contractId,
          msg: JSON.stringify(message),
        },
        MAX_GAS_ALLOWED
      );
      token = (await bob.contract.nft_token({ token_id: tokenId }))!;
      expect(token.approvals).not.toEqual({});

      [
        { total: buyerBalanceBefore },
        { total: mintgateBalanceBefore },
        { total: creatorBalanceBefore },
        { total: sellerBalanceBefore },
      ] = await Promise.all([
        merchant2.account.getAccountBalance(),
        mintgate.getAccountBalance(),
        bob.account.getAccountBalance(),
        alice.account.getAccountBalance(),
      ]);

      await merchant2.contract.buy_token(
        {
          nft_contract_id: bob.contractAccount.accountId,
          token_id: tokenId,
        },
        MAX_GAS_ALLOWED,
        new BN(priceInternalNear!)
      );

      [
        { total: buyerBalanceAfter },
        { total: mintgateBalanceAfter },
        { total: creatorBalanceAfter },
        { total: sellerBalanceAfter },
      ] = await Promise.all([
        merchant2.account.getAccountBalance(),
        mintgate.getAccountBalance(),
        bob.account.getAccountBalance(),
        alice.account.getAccountBalance(),
      ]);

      [token] = (await alice.contract.get_tokens_by_owner({ owner_id: merchant2.accountId })).filter(
        ({ token_id }) => token_id === tokenId
      );
    });

    it("transfers mintgate's fee to its' wallet", async () => {
      const mintgateBalanceBeforeHr = formatNearAmount(mintgateBalanceBefore);
      const mintgateBalanceAfterHr = formatNearAmount(mintgateBalanceAfter);

      logger.data('mintgateBalanceBeforeHr', mintgateBalanceBeforeHr);
      logger.data('mintgateBalanceAfterHr', mintgateBalanceAfterHr);
      logger.data('mintgateShare', mintgateShare);
      logger.data('mintgateShareActual', +mintgateBalanceAfterHr - +mintgateBalanceBeforeHr);

      expect(+mintgateBalanceBeforeHr + mintgateShare).toBeCloseTo(+mintgateBalanceAfterHr, 5);
    });

    it("transfers royalty to the creator's wallet", async () => {
      const creatorBalanceBeforeHr = formatNearAmount(creatorBalanceBefore);
      const creatorBalanceAfterHr = formatNearAmount(creatorBalanceAfter);

      logger.data('creatorBalanceBeforeHr', creatorBalanceBeforeHr);
      logger.data('creatorBalanceAfterHr', creatorBalanceAfterHr);
      logger.data('creatorShare', creatorShare);
      logger.data('creatorShareActual', +creatorBalanceAfterHr - +creatorBalanceBeforeHr);

      expect(+creatorBalanceBeforeHr + creatorShare).toBeCloseTo(+creatorBalanceAfterHr, 2);
    });

    it("transfer seller's share to its' wallet", async () => {
      const sellerBalanceBeforeHr = formatNearAmount(sellerBalanceBefore);
      const sellerBalanceAfterHr = formatNearAmount(sellerBalanceAfter);

      logger.data('sellerBalanceBeforeHr', sellerBalanceBeforeHr);
      logger.data('sellerBalanceAfterHr', sellerBalanceAfterHr);
      logger.data('sellerShare', sellerShare);
      logger.data('sellerShareActual', +sellerBalanceAfterHr - +sellerBalanceBeforeHr);

      expect(+sellerBalanceBeforeHr + sellerShare).toBeCloseTo(+sellerBalanceAfterHr, 2);
    });

    it("deducts token's price from buyer's wallet", async () => {
      const buyerBalanceBeforeHr = formatNearAmount(buyerBalanceBefore);
      const buyerBalanceAfterHr = formatNearAmount(buyerBalanceAfter);

      logger.data('buyerBalanceBeforeHr', buyerBalanceBeforeHr);
      logger.data('buyerBalanceAfterHr', buyerBalanceAfterHr);
      logger.data('priceHrNear', priceHrNear);
      logger.data('buyerShareActual', +buyerBalanceAfterHr - +buyerBalanceBeforeHr);

      expect(+buyerBalanceBeforeHr - +priceHrNear).toBeCloseTo(+buyerBalanceAfterHr, 1);
    });

    describe('token transfer', () => {
      it("associates token with it's new owner", () => {
        expect(token).not.toBeUndefined();
      });

      it('disassociates token from its previous owner', async () => {
        const [soldToken] = (await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId })).filter(
          ({ token_id }) => token_id === tokenId
        );

        expect(soldToken).toBeUndefined();
      });

      it("sets token's new owner", async () => {
        expect(token.owner_id).toBe(merchant2.accountId);
      });

      it("updates token's `modified_at` property", async () => {
        expect(formatNsToMs(token.modified_at)).toBeGreaterThan(formatNsToMs(token.created_at));
      });

      it("clears token's approvals", () => {
        expect(token.approvals).toEqual({});
      });
    });

    describe('delists token from the market', () => {
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

    describe('creator and seller are the same person', () => {
      let gateId2: string;
      let tokenId2: string;

      let mintgateBalanceBefore2: string;
      let mintgateBalanceAfter2: string;
      let creatorBalanceBefore2: string;
      let creatorBalanceAfter2: string;
      let buyerBalanceBefore2: string;
      let buyerBalanceAfter2: string;

      beforeAll(async () => {
        gateId2 = await generateGateId();
        await addTestCollectible(bob, {
          gate_id: gateId2,
          royalty,
        });

        tokenId2 = await bob.contract.claim_token({ gate_id: gateId2 });
        await bob.contract.nft_approve(
          {
            token_id: tokenId2,
            account_id: merchant.contract.contractId,
            msg: JSON.stringify(message),
          },
          MAX_GAS_ALLOWED
        );

        buyerBalanceBefore2 = (await merchant2.account.getAccountBalance()).total;
        [
          { total: buyerBalanceBefore2 },
          { total: mintgateBalanceBefore2 },
          { total: creatorBalanceBefore2 },
        ] = await Promise.all([
          merchant2.account.getAccountBalance(),
          mintgate.getAccountBalance(),
          bob.account.getAccountBalance(),
        ]);

        await merchant2.contract.buy_token(
          {
            nft_contract_id: bob.contractAccount.accountId,
            token_id: tokenId2,
          },
          MAX_GAS_ALLOWED,
          new BN(priceInternalNear!)
        );

        [
          { total: buyerBalanceAfter2 },
          { total: mintgateBalanceAfter2 },
          { total: creatorBalanceAfter2 },
        ] = await Promise.all([
          merchant2.account.getAccountBalance(),
          mintgate.getAccountBalance(),
          bob.account.getAccountBalance(),
        ]);
      });

      it("transfers mintgate's fee to its' wallet", async () => {
        const mintgateBalanceBeforeHr = formatNearAmount(mintgateBalanceBefore2);
        const mintgateBalanceAfterHr = formatNearAmount(mintgateBalanceAfter2);

        logger.data('mintgateBalanceBeforeHr', mintgateBalanceBeforeHr);
        logger.data('mintgateBalanceAfterHr', mintgateBalanceAfterHr);
        logger.data('mintgateShare', mintgateShare);
        logger.data('mintgateShareActual', +mintgateBalanceAfterHr - +mintgateBalanceBeforeHr);

        expect(+mintgateBalanceBeforeHr + mintgateShare).toBeCloseTo(+mintgateBalanceAfterHr, 5);
      });

      it("transfers money to the seller's (=== creator's) wallet", async () => {
        const creatorBalanceBeforeHr = formatNearAmount(creatorBalanceBefore2);
        const creatorBalanceAfterHr = formatNearAmount(creatorBalanceAfter2);

        logger.data('creatorBalanceBeforeHr', creatorBalanceBeforeHr);
        logger.data('creatorBalanceAfterHr', creatorBalanceAfterHr);
        logger.data('creatorShare', creatorShare);
        logger.data('sellerShare', sellerShare);
        logger.data('creatorShareActual', +creatorBalanceAfterHr - +creatorBalanceBeforeHr);

        expect(+creatorBalanceBeforeHr + creatorShare + sellerShare).toBeCloseTo(+creatorBalanceAfterHr, 5);
      });

      it("deducts token's price from buyer's wallet", async () => {
        const buyerBalanceBeforeHr = formatNearAmount(buyerBalanceBefore2);
        const buyerBalanceAfterHr = formatNearAmount(buyerBalanceAfter2);

        logger.data('buyerBalanceBeforeHr', buyerBalanceBeforeHr);
        logger.data('buyerBalanceAfterHr', buyerBalanceAfterHr);
        logger.data('priceHrNear', priceHrNear);
        logger.data('buyerShareActual', +buyerBalanceAfterHr - +buyerBalanceBeforeHr);

        expect(+buyerBalanceBeforeHr - +priceHrNear).toBeCloseTo(+buyerBalanceAfterHr, 1);
      });
    });

    describe('other combinations of creator, seller, buyer, market', () => {
      test('creator and buyer are the same contract', async () => {
        const creator = alice;
        const seller = bob;
        const buyer = alice;

        const gateId2 = await generateGateId();

        await addTestCollectible(creator, {
          gate_id: gateId2,
          royalty,
        });

        const tokenId2 = await seller.contract.claim_token({ gate_id: gateId2 });

        await seller.contract.nft_approve(
          {
            token_id: tokenId2,
            account_id: merchant.contract.contractId,
            msg: JSON.stringify(message),
          },
          MAX_GAS_ALLOWED
        );

        const [
          { total: sellerBalanceBefore2 },
          { total: mintgateBalanceBefore2 },
          { total: creatorBalanceBefore2 },
        ] = await Promise.all([
          seller.account.getAccountBalance(),
          mintgate.getAccountBalance(),
          creator.account.getAccountBalance(),
        ]);

        await buyer.account.functionCall(
          merchant2.contractAccount.accountId,
          'buy_token',
          {
            token_id: tokenId2,
            nft_contract_id: bob.contractAccount.accountId,
          },
          MAX_GAS_ALLOWED,
          new BN(priceInternalNear!)
        );

        const [
          { total: sellerBalanceAfter2 },
          { total: mintgateBalanceAfter2 },
          { total: creatorBalanceAfter2 },
        ] = await Promise.all([
          seller.account.getAccountBalance(),
          mintgate.getAccountBalance(),
          creator.account.getAccountBalance(),
        ]);

        const mintgateBalanceBeforeHr = formatNearAmount(mintgateBalanceBefore2);
        const mintgateBalanceAfterHr = formatNearAmount(mintgateBalanceAfter2);
        expect(+mintgateBalanceBeforeHr + mintgateShare).toBeCloseTo(+mintgateBalanceAfterHr, 1);

        const creatorBalanceBeforeHr = formatNearAmount(creatorBalanceBefore2);
        const creatorBalanceAfterHr = formatNearAmount(creatorBalanceAfter2);
        expect(+creatorBalanceBeforeHr + creatorShare - +priceHrNear).toBeCloseTo(+creatorBalanceAfterHr, 1);

        const sellerBalanceBeforeHr = formatNearAmount(sellerBalanceBefore2);
        const sellerBalanceAfterHr = formatNearAmount(sellerBalanceAfter2);
        expect(+sellerBalanceBeforeHr + +priceHrNear - mintgateShare - creatorShare).toBeCloseTo(
          +sellerBalanceAfterHr,
          1
        );
      });

      test('creator and market are the same contract', async () => {
        const creator = merchant.contractAccount;
        const seller = alice;
        const buyer = merchant2;

        const gateId2 = await generateGateId();

        await admin.functionCall(bob.contractAccount.accountId, 'create_collectible', {
          creator_id: creator.accountId,
          gate_id: gateId2,
          gate_url: 'Test gate url',
          title: 'Test title',
          description: 'Test description',
          supply: 100,
          royalty,
        });

        const tokenId2 = await seller.contract.claim_token({ gate_id: gateId2 });

        await seller.contract.nft_approve(
          {
            token_id: tokenId2,
            account_id: creator.accountId,
            msg: JSON.stringify(message),
          },
          MAX_GAS_ALLOWED
        );

        const [
          { total: buyerBalanceBefore2 },
          { total: mintgateBalanceBefore2 },
          { total: sellerBalanceBefore2 },
          { total: creatorBalanceBefore2 },
        ] = await Promise.all([
          buyer.account.getAccountBalance(),
          mintgate.getAccountBalance(),
          seller.account.getAccountBalance(),
          creator.getAccountBalance(),
        ]);

        await buyer.contract.buy_token(
          {
            nft_contract_id: bob.contractAccount.accountId,
            token_id: tokenId2,
          },
          MAX_GAS_ALLOWED,
          new BN(priceInternalNear!)
        );

        const [
          { total: buyerBalanceAfter2 },
          { total: mintgateBalanceAfter2 },
          { total: sellerBalanceAfter2 },
          { total: creatorBalanceAfter2 },
        ] = await Promise.all([
          buyer.account.getAccountBalance(),
          mintgate.getAccountBalance(),
          seller.account.getAccountBalance(),
          creator.getAccountBalance(),
        ]);

        const mintgateBalanceBeforeHr = formatNearAmount(mintgateBalanceBefore2);
        const mintgateBalanceAfterHr = formatNearAmount(mintgateBalanceAfter2);
        expect(+mintgateBalanceBeforeHr + mintgateShare).toBeCloseTo(+mintgateBalanceAfterHr, 1);

        const creatorBalanceBeforeHr = formatNearAmount(creatorBalanceBefore2);
        const creatorBalanceAfterHr = formatNearAmount(creatorBalanceAfter2);
        expect(+creatorBalanceBeforeHr + creatorShare).toBeCloseTo(+creatorBalanceAfterHr, 1);

        const buyerBalanceBeforeHr = formatNearAmount(buyerBalanceBefore2);
        const buyerBalanceAfterHr = formatNearAmount(buyerBalanceAfter2);
        expect(+buyerBalanceBeforeHr - +priceHrNear).toBeCloseTo(+buyerBalanceAfterHr, 1);

        const sellerBalanceBeforeHr = formatNearAmount(sellerBalanceBefore2);
        const sellerBalanceAfterHr = formatNearAmount(sellerBalanceAfter2);
        expect(+sellerBalanceBeforeHr + +priceHrNear - +creatorShare - +mintgateShare).toBeCloseTo(
          +sellerBalanceAfterHr,
          1
        );
      });

      test('seller and market are the same contract', async () => {
        const creator = bob;
        const seller = merchant.contractAccount;
        const buyer = merchant2;

        const gateId2 = await generateGateId();

        await addTestCollectible(creator, {
          gate_id: gateId2,
          royalty,
        });

        const executionOutcome = await seller.functionCall(bob.contractAccount.accountId, 'claim_token', {
          gate_id: gateId2,
        });

        if (
          !(typeof executionOutcome.status === 'object' && typeof executionOutcome.status.SuccessValue === 'string')
        ) {
          throw new Error('SuccessValue expected');
        }

        const tokenId2 = JSON.parse(Buffer.from(executionOutcome.status.SuccessValue, 'base64').toString());

        await merchant.contractAccount.functionCall(
          bob.contractAccount.accountId,
          'nft_approve',
          {
            token_id: tokenId2,
            account_id: seller.accountId,
            msg: JSON.stringify(message),
          },
          MAX_GAS_ALLOWED
        );

        const [
          { total: buyerBalanceBefore2 },
          { total: mintgateBalanceBefore2 },
          { total: sellerBalanceBefore2 },
          { total: creatorBalanceBefore2 },
        ] = await Promise.all([
          buyer.account.getAccountBalance(),
          mintgate.getAccountBalance(),
          seller.getAccountBalance(),
          creator.account.getAccountBalance(),
        ]);

        await buyer.contract.buy_token(
          {
            nft_contract_id: bob.contractAccount.accountId,
            token_id: tokenId2,
          },
          MAX_GAS_ALLOWED,
          new BN(priceInternalNear!)
        );

        const [
          { total: buyerBalanceAfter2 },
          { total: mintgateBalanceAfter2 },
          { total: sellerBalanceAfter2 },
          { total: creatorBalanceAfter2 },
        ] = await Promise.all([
          buyer.account.getAccountBalance(),
          mintgate.getAccountBalance(),
          seller.getAccountBalance(),
          creator.account.getAccountBalance(),
        ]);

        const mintgateBalanceBeforeHr = formatNearAmount(mintgateBalanceBefore2);
        const mintgateBalanceAfterHr = formatNearAmount(mintgateBalanceAfter2);
        expect(+mintgateBalanceBeforeHr + mintgateShare).toBeCloseTo(+mintgateBalanceAfterHr, 1);

        const creatorBalanceBeforeHr = formatNearAmount(creatorBalanceBefore2);
        const creatorBalanceAfterHr = formatNearAmount(creatorBalanceAfter2);
        expect(+creatorBalanceBeforeHr + creatorShare).toBeCloseTo(+creatorBalanceAfterHr, 1);

        const buyerBalanceBeforeHr = formatNearAmount(buyerBalanceBefore2);
        const buyerBalanceAfterHr = formatNearAmount(buyerBalanceAfter2);
        expect(+buyerBalanceBeforeHr - +priceHrNear).toBeCloseTo(+buyerBalanceAfterHr, 1);

        const sellerBalanceBeforeHr = formatNearAmount(sellerBalanceBefore2);
        const sellerBalanceAfterHr = formatNearAmount(sellerBalanceAfter2);
        expect(+sellerBalanceBeforeHr + +priceHrNear - +creatorShare - +mintgateShare).toBeCloseTo(
          +sellerBalanceAfterHr,
          1
        );
      });

      test('buyer and market are the same contract', async () => {
        const creator = bob;
        const seller = alice;
        const buyer = merchant.contractAccount;

        const gateId2 = await generateGateId();

        await addTestCollectible(creator, {
          gate_id: gateId2,
          royalty,
        });

        const tokenId2 = await alice.contract.claim_token({ gate_id: gateId2 });
        await alice.contract.nft_approve(
          {
            token_id: tokenId2,
            account_id: buyer.accountId,
            msg: JSON.stringify(message),
          },
          MAX_GAS_ALLOWED
        );

        const [
          { total: buyerBalanceBefore2 },
          { total: mintgateBalanceBefore2 },
          { total: sellerBalanceBefore2 },
          { total: creatorBalanceBefore2 },
        ] = await Promise.all([
          buyer.getAccountBalance(),
          mintgate.getAccountBalance(),
          seller.account.getAccountBalance(),
          creator.account.getAccountBalance(),
        ]);

        await buyer.functionCall(
          merchant2.contractAccount.accountId,
          'buy_token',
          {
            token_id: tokenId2,
            nft_contract_id: bob.contractAccount.accountId,
          },
          MAX_GAS_ALLOWED,
          new BN(priceInternalNear!)
        );

        const [
          { total: buyerBalanceAfter2 },
          { total: mintgateBalanceAfter2 },
          { total: sellerBalanceAfter2 },
          { total: creatorBalanceAfter2 },
        ] = await Promise.all([
          buyer.getAccountBalance(),
          mintgate.getAccountBalance(),
          seller.account.getAccountBalance(),
          creator.account.getAccountBalance(),
        ]);

        const mintgateBalanceBeforeHr = formatNearAmount(mintgateBalanceBefore2);
        const mintgateBalanceAfterHr = formatNearAmount(mintgateBalanceAfter2);
        expect(+mintgateBalanceBeforeHr + mintgateShare).toBeCloseTo(+mintgateBalanceAfterHr, 1);

        const creatorBalanceBeforeHr = formatNearAmount(creatorBalanceBefore2);
        const creatorBalanceAfterHr = formatNearAmount(creatorBalanceAfter2);
        expect(+creatorBalanceBeforeHr + creatorShare).toBeCloseTo(+creatorBalanceAfterHr, 1);

        const buyerBalanceBeforeHr = formatNearAmount(buyerBalanceBefore2);
        const buyerBalanceAfterHr = formatNearAmount(buyerBalanceAfter2);
        expect(+buyerBalanceBeforeHr - +priceHrNear).toBeCloseTo(+buyerBalanceAfterHr, 1);

        const sellerBalanceBeforeHr = formatNearAmount(sellerBalanceBefore2);
        const sellerBalanceAfterHr = formatNearAmount(sellerBalanceAfter2);
        expect(+sellerBalanceBeforeHr + +priceHrNear - +creatorShare - +mintgateShare).toBeCloseTo(
          +sellerBalanceAfterHr,
          1
        );
      });
    });

    describe('deposit exceeds `min_price`', () => {
      const priceHrNearSmall = '4';
      const priceInternalNearSmall = parseNearAmount(priceHrNearSmall);
      const depositNearLarge = '10';
      const depositInternalNearLarge = parseNearAmount(depositNearLarge);

      const mintgateShare2 = getShare(+depositNearLarge, MINTGATE_FEE);
      const creatorShare2 = getShare(+depositNearLarge, royalty);
      const sellerShare2 = +depositNearLarge - mintgateShare2 - creatorShare2;

      beforeAll(async () => {
        const tokenId2 = await alice.contract.claim_token({ gate_id: gateId });
        await alice.contract.nft_approve(
          {
            token_id: tokenId2,
            account_id: merchant.contract.contractId,
            msg: JSON.stringify({ min_price: priceInternalNearSmall! }),
          },
          MAX_GAS_ALLOWED
        );

        [
          { total: buyerBalanceBefore },
          { total: mintgateBalanceBefore },
          { total: creatorBalanceBefore },
          { total: sellerBalanceBefore },
        ] = await Promise.all([
          merchant2.account.getAccountBalance(),
          mintgate.getAccountBalance(),
          bob.account.getAccountBalance(),
          alice.account.getAccountBalance(),
        ]);

        await merchant2.contract.buy_token(
          {
            nft_contract_id: bob.contractAccount.accountId,
            token_id: tokenId2,
          },
          MAX_GAS_ALLOWED,
          new BN(depositInternalNearLarge!)
        );

        [
          { total: buyerBalanceAfter },
          { total: mintgateBalanceAfter },
          { total: creatorBalanceAfter },
          { total: sellerBalanceAfter },
        ] = await Promise.all([
          merchant2.account.getAccountBalance(),
          mintgate.getAccountBalance(),
          bob.account.getAccountBalance(),
          alice.account.getAccountBalance(),
        ]);
      });

      it("transfers mintgate's fee to its' wallet", async () => {
        const mintgateBalanceBeforeHr = formatNearAmount(mintgateBalanceBefore);
        const mintgateBalanceAfterHr = formatNearAmount(mintgateBalanceAfter);

        logger.data('mintgateBalanceBeforeHr', mintgateBalanceBeforeHr);
        logger.data('mintgateBalanceAfterHr', mintgateBalanceAfterHr);
        logger.data('mintgateShare', mintgateShare2);
        logger.data('mintgateShareActual', +mintgateBalanceAfterHr - +mintgateBalanceBeforeHr);

        expect(+mintgateBalanceBeforeHr + mintgateShare2).toBeCloseTo(+mintgateBalanceAfterHr, 5);
      });

      it("transfers royalty to the creator's wallet", async () => {
        const creatorBalanceBeforeHr = formatNearAmount(creatorBalanceBefore);
        const creatorBalanceAfterHr = formatNearAmount(creatorBalanceAfter);

        logger.data('creatorBalanceBeforeHr', creatorBalanceBeforeHr);
        logger.data('creatorBalanceAfterHr', creatorBalanceAfterHr);
        logger.data('creatorShare', creatorShare2);
        logger.data('creatorShareActual', +creatorBalanceAfterHr - +creatorBalanceBeforeHr);

        expect(+creatorBalanceBeforeHr + creatorShare2).toBeCloseTo(+creatorBalanceAfterHr, 2);
      });

      it("transfers seller's share to its' wallet", async () => {
        const sellerBalanceBeforeHr = formatNearAmount(sellerBalanceBefore);
        const sellerBalanceAfterHr = formatNearAmount(sellerBalanceAfter);

        logger.data('sellerBalanceBeforeHr', sellerBalanceBeforeHr);
        logger.data('sellerBalanceAfterHr', sellerBalanceAfterHr);
        logger.data('sellerShare', sellerShare2);
        logger.data('sellerShareActual', +sellerBalanceAfterHr - +sellerBalanceBeforeHr);

        expect(+sellerBalanceBeforeHr + sellerShare2).toBeCloseTo(+sellerBalanceAfterHr, 2);
      });

      it("deducts deposit from buyer's wallet", async () => {
        const buyerBalanceBeforeHr = formatNearAmount(buyerBalanceBefore);
        const buyerBalanceAfterHr = formatNearAmount(buyerBalanceAfter);

        logger.data('buyerBalanceBeforeHr', buyerBalanceBeforeHr);
        logger.data('buyerBalanceAfterHr', buyerBalanceAfterHr);
        logger.data('priceHrNear', priceHrNearSmall);
        logger.data('depositNearLarge', depositNearLarge);
        logger.data('buyerShareActual', +buyerBalanceAfterHr - +buyerBalanceBeforeHr);

        expect(+buyerBalanceBeforeHr - +depositNearLarge).toBeCloseTo(+buyerBalanceAfterHr, 1);
      });
    });

    describe('errors', () => {
      it('throws if buyer and seller are the same person', async () => {
        const tokenId2 = await alice.contract.claim_token({ gate_id: gateId });
        const approveMessage: MarketApproveMsg = {
          min_price: '5',
          gate_id: '',
          creator_id: '',
        };

        await alice.contract.nft_approve(
          {
            token_id: tokenId2,
            account_id: merchant.contract.contractId,
            msg: JSON.stringify(approveMessage),
          },
          MAX_GAS_ALLOWED
        );

        await expect(
          alice.account.functionCall(
            merchant.contract.contractId,
            'buy_token',
            {
              nft_contract_id: bob.contractAccount.accountId,
              token_id: tokenId2,
            },
            MAX_GAS_ALLOWED,
            new BN(priceInternalNear!)
          )
        ).rejects.toThrow(
          expect.objectContaining({
            type: 'GuestPanic',
            panic_msg: JSON.stringify({
              err: Panics[Panics.BuyOwnTokenNotAllowed],
              msg: 'Buyer cannot buy own token',
            }),
          })
        );
      });

      it('throws on buying not approved token', async () => {
        const tokenId3 = await alice.contract.claim_token({ gate_id: gateId });

        await expect(
          merchant2.contract.buy_token(
            {
              nft_contract_id: bob.contractAccount.accountId,
              token_id: tokenId3,
            },
            MAX_GAS_ALLOWED,
            new BN(priceInternalNear!)
          )
        ).rejects.toThrow(
          expect.objectContaining({
            type: 'GuestPanic',
            panic_msg: JSON.stringify({
              err: Panics[Panics.TokenKeyNotFound],
              token_key: [bob.contractAccount.accountId, tokenId3],
              msg: `Token Key \`${bob.contractAccount.accountId}:U64(${tokenId3})\` was not found`,
            }),
          })
        );
      });

      it('throws if not enough deposit provided', async () => {
        const tokenId4 = await alice.contract.claim_token({ gate_id: gateId });
        const notEnoughDeposit = new BN(priceInternalNear!).sub(new BN(1));

        await alice.contract.nft_approve(
          {
            token_id: tokenId4,
            account_id: merchant.contract.contractId,
            msg: JSON.stringify(message),
          },
          MAX_GAS_ALLOWED
        );

        await expect(
          merchant2.contract.buy_token(
            {
              nft_contract_id: bob.contractAccount.accountId,
              token_id: tokenId4,
            },
            MAX_GAS_ALLOWED,
            notEnoughDeposit
          )
        ).rejects.toThrow(
          expect.objectContaining({
            type: 'GuestPanic',
            panic_msg: JSON.stringify({
              err: Panics[Panics.NotEnoughDepositToBuyToken],
              msg: 'Not enough deposit to cover token minimum price',
            }),
          })
        );
      });
    });
  });

  describe('nft_on_approve', () => {
    const minPrice = '10';
    const approvalId = '5';

    let gateId: string;
    let tokenId: string;

    let tokensForSale: TokenForSale[];
    let tokensByGateId: TokenForSale[];
    let tokensByOwnerId: TokenForSale[];
    let tokensByCreatorId: TokenForSale[];

    beforeAll(async () => {
      gateId = await generateGateId();
      const message: MarketApproveMsg = {
        min_price: minPrice,
        gate_id: gateId,
        creator_id: bob.accountId,
      };

      await addTestCollectible(bob, { gate_id: gateId });

      tokenId = await alice.contract.claim_token({ gate_id: gateId });

      await alice.contractAccount.functionCall(merchant.contract.contractId, 'nft_on_approve', {
        token_id: tokenId,
        owner_id: alice.accountId,
        approval_id: approvalId,
        msg: JSON.stringify(message),
      });

      [tokensForSale, tokensByGateId, tokensByOwnerId, tokensByCreatorId] = await Promise.all([
        merchant.contract.get_tokens_for_sale(),
        merchant.contract.get_tokens_by_gate_id({ gate_id: gateId }),
        merchant.contract.get_tokens_by_owner_id({ owner_id: alice.accountId }),
        merchant.contract.get_tokens_by_creator_id({ creator_id: bob.accountId }),
      ]);
    });

    test('that market lists token as for sale', async () => {
      expect(tokensForSale).toContainEqual(expect.objectContaining({ token_id: tokenId }));
    });

    test('that market lists token as for sale by gate id', async () => {
      expect(tokensByGateId).toContainEqual(expect.objectContaining({ token_id: tokenId }));
    });

    test('that market lists token as for sale by owner id', async () => {
      expect(tokensByOwnerId).toContainEqual(expect.objectContaining({ token_id: tokenId }));
    });

    test('that market lists token as for sale by creator id', async () => {
      expect(tokensByCreatorId).toContainEqual(expect.objectContaining({ token_id: tokenId }));
    });

    test('that token for sale gets correct data', async () => {
      const token = tokensForSale[tokensForSale.length - 1];

      expect(token).toEqual(
        expect.objectContaining({
          nft_contract_id: bob.contractAccount.accountId,
          owner_id: alice.accountId,
          approval_id: approvalId,
          min_price: minPrice,
          gate_id: gateId,
          creator_id: bob.accountId,
        })
      );
    });
  });

  describe('nft_on_revoke', () => {
    let tokensForSale: TokenForSale[];
    let tokensByGateId: TokenForSale[];
    let tokensByPreviousOwnerId: TokenForSale[];
    let tokensByOwnerId: TokenForSale[];
    let tokensByCreatorId: TokenForSale[];

    let gateId: string;
    let tokenId: string;

    beforeAll(async () => {
      gateId = await generateGateId();
      await addTestCollectible(bob, {
        gate_id: gateId,
      });

      tokenId = await alice.contract.claim_token({ gate_id: gateId });
      await alice.contract.nft_approve(
        {
          token_id: tokenId,
          account_id: merchant.contract.contractId,
          msg: JSON.stringify({ min_price: '5' }),
        },
        MAX_GAS_ALLOWED
      );

      await alice.contractAccount.functionCall(merchant.contract.contractId, 'nft_on_revoke', { token_id: tokenId });

      [tokensForSale, tokensByGateId, tokensByPreviousOwnerId, tokensByOwnerId, tokensByCreatorId] = await Promise.all([
        merchant.contract.get_tokens_for_sale(),
        merchant.contract.get_tokens_by_gate_id({ gate_id: gateId }),
        merchant.contract.get_tokens_by_owner_id({ owner_id: alice.accountId }),
        merchant.contract.get_tokens_by_owner_id({ owner_id: merchant2.accountId }),
        merchant.contract.get_tokens_by_creator_id({ creator_id: bob.accountId }),
      ]);
    });

    test('all tokens', async () => {
      expect(tokensForSale).not.toContainEqual(expect.objectContaining({ token_id: tokenId }));
    });

    test('by gate id', async () => {
      expect(tokensByGateId).not.toContainEqual(expect.objectContaining({ token_id: tokenId }));
    });

    test('by previous owner id', async () => {
      expect(tokensByPreviousOwnerId).not.toContainEqual(expect.objectContaining({ token_id: tokenId }));
    });

    test('by owner id', async () => {
      expect(tokensByOwnerId).not.toContainEqual(expect.objectContaining({ token_id: tokenId }));
    });

    test('by creator id', async () => {
      expect(tokensByCreatorId).not.toContainEqual(expect.objectContaining({ token_id: tokenId }));
    });

    describe('errors', () => {
      it('throws when revoking not approved token', async () => {
        const tokenId2 = await alice.contract.claim_token({ gate_id: gateId });

        await expect(
          alice.contractAccount.functionCall(merchant.contract.contractId, 'nft_on_revoke', { token_id: tokenId2 })
        ).rejects.toThrow(
          expect.objectContaining({
            type: 'GuestPanic',
            panic_msg: JSON.stringify({
              err: Panics[Panics.TokenKeyNotFound],
              token_key: [bob.contractAccount.accountId, tokenId2],
              msg: `Token Key \`${bob.contractAccount.accountId}:U64(${tokenId2})\` was not found`,
            }),
          })
        );
      });
    });
  });

  describe('batch_on_approve', () => {
    const minPrice = '5';

    let tokensIds: string[];
    let gateId: string;

    let tokensForSale: TokenForSale[];
    let tokensByGateId: TokenForSale[];
    let tokensByOwnerId: TokenForSale[];
    let tokensByCreatorId: TokenForSale[];

    beforeAll(async () => {
      const numberOfTokensToAdd = 5;

      gateId = await generateGateId();
      const message: MarketApproveMsg = {
        min_price: minPrice,
        gate_id: gateId,
        creator_id: alice.accountId,
      };

      await addTestCollectible(bob, { gate_id: gateId });

      tokensIds = await Promise.all(
        Array.from({ length: numberOfTokensToAdd }, () => bob.contract.claim_token({ gate_id: gateId }))
      );

      await alice.contractAccount.functionCall(
        merchant.contract.contractId,
        'batch_on_approve',
        {
          tokens: tokensIds.map((tokenId) => [tokenId, message]),
          owner_id: bob.accountId,
        },
        MAX_GAS_ALLOWED
      );

      [tokensForSale, tokensByGateId, tokensByOwnerId, tokensByCreatorId] = await Promise.all([
        merchant.contract.get_tokens_for_sale(),
        merchant.contract.get_tokens_by_gate_id({ gate_id: gateId }),
        merchant.contract.get_tokens_by_owner_id({ owner_id: bob.accountId }),
        merchant.contract.get_tokens_by_creator_id({ creator_id: alice.accountId }),
      ]);
    });

    test('that market lists tokens as for sale', async () => {
      expect(tokensForSale.map(({ token_id }) => token_id)).toEqual(expect.arrayContaining(tokensIds));
    });

    test('that market lists tokens as for sale by gate id', async () => {
      expect(tokensByGateId.map(({ token_id }) => token_id)).toEqual(expect.arrayContaining(tokensIds));
    });

    test('that market lists tokens as for sale by creator id', async () => {
      expect(tokensByCreatorId.map(({ token_id }) => token_id)).toEqual(expect.arrayContaining(tokensIds));
    });

    test('that market lists tokens as for sale by owner id', async () => {
      expect(tokensByOwnerId.map(({ token_id }) => token_id)).toEqual(expect.arrayContaining(tokensIds));
    });

    test('that token for sale gets correct data', async () => {
      const token = tokensForSale[tokensForSale.length - 1];

      expect(token).toEqual(
        expect.objectContaining({
          nft_contract_id: bob.contractAccount.accountId,
          owner_id: bob.accountId,
          approval_id: '0',
          min_price: minPrice,
          gate_id: gateId,
          creator_id: alice.accountId,
        })
      );
    });
  });
});
