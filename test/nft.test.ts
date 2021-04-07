import { addTestCollectible, generateId, isWithinLastMs, formatNsToMs, logger } from './utils';
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

  beforeEach(() => {
    logger.title(`${expect.getState().currentTestName}`);
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

    it("should make a new collectible available through it's id", () => {
      logger.data('Created collectible', collectible);

      expect(collectible).not.toBeUndefined();
    });

    it('should create collectible with provided data', async () => {
      const providedData = {
        current_supply: supply,
        royalty,
      };

      logger.data('Data provided', providedData);

      expect(collectible).toMatchObject(providedData);
    });

    it("should set token's metadata for the created collectible", async () => {
      const providedMetadata = {
        title,
        description,
        copies: supply,
      };

      logger.data('Metadata provided', providedMetadata);

      expect(collectible.metadata).toMatchObject(providedMetadata);
    });

    it("should associate a new collectible with it's creator", async () => {
      const collectiblesOfAlice = await alice.contract.get_collectibles_by_creator({ creator_id: alice.accountId });

      const newCollectibles = collectiblesOfAlice.filter(({ gate_id }) => gate_id === gateId);

      logger.data("Creator's new collectibles", newCollectibles);

      expect(newCollectibles.length).toBe(1);
    });

    it("should set a correct creator's id", async () => {
      logger.data("Creator's id of the new collectible.", collectible.creator_id);

      expect(collectible.creator_id).toBe(alice.accountId);
    });

    it('should set minted tokens for a new collectible to an empty array', async () => {
      logger.data('Minted tokens of the new collectible.', collectible.minted_tokens);

      expect(collectible.minted_tokens).toEqual([]);
    });

    describe('errors', () => {
      const invalidDigitMessage = 'invalid digit found in string';

      it('should throw an error if provided gate id already exists', async () => {
        logger.data('Attempting to create collectible with `gateId`', gateId);

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
        logger.data('Attempting to create collectible with supply', supplyNew);

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

        logger.data('Attempting to create collectible with `royalty`', {
          num,
          den,
        });

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

        logger.data('Attempting to create collectible with `royalty`', {
          num,
          den,
        });

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

      logger.data('Got collectible', collectible);

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

      logger.data('Created collectibles for account', alice.accountId);
    });

    it('should return only collectibles by specified creator', () => {
      const uniqueCreatorIds = [...new Set(collectibles.map(({ creator_id }) => creator_id))];

      logger.data("Unique creators' ids", uniqueCreatorIds);

      expect(uniqueCreatorIds).toEqual([alice.accountId]);
    });

    it('should return all collectibles by a specified creator', async () => {
      logger.data('Collectibles before', collectiblesInitial.length);
      logger.data('Collectibles added', numberOfCollectiblesToAdd);
      logger.data('Total number of collectibles', collectibles.length);

      expect(collectibles).toHaveLength(numberOfCollectiblesToAdd + collectiblesInitial.length);
      expect(
        newGateIds.every((id) => collectibles.some((collectible: Collectible) => collectible.gate_id === id))
      ).toBe(true);
    });

    it('should return empty array if no collectibles found', async () => {
      const collectiblesNonExistent = await alice.contract.get_collectibles_by_creator({
        creator_id: nonExistentUserId,
      });

      logger.data(`Collectibles of user with id ${nonExistentUserId}`, collectiblesNonExistent);

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

      logger.data("Claimed token's id", tokenId);
      logger.data('Claimed claimer', bob.accountId);
    });

    describe('token creation', () => {
      let token: Token;
      let tokensOfBob: Token[];

      beforeAll(async () => {
        tokensOfBob = await alice.contract.get_tokens_by_owner({ owner_id: bob.accountId });
        token = await alice.contract.nft_token({ token_id: tokenId });

        logger.data('Claimed token', token);
      });

      it('should create only one token for an owner', async () => {
        logger.data('Tokens before', initialTokensOfBob.length);
        logger.data('Tokens added', 1);
        logger.data('Total number of tokens after', tokensOfBob.length);

        expect(tokensOfBob.length).toBe(initialTokensOfBob.length + 1);
      });

      it('should set correct owner of the token', async () => {
        logger.data('Owner of the token', token.owner_id);

        expect(token.owner_id).toBe(bob.accountId);
      });

      it('should set correct collectible of the token', async () => {
        logger.data("Token's gate id", token.gate_id);

        expect(token.gate_id).toBe(gateId);
      });

      it("should set now as time of token's creation", async () => {
        logger.data('Token created at', new Date(formatNsToMs(token.created_at)));

        expect(isWithinLastMs(formatNsToMs(token.created_at), 1000 * 5)).toBe(true);
      });

      it("should set time of the token's modification equal to it's creation", async () => {
        logger.data('Token modified at', new Date(formatNsToMs(token.modified_at)));

        expect(formatNsToMs(token.created_at)).toBe(formatNsToMs(token.modified_at));
      });
    });

    it('should decrement current supply of the collectible', async () => {
      logger.data("Collectible's initial supply", initialSupply);

      const { current_supply } = await alice.contract.get_collectible_by_gate_id({ gate_id: gateId });

      logger.data("Collectible's current supply", current_supply);

      expect(current_supply).toBe(String(+initialSupply - 1));
    });

    it('should throw an error if no gate id found', async () => {
      const nonExistentId = '1111A2222B33';

      logger.data('Attempting to claim a token for gate id', nonExistentId);

      await expect(alice.contract.claim_token({ gate_id: nonExistentId })).rejects.toThrow('Gate id not found');
    });

    it('should throw an error if all tokens have been claimed', async () => {
      const gateIdNoSupply = await generateId();

      await addTestCollectible(alice.contract, {
        gate_id: gateIdNoSupply,
        supply: '1',
      });

      logger.data('Attempting to claim 2 tokens for gate id created with supply of', 1);

      await alice.contract.claim_token({ gate_id: gateIdNoSupply });

      await expect(alice.contract.claim_token({ gate_id: gateIdNoSupply })).rejects.toThrow(
        'All tokens for this gate id have been claimed'
      );
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
      logger.data('Tokens before', initialTokensOfAlice.length);

      await Promise.all(
        new Array(numberOfTokensToClaim).fill(0).map(() => alice.contract.claim_token({ gate_id: gateId }))
      );

      logger.data('Tokens claimed', numberOfTokensToClaim);
    });

    it('should return all tokens claimed by a specific user', async () => {
      tokensOfAlice = await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId });
      logger.data('Total number of tokens after', tokensOfAlice.length);

      expect(tokensOfAlice.length).toBe(initialTokensOfAlice.length + numberOfTokensToClaim);
    });

    it('should return only tokens of a specific owner', async () => {
      tokensOfAlice = await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId });

      const uniqueOwnerIds = [...new Set(tokensOfAlice.map(({ owner_id }) => owner_id))];

      logger.data("Unique owners' ids", uniqueOwnerIds);

      expect(uniqueOwnerIds).toEqual([alice.accountId]);
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

      logger.data('Tokens after transferring all tokens ', newTokensOfAlice);

      expect(newTokensOfAlice).toHaveLength(0);
    });
  });

  describe('get_tokens_by_owner_and_gate_id', () => {
    const numberOfTokensToClaim = 3;

    let gateId1: string;
    let gateId2: string;
    let tokensOfAliceGate1: Token[];

    beforeAll(async () => {
      gateId1 = await generateId();
      gateId2 = await generateId();

      await Promise.all([
        addTestCollectible(alice.contract, { gate_id: gateId1 }),
        addTestCollectible(alice.contract, { gate_id: gateId2 }),
      ]);

      await Promise.all([
        ...new Array(numberOfTokensToClaim).fill(0).map(() => alice.contract.claim_token({ gate_id: gateId1 })),
        ...new Array(numberOfTokensToClaim).fill(0).map(() => alice.contract.claim_token({ gate_id: gateId2 })),
      ]);

      logger.data('Tokens claimed for new collectible', numberOfTokensToClaim);

      tokensOfAliceGate1 = await alice.contract.get_tokens_by_owner_and_gate_id({
        gate_id: gateId1,
        owner_id: alice.accountId,
      });
    });

    it('should return all tokens claimed by a specific user for a specific collectible', async () => {
      logger.data('Tokens returned for a specific user for a specific collectible', tokensOfAliceGate1.length);

      expect(tokensOfAliceGate1.length).toBe(numberOfTokensToClaim);
    });

    it('should return only tokens of a specific owner', async () => {
      const uniqueOwnerIds = [...new Set(tokensOfAliceGate1.map(({ owner_id }) => owner_id))];

      logger.data("Unique owners' ids", uniqueOwnerIds);

      expect(uniqueOwnerIds).toEqual([alice.accountId]);
    });

    it('should return only tokens of a specific collectible', async () => {
      const uniqueCollectibleIds = [...new Set(tokensOfAliceGate1.map(({ gate_id }) => gate_id))];

      logger.data("Unique collectibles' ids", uniqueCollectibleIds);

      expect(uniqueCollectibleIds).toEqual([gateId1]);
    });

    it('should return an empty array if an owner has no tokens of a specific collectible', async () => {
      const gateId3 = await generateId();

      const tokensOfAliceGate3 = await alice.contract.get_tokens_by_owner_and_gate_id({
        gate_id: gateId3,
        owner_id: alice.accountId,
      });

      logger.data(`Tokens returned for the same user and a new collectible ${gateId3}`, tokensOfAliceGate3);

      expect(tokensOfAliceGate3).toEqual([]);
    });
  });

  describe('nft_metadata', () => {
    it("should return contract's metadata", async () => {
      logger.data('Contract created with metadata', contractMetadata);

      const metadata = await alice.contract.nft_metadata();
      logger.data('Metadata returned', metadata);

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
        logger.data('New owner initially had tokens', initialTokensOfAlice.length);

        initialTokensOfBob = await bob.contract.get_tokens_by_owner({ owner_id: bob.accountId });
        logger.data('Old owner initially had tokens', initialTokensOfBob.length);

        await bob.contract.nft_transfer({
          receiver_id: alice.accountId,
          token_id: bobsTokenId,
        });

        tokensOfAlice = await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId });
        tokensOfBob = await bob.contract.get_tokens_by_owner({ owner_id: bob.accountId });

        token = await bob.contract.nft_token({ token_id: bobsTokenId });

        logger.data('Token after transfer', token);
      });

      it("should associate token with it's new owner", () => {
        logger.data('New owner has tokens after transfer', tokensOfAlice.length);

        expect(token).not.toBeUndefined();
        expect(initialTokensOfAlice.length).toBe(tokensOfAlice.length - 1);
      });

      it("should disassociate token from it's previous owner", () => {
        logger.data('Old owner has tokens after transfer', tokensOfBob.length);

        expect(initialTokensOfBob.length).toBe(tokensOfBob.length + 1);

        const [transferredToken] = tokensOfBob.filter(({ token_id }) => token_id === bobsTokenId);

        expect(transferredToken).toBeUndefined();
      });

      it("should set token's new owner", async () => {
        logger.data("New owner's id", alice.accountId);
        logger.data("Owner's id on token after transfer", token.owner_id);

        expect(token.owner_id).toBe(alice.accountId);
      });

      it("should update token's modified_at property", async () => {
        logger.data('Token created at', new Date(formatNsToMs(token.created_at)));
        logger.data('Token modified at', new Date(formatNsToMs(token.modified_at)));

        expect(formatNsToMs(token.modified_at)).toBeGreaterThan(formatNsToMs(token.created_at));
      });

      it("should set token's sender", () => {
        logger.data("Token's sender", token.sender_id);

        expect(token.sender_id).toBe(bob.accountId);
      });

      it.todo('enforce_approval_id');

      it.todo('memo');
    });

    describe('errors', () => {
      let alicesTokenId: string;
      let token: Token;

      beforeAll(async () => {
        alicesTokenId = await alice.contract.claim_token({ gate_id: gateId });

        token = await alice.contract.nft_token({ token_id: alicesTokenId });
      });

      it('should throw when the sender and the receiver are one person', async () => {
        logger.data('Alice created and claimed new token', token);

        logger.data('Attempting to transfer new token from', alice.accountId);
        logger.data('Attempting to transfer new token to', alice.accountId);

        await expect(
          alice.contract.nft_transfer({
            receiver_id: alice.accountId,
            token_id: alicesTokenId,
          })
        ).rejects.toThrow('The token owner and the receiver should be different');
      });

      it("should throw when the sender doesn't own the token", async () => {
        logger.data('Attempting to transfer new token from', bob.accountId);

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
    it('should return the number of tokens minted for the contract', async () => {
      const promises = [];
      promises.push(alice.contract.nft_total_supply());

      global.nftUsers.forEach(({ contract, accountId }) => {
        promises.push(contract.get_tokens_by_owner({ owner_id: accountId }));
      });

      const [totalSupply, ...tokens] = await Promise.all(promises);

      logger.data('Total supply of tokens minted', totalSupply);

      expect(+totalSupply).toBe(tokens.flat().length);
    });
  });

  describe('nft_token', () => {
    it("should find and return a token by its' id", async () => {
      const gateId = await generateId();
      await addTestCollectible(alice.contract, {
        gate_id: gateId,
      });

      const tokenId = await bob.contract.claim_token({ gate_id: gateId });
      logger.data('Claimed token with id', tokenId);

      const tokensOfBob = await bob.contract.get_tokens_by_owner({ owner_id: bob.accountId });

      const [tokenFromAllTokens] = tokensOfBob.filter(({ token_id }) => token_id === tokenId);
      logger.data('Token found using `get_tokens_by_owner`', tokenFromAllTokens);

      const tokenById = await bob.contract.nft_token({ token_id: tokenId });
      logger.data('Token found using `nft_token`', tokenById);

      expect(tokenFromAllTokens).toEqual(tokenById);
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

      token = await bob.contract.nft_token({ token_id: tokenId });
      logger.data('Token before approval', token);

      await bob.contract.nft_approve({
        token_id: tokenId,
        account_id: merchant.contract.contractId,
        msg: JSON.stringify(message),
      });

      token = await bob.contract.nft_token({ token_id: tokenId });
      logger.data('Token after approval', token);
    });

    it('should increment approval counter', () => {
      logger.data('Token approvals counter', token.approval_counter);

      expect(token.approval_counter).toBe('1');
    });

    it("should update token's approvals", () => {
      logger.data('Token approvals', token.approvals);

      expect(token.approvals[merchant.contract.contractId]).toEqual({
        approval_id: String(Object.keys(token.approvals).length),
        min_price: message.min_price,
      });
    });

    test('that market lists the token as for sale', async () => {
      const tokensForSale = await merchant.contract.get_tokens_for_sale();

      logger.data('Tokens for sale on market contract', tokensForSale);

      expect(tokensForSale).toContain(tokenId);
    });

    describe('errors', () => {
      it("should throw an error if msg argument doesn't contain min price", async () => {
        const msg = JSON.stringify({});

        logger.data('Attempting to approve token with message', msg);

        await expect(
          alice.contract.nft_approve({
            token_id: tokenId,
            account_id: merchant.contract.contractId,
            msg,
          })
        ).rejects.toThrow(`Could not find min_price in msg`);
      });

      it('should throw an error if msg not provided', async () => {
        logger.data('Attempting to approve token without message');

        await expect(
          alice.contract.nft_approve({
            token_id: tokenId,
            account_id: merchant.contract.contractId,
          })
        ).rejects.toThrow(`The msg argument must contain the minimum price`);
      });

      it("should throw an error if approver doesn't own the token", async () => {
        logger.data('Attempting to approve token, approver', alice.accountId);
        logger.data('Attempting to approve token, owner', token.owner_id);

        await expect(
          alice.contract.nft_approve({
            token_id: token.token_id,
            account_id: merchant.contract.contractId,
            msg: JSON.stringify(message),
          })
        ).rejects.toThrow(`Account &#x60;${alice.accountId}&#x60; does not own token &#x60;${token.token_id}&#x60;`);
      });
    });
  });

  describe('nft_revoke', () => {
    let gateId: string;
    let tokenId: string;
    let token: Token;

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

      token = await bob.contract.nft_token({ token_id: tokenId });
      expect(token.approvals[merchant.contract.contractId]).not.toBeUndefined();

      logger.data('Approvals before', token.approvals);

      await bob.contract.nft_revoke({
        token_id: tokenId,
        account_id: merchant.contract.contractId,
      });

      token = await bob.contract.nft_token({ token_id: tokenId });
      expect(token.approvals[merchant.contract.contractId]).toBeUndefined();

      logger.data('Approvals after', token.approvals);
    });

    it("should throw an error if revoker doesn't own the token", async () => {
      logger.data('Attempting to revoke token, revoker', alice.accountId);
      logger.data('Attempting to revoke token, owner', token.owner_id);

      await expect(
        alice.contract.nft_revoke({
          token_id: token.token_id,
          account_id: merchant.contract.contractId,
        })
      ).rejects.toThrow(`Account &#x60;${alice.accountId}&#x60; does not own token &#x60;${token.token_id}&#x60;`);
    });

    it('should throw an error if token is not approved for market', async () => {
      const tokenId2 = await bob.contract.claim_token({ gate_id: gateId });
      const token2 = await bob.contract.nft_token({ token_id: tokenId2 });

      logger.data("Attempting to revoke token, token's approvals", token2.approvals);

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
    let token: Token;

    beforeAll(async () => {
      gateId = await generateId();
      await addTestCollectible(alice.contract, { gate_id: gateId });

      tokenId = await bob.contract.claim_token({ gate_id: gateId });
    });

    it('should remove approval for specified market', async () => {
      const approvePromises: Promise<void>[] = [];

      [merchant.contract.contractId, `${merchant2.contract.contractId}-1`].forEach((contractId) => {
        approvePromises.push(
          bob.contract.nft_approve({
            token_id: tokenId,
            account_id: contractId,
            msg: JSON.stringify({
              min_price: '6',
            }),
          })
        );
      });

      await Promise.all(approvePromises);

      token = await bob.contract.nft_token({ token_id: tokenId });
      expect(Object.keys(token.approvals).length).toBeTruthy();

      logger.data('Approvals before', token.approvals);

      await bob.contract.nft_revoke_all({ token_id: tokenId });

      token = await bob.contract.nft_token({ token_id: tokenId });
      expect(Object.keys(token.approvals)).toHaveLength(0);

      logger.data('Approvals after', token.approvals);
    });

    it("should throw an error if revoker doesn't own the token", async () => {
      logger.data('Attempting to revoke token, revoker', alice.accountId);
      logger.data('Attempting to revoke token, owner', token.owner_id);

      await expect(alice.contract.nft_revoke_all({ token_id: token.token_id })).rejects.toThrow(
        `Account &#x60;${alice.accountId}&#x60; does not own token &#x60;${token.token_id}&#x60;`
      );
    });
  });
});
