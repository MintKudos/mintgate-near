import { addTestCollectible, generateId, isWithinLastMs, formatNsToMs } from './utils';
import { contractMetadata, royalty as royaltySetting } from './initialData';

import type { AccountContract, Collectible, Token, Fraction, NftContract, MarketContract } from '../src';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      nftUsers: AccountContract<NftContract>[];
      marketUsers: AccountContract<MarketContract>[];
    }
  }
}

describe('Nft contract', () => {
  let alice: AccountContract<NftContract>;
  let bob: AccountContract<NftContract>;
  let merchant: AccountContract<MarketContract>;
  let merchant2: AccountContract<MarketContract>;
  const nonExistentUserId = 'ron-1111111111111-111111';

  beforeAll(async () => {
    [alice, bob] = global.nftUsers;

    [merchant, merchant2] = global.marketUsers;
  });

  test('that test accounts are different', async () => {
    expect(alice.accountId).not.toBe(bob.accountId);
  });

  describe('create_collectible', () => {
    let gateId: string;
    let title: string;
    let description: string;
    let supply: string;
    let gateUrl: string;
    let royalty: Fraction;

    let collectible: Collectible;

    beforeAll(async () => {
      gateId = await generateId();

      title = 'Test title';
      description = 'Test description';
      supply = '100';
      gateUrl = 'Test url';
      royalty = {
        num: 25,
        den: 100,
      };

      await addTestCollectible(alice.contract, {
        gate_id: gateId,
        title,
        description,
        supply,
        gate_url: gateUrl,
        royalty,
      });

      collectible = await alice.contract.get_collectible_by_gate_id({ gate_id: gateId });
    });

    it('should create collectible with provided data', async () => {
      expect(collectible).toMatchObject({
        current_supply: supply,
        royalty,
      });
    });

    it("should set token's metadata for the created collectible", async () => {
      expect(collectible.metadata).toMatchObject({
        title,
        description,
        copies: supply,
      });
    });

    it("should make a new collectible available through it's id", () => {
      expect(collectible).not.toBeUndefined();
    });

    it("should associate a new collectible with it's creator", async () => {
      const collectiblesOfAlice = await alice.contract.get_collectibles_by_creator({ creator_id: alice.accountId });

      const newCollectibles = collectiblesOfAlice.filter(({ gate_id }) => gate_id === gateId);

      expect(newCollectibles.length).toBe(1);
    });

    it("should set a correct creator's id", async () => {
      expect(collectible.creator_id).toBe(alice.accountId);
    });

    it('should set minted tokens for a new collectible to an empty array', async () => {
      expect(collectible.minted_tokens).toEqual([]);
    });

    describe('errors', () => {
      const invalidDigitMessage = 'invalid digit found in string';

      it('should throw an error if provided gate id already exists', async () => {
        await expect(addTestCollectible(alice.contract, { gate_id: gateId })).rejects.toThrow(
          `Gate ID &#x60;${gateId}&#x60; already exists`
        );
      });

      it.each([
        ['0', /Gate ID .+ must have a positive supply/],
        ['-10', invalidDigitMessage],
        ['1b', invalidDigitMessage],
        ['c', invalidDigitMessage],
      ])('should throw an error if supply is not a positive number, i.e. %s', async (supplyNew, message) => {
        const gateIdNew = await generateId();

        await expect(
          addTestCollectible(alice.contract, {
            gate_id: gateIdNew,
            supply: supplyNew,
          })
        ).rejects.toThrow(message);
      });

      it('should throw an error if royalty is less than minimum', async () => {
        const num = royaltySetting.min_royalty.num - 1;
        const { den } = royaltySetting.min_royalty;
        const gateIdNew = await generateId();

        await expect(
          addTestCollectible(alice.contract, {
            gate_id: gateIdNew,
            royalty: {
              num,
              den,
            },
          })
        ).rejects.toThrow(`Royalty &#x60;${num}&#x2F;${den}&#x60; of &#x60;${gateIdNew}&#x60; is less than min`);
      });

      it('should throw an error if royalty is greater than maximum', async () => {
        const num = royaltySetting.max_royalty.num + 1;
        const { den } = royaltySetting.max_royalty;
        const gateIdNew = await generateId();

        await expect(
          addTestCollectible(alice.contract, {
            gate_id: gateIdNew,
            royalty: {
              num,
              den,
            },
          })
        ).rejects.toThrow(`Royalty &#x60;${num}&#x2F;${den}&#x60; of &#x60;${gateIdNew}&#x60; is greater than max`);
      });
    });
  });

  describe('get_collectible_by_gate_id', () => {
    it('should return collectible', async () => {
      const gateId = await generateId();

      await addTestCollectible(alice.contract, { gate_id: gateId });
      const collectible = await alice.contract.get_collectible_by_gate_id({ gate_id: gateId });

      expect(collectible).toMatchObject({ gate_id: gateId });
    });

    it('should throw an error if no collectible found', async () => {
      const nonExistentId = await generateId();

      await expect(alice.contract.get_collectible_by_gate_id({ gate_id: nonExistentId })).rejects.toThrow(
        `Gate ID \`${nonExistentId}\` was not found`
      );
    });
  });

  describe('get_collectibles_by_creator', () => {
    const numberOfCollectiblesToAdd = 5;

    let newGateIds: string[];
    let collectiblesInitial: Collectible[];
    let collectibles: Collectible[];

    beforeAll(async () => {
      const gateId = await generateId();

      newGateIds = Array.from(new Array(numberOfCollectiblesToAdd), (el, i) => `${gateId}${i}`);

      collectiblesInitial = await alice.contract.get_collectibles_by_creator({ creator_id: alice.accountId });
      await Promise.all(newGateIds.map((id) => addTestCollectible(alice.contract, { gate_id: id })));
      collectibles = await alice.contract.get_collectibles_by_creator({ creator_id: alice.accountId });
    });

    it('should return only collectibles by specified creator', () => {
      expect(collectibles.every((collectible: Collectible) => collectible.creator_id === alice.accountId)).toBe(true);
    });

    it('should return all collectibles by a specified creator', async () => {
      expect(collectibles).toHaveLength(numberOfCollectiblesToAdd + collectiblesInitial.length);
      expect(
        newGateIds.every((id) => collectibles.some((collectible: Collectible) => collectible.gate_id === id))
      ).toBe(true);
    });

    it('should return empty array if no collectibles found', async () => {
      const collectiblesNonExistent = await alice.contract.get_collectibles_by_creator({
        creator_id: nonExistentUserId,
      });

      expect(collectiblesNonExistent).toEqual([]);
    });
  });

  describe('claim_token', () => {
    let gateId: string;
    const initialSupply = '1000';
    let tokenId: string;
    let initialTokensOfBob: Token[];

    beforeAll(async () => {
      gateId = await generateId();
      await addTestCollectible(alice.contract, {
        gate_id: gateId,
        supply: initialSupply,
      });

      initialTokensOfBob = await bob.contract.get_tokens_by_owner({ owner_id: bob.accountId });

      tokenId = await bob.contract.claim_token({ gate_id: gateId });
    });

    describe('token creation', () => {
      let token: Token;
      let tokensOfBob: Token[];

      beforeAll(async () => {
        tokensOfBob = await alice.contract.get_tokens_by_owner({ owner_id: bob.accountId });
        token = await alice.contract.nft_token({ token_id: tokenId });
      });

      it('should create only one token for an owner', async () => {
        expect(tokensOfBob.length).toBe(initialTokensOfBob.length + 1);
      });

      it('should set correct owner of the token', async () => {
        expect(token.owner_id).toBe(bob.accountId);
      });

      it('should set correct collectible of the token', async () => {
        expect(token.gate_id).toBe(gateId);
      });

      it("should set now as time of token's creation", async () => {
        expect(isWithinLastMs(formatNsToMs(token.created_at), 1000 * 5)).toBe(true);
      });

      it("should set time of the token's modification equal to it's creation", async () => {
        expect(formatNsToMs(token.created_at)).toBe(formatNsToMs(token.modified_at));
      });
    });

    it('should decrement current supply of the collectible', async () => {
      const { current_supply } = await alice.contract.get_collectible_by_gate_id({ gate_id: gateId });

      expect(current_supply).toBe(String(+initialSupply - 1));
    });

    it('should throw an error if no gate id found', async () => {
      const nonExistentId = 'nonExistentId';

      await expect(alice.contract.claim_token({ gate_id: nonExistentId })).rejects.toThrow('Gate id not found');
    });

    it('should throw an error if all tokens have been claimed', async () => {
      const gateIdNoSupply = await generateId();

      await addTestCollectible(alice.contract, {
        gate_id: gateIdNoSupply,
        supply: '1',
      });

      await alice.contract.claim_token({ gate_id: gateIdNoSupply });

      await expect(alice.contract.claim_token({ gate_id: gateIdNoSupply })).rejects.toThrow(
        'All tokens for this gate id have been claimed'
      );
    });
  });

  describe('nft_metadata', () => {
    it("should return contract's metadata", async () => {
      const metadata = await alice.contract.nft_metadata();

      expect(metadata).toEqual(contractMetadata);
    });
  });

  describe('nft_transfer', () => {
    let gateId: string;

    beforeAll(async () => {
      const initialSupply = '2000';

      gateId = await generateId();
      await addTestCollectible(alice.contract, {
        gate_id: gateId,
        supply: initialSupply,
      });
    });

    describe('happy path', () => {
      let bobsTokenId: string;

      let initialTokensOfBob: Token[];
      let initialTokensOfAlice: Token[];
      let tokensOfAlice: Token[];
      let tokensOfBob: Token[];

      let token: Token;

      beforeAll(async () => {
        bobsTokenId = await bob.contract.claim_token({ gate_id: gateId });

        initialTokensOfAlice = await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId });
        initialTokensOfBob = await bob.contract.get_tokens_by_owner({ owner_id: bob.accountId });

        await bob.contract.nft_transfer({
          receiver_id: alice.accountId,
          token_id: bobsTokenId,
        });

        tokensOfAlice = await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId });
        tokensOfBob = await bob.contract.get_tokens_by_owner({ owner_id: bob.accountId });
        token = await bob.contract.nft_token({ token_id: bobsTokenId });
      });

      it("should associate token with it's new owner", () => {
        expect(token).not.toBeUndefined();
        expect(initialTokensOfAlice.length).toBe(tokensOfAlice.length - 1);
      });

      it("should disassociate token from it's previous owner", () => {
        expect(initialTokensOfBob.length).toBe(tokensOfBob.length + 1);

        const [transferredToken] = tokensOfBob.filter(({ token_id }) => token_id === bobsTokenId);

        expect(transferredToken).toBeUndefined();
      });

      it("should set token's new owner", async () => {
        expect(token.owner_id).toBe(alice.accountId);
      });

      it("should update token's modified_at property", async () => {
        expect(formatNsToMs(token.modified_at)).toBeGreaterThan(formatNsToMs(token.created_at));
      });

      it("should set token's sender", () => {
        expect(token.sender_id).toBe(bob.accountId);
      });

      it.todo('enforce_approval_id');

      it.todo('memo');
    });

    describe('errors', () => {
      let alicesTokenId: string;

      beforeAll(async () => {
        alicesTokenId = await alice.contract.claim_token({ gate_id: gateId });
      });

      it('should throw when the sender and the receiver are one person', async () => {
        await expect(
          alice.contract.nft_transfer({
            receiver_id: alice.accountId,
            token_id: alicesTokenId,
          })
        ).rejects.toThrow('The token owner and the receiver should be different');
      });

      it("should throw when the sender doesn't own the token", async () => {
        await expect(
          bob.contract.nft_transfer({
            receiver_id: alice.accountId,
            token_id: alicesTokenId,
          })
        ).rejects.toThrow(`Sender &#x60;${bob.accountId}&#x60; is not authorized to make transfer`);
      });
    });
  });

  describe('nft_total_supply', () => {
    it('nft_total_supply', async () => {
      const promises = [];
      promises.push(alice.contract.nft_total_supply());

      global.nftUsers.forEach(({ contract, accountId }) => {
        promises.push(contract.get_tokens_by_owner({ owner_id: accountId }));
      });

      const [totalSupply, ...tokens] = await Promise.all(promises);

      expect(+totalSupply).toBe(tokens.flat().length);
    });
  });

  describe('nft_token', () => {
    it('nft_token', async () => {
      const gateId = await generateId();
      await addTestCollectible(alice.contract, {
        gate_id: gateId,
      });

      const tokenId = await bob.contract.claim_token({ gate_id: gateId });
      const tokensOfBob = await bob.contract.get_tokens_by_owner({ owner_id: bob.accountId });

      const [tokenFromAllTokens] = tokensOfBob.filter(({ token_id }) => token_id === tokenId);
      const tokenById = await bob.contract.nft_token({ token_id: tokenId });

      expect(tokenFromAllTokens).toEqual(tokenById);
    });
  });

  describe('get_tokens_by_owner', () => {
    const numberOfTokensToClaim = 3;

    let gateId: string;
    let initialTokensOfAlice: Token[];
    let tokensOfAlice: Token[];

    beforeAll(async () => {
      gateId = await generateId();

      await addTestCollectible(alice.contract, { gate_id: gateId });

      initialTokensOfAlice = await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId });

      await Promise.all(
        new Array(numberOfTokensToClaim).fill(0).map(() => alice.contract.claim_token({ gate_id: gateId }))
      );
    });

    it('should return all tokens claimed by a specific user', async () => {
      tokensOfAlice = await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId });

      expect(tokensOfAlice.length).toBe(initialTokensOfAlice.length + numberOfTokensToClaim);
    });

    it('should return only tokens of a specific owner', async () => {
      tokensOfAlice = await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId });

      expect(tokensOfAlice.every(({ owner_id }) => owner_id === alice.accountId)).toBe(true);
    });

    it('should return an empty array if a contract has no tokens', async () => {
      tokensOfAlice = await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId });

      await Promise.all(
        tokensOfAlice.map(({ token_id }) =>
          alice.contract.nft_transfer({
            receiver_id: bob.accountId,
            token_id,
          })
        )
      );

      const newTokensOfAlice = await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId });

      expect(newTokensOfAlice).toHaveLength(0);
    });
  });

  describe('nft_approve', () => {
    let gateId: string;
    let tokenId: string;
    let token: Token;

    const message = {
      min_price: '5',
    };

    beforeAll(async () => {
      gateId = await generateId();
      await addTestCollectible(alice.contract, { gate_id: gateId });

      tokenId = await bob.contract.claim_token({ gate_id: gateId });

      await bob.contract.nft_approve({
        token_id: tokenId,
        account_id: merchant.contract.contractId,
        msg: JSON.stringify(message),
      });

      token = await bob.contract.nft_token({ token_id: tokenId });
    });

    it('should increment approval counter', () => {
      expect(token.approval_counter).toBe('1');
    });

    it("should update token's approvals", () => {
      expect(token.approvals[merchant.contract.contractId]).toEqual({
        approval_id: String(Object.keys(token.approvals).length),
        min_price: message.min_price,
      });
    });

    test('that market lists the token as for sale', async () => {
      const tokensForSale = await merchant.contract.get_tokens_for_sale();

      expect(tokensForSale).toContain(tokenId);
    });

    describe('errors', () => {
      it("should throw an error if msg argument doesn't contain min price", async () => {
        await expect(
          alice.contract.nft_approve({
            token_id: tokenId,
            account_id: merchant.contract.contractId,
            msg: JSON.stringify({}),
          })
        ).rejects.toThrow(`Could not find min_price in msg`);
      });

      it('should throw an error if msg not provided', async () => {
        await expect(
          alice.contract.nft_approve({
            token_id: tokenId,
            account_id: merchant.contract.contractId,
          })
        ).rejects.toThrow(`The msg argument must contain the minimum price`);
      });

      it("should throw an error if msg argument doesn't contain min price", async () => {
        await expect(
          alice.contract.nft_approve({
            token_id: tokenId,
            account_id: merchant.contract.contractId,
            msg: JSON.stringify(message),
          })
        ).rejects.toThrow(`Account &#x60;${alice.accountId}&#x60; does not own token &#x60;${tokenId}&#x60;`);
      });
    });
  });

  describe('nft_revoke', () => {
    let gateId: string;
    let tokenId: string;

    beforeAll(async () => {
      gateId = await generateId();
      await addTestCollectible(alice.contract, { gate_id: gateId });

      tokenId = await bob.contract.claim_token({ gate_id: gateId });
    });

    it('should remove approval for specified market', async () => {
      await bob.contract.nft_approve({
        token_id: tokenId,
        account_id: merchant.contract.contractId,
        msg: JSON.stringify({
          min_price: '5',
        }),
      });

      let token = await bob.contract.nft_token({ token_id: tokenId });
      expect(token.approvals[merchant.contract.contractId]).not.toBeUndefined();

      await bob.contract.nft_revoke({
        token_id: tokenId,
        account_id: merchant.contract.contractId,
      });

      token = await bob.contract.nft_token({ token_id: tokenId });
      expect(token.approvals[merchant.contract.contractId]).toBeUndefined();
    });

    it("should throw an error if revoker doesn't own the token", async () => {
      await expect(
        alice.contract.nft_revoke({
          token_id: tokenId,
          account_id: merchant.contract.contractId,
        })
      ).rejects.toThrow(`Account &#x60;${alice.accountId}&#x60; does not own token &#x60;${tokenId}&#x60;`);
    });

    it('should throw an error if token is not approved for market', async () => {
      const tokenId2 = await bob.contract.claim_token({ gate_id: gateId });

      await expect(
        bob.contract.nft_revoke({
          token_id: tokenId2,
          account_id: merchant.contract.contractId,
        })
      ).rejects.toThrow(`Could not revoke approval for &#x60;${merchant.contract.contractId}&#x60;`);
    });
  });

  describe('nft_revoke_all', () => {
    let gateId: string;
    let tokenId: string;

    beforeAll(async () => {
      gateId = await generateId();
      await addTestCollectible(alice.contract, { gate_id: gateId });

      tokenId = await bob.contract.claim_token({ gate_id: gateId });
    });

    it('should remove approval for specified market', async () => {
      const approvePromises: Promise<void>[] = [];

      [merchant, merchant2].forEach((accountContract) => {
        approvePromises.push(
          bob.contract.nft_approve({
            token_id: tokenId,
            account_id: accountContract.accountId,
            msg: JSON.stringify({
              min_price: '5',
            }),
          })
        );
      });

      await Promise.all(approvePromises);

      let token = await bob.contract.nft_token({ token_id: tokenId });
      expect(Object.keys(token.approvals).length).toBeTruthy();

      await bob.contract.nft_revoke_all({ token_id: tokenId });

      token = await bob.contract.nft_token({ token_id: tokenId });
      expect(Object.keys(token.approvals)).toHaveLength(0);
    });

    it("should throw an error if revoker doesn't own the token", async () => {
      await expect(alice.contract.nft_revoke_all({ token_id: tokenId })).rejects.toThrow(
        `Account &#x60;${alice.accountId}&#x60; does not own token &#x60;${tokenId}&#x60;`
      );
    });
  });
});
