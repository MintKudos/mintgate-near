import { addTestCollectible, generateId, isWithinLastMs, formatNsToMs } from './utils';

import type { AccountContract, Collectible, Token, Fraction } from '../src';

describe('Nft contract', () => {
  let alice: AccountContract;
  let bob: AccountContract;
  const nonExistentUserId = 'ron-1111111111111-111111';

  let marketAccount: string;

  beforeAll(async () => {
    [alice, bob] = global.users;

    marketAccount = global.contractName;
  });

  test('that test accounts are different', async () => {
    expect(alice.accountId).not.toBe(bob.accountId);
  });

  test('approve -- to refactor', async () => {
    await alice.contract.approve({ token_id: 0, account_id: marketAccount });
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
        num: 5,
        den: 10,
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
        gate_id: gateId,
        title,
        description,
        current_supply: Number(supply),
        gate_url: gateUrl,
        royalty,
      });
    });

    it('should make a new collectible available through it\'s id', () => {
      expect(collectible).not.toBeUndefined();
    });

    it('should associate a new collectible with it\'s creator', async () => {
      const collectiblesOfAlice = await alice.contract.get_collectibles_by_creator({ creator_id: alice.accountId });

      const newCollectibles = collectiblesOfAlice.filter(({ gate_id }) => gate_id === gateId);

      expect(newCollectibles.length).toBe(1);
    });

    it('should set a correct creator\'s id', async () => {
      expect(collectible.creator_id).toBe(alice.accountId);
    });

    it('should set minted tokens for a new collectible to an empty array', async () => {
      expect(collectible.minted_tokens).toEqual([]);
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
      const nonExistentId = 'nonExistentId';

      await expect(alice.contract.get_collectible_by_gate_id({ gate_id: nonExistentId })).rejects.toThrow(
        'Given gate_id was not found',
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
        newGateIds.every((id) => collectibles.some((collectible: Collectible) => collectible.gate_id === id)),
      ).toBe(true);
    });

    it('should return empty array if no collectibles found', async () => {
      const collectiblesNonExistent = await alice.contract
        .get_collectibles_by_creator({ creator_id: nonExistentUserId });

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
      await addTestCollectible(alice.contract, { gate_id: gateId, supply: initialSupply });

      initialTokensOfBob = await bob.contract.get_tokens_by_owner({ owner_id: bob.accountId });

      tokenId = await bob.contract.claim_token({ gate_id: gateId });
    });

    describe('token creation', () => {
      let token: Token;
      let tokensOfBob: Token[];

      beforeAll(async () => {
        tokensOfBob = await alice.contract.get_tokens_by_owner({ owner_id: bob.accountId });

        [token] = tokensOfBob.filter(({ token_id }) => token_id === +tokenId);
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

      it('should set now as time of token\'s creation', async () => {
        expect(isWithinLastMs(formatNsToMs(token.created_at), 1000 * 5)).toBe(true);
      });

      it('should set time of the token\'s modification equal to it\'s creation', async () => {
        expect(formatNsToMs(token.created_at)).toBe(formatNsToMs(token.modified_at));
      });
    });

    it('should decrement current supply of the collectible', async () => {
      const { current_supply } = await alice.contract.get_collectible_by_gate_id({ gate_id: gateId });

      expect(current_supply).toBe(+initialSupply - 1);
    });

    it('should throw an error if no gate id found', async () => {
      const nonExistentId = 'nonExistentId';

      await expect(alice.contract.claim_token({ gate_id: nonExistentId })).rejects.toThrow('Gate id not found');
    });

    it('should throw an error if all tokens have been claimed', async () => {
      const gateIdNoSupply = await generateId();

      await addTestCollectible(alice.contract, {
        gate_id: gateIdNoSupply,
        supply: '0',
      });

      await expect(alice.contract.claim_token({ gate_id: gateIdNoSupply })).rejects.toThrow(
        'All tokens for this gate id have been claimed',
      );
    });
  });

  describe('transfer_token', () => {
    let gateId: string;

    beforeAll(async () => {
      gateId = await generateId();
    });

    describe('happy path', () => {
      const initialSupply = '2000';

      let bobsTokenId: string;

      let initialTokensOfBob: Token[];
      let initialTokensOfAlice: Token[];
      let tokensOfAlice: Token[];
      let tokensOfBob: Token[];

      let token: Token;

      beforeAll(async () => {
        await addTestCollectible(alice.contract, { gate_id: gateId, supply: initialSupply });
        bobsTokenId = await bob.contract.claim_token({ gate_id: gateId });

        initialTokensOfAlice = await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId });
        initialTokensOfBob = await bob.contract.get_tokens_by_owner({ owner_id: bob.accountId });

        await bob.contract.transfer_token({ receiver: alice.accountId, token_id: +bobsTokenId });

        tokensOfAlice = await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId });
        tokensOfBob = await bob.contract.get_tokens_by_owner({ owner_id: bob.accountId });

        [token] = tokensOfAlice.filter(({ token_id }) => token_id === +bobsTokenId);
      });

      it('should associate token with it\'s new owner', () => {
        expect(token).not.toBeUndefined();
        expect(initialTokensOfAlice.length).toBe(tokensOfAlice.length - 1);
      });

      it('should disassociate token from it\'s previous owner', () => {
        expect(initialTokensOfBob.length).toBe(tokensOfBob.length + 1);

        const [transferredToken] = tokensOfBob.filter(({ token_id }) => token_id === +bobsTokenId);

        expect(transferredToken).toBeUndefined();
      });

      it('should set token\'s new owner', async () => {
        expect(token.owner_id).toBe(alice.accountId);
      });

      it('should update token\'s modified_at property', async () => {
        expect(formatNsToMs(token.modified_at)).toBeGreaterThan(formatNsToMs(token.created_at));
      });

      it('should set token\'s sender', () => {
        expect(token.sender_id).toBe(bob.accountId);
      });
    });

    describe('errors', () => {
      let alicesTokenId: string;

      beforeAll(async () => {
        alicesTokenId = await alice.contract.claim_token({ gate_id: gateId });
      });

      it('should throw when the sender and the receiver are one person', async () => {
        await expect(alice.contract.transfer_token({ receiver: alice.accountId, token_id: +alicesTokenId }))
          .rejects
          .toThrow('Self transfers are not allowed');
      });

      it('should throw when the sender doesn\'t own the token', async () => {
        await expect(bob.contract.transfer_token({ receiver: alice.accountId, token_id: +alicesTokenId }))
          .rejects
          .toThrow('Sender must own Token');
      });
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
        new Array(numberOfTokensToClaim).fill(0).map(() => alice.contract.claim_token({ gate_id: gateId })),
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
        tokensOfAlice.map(({ token_id }) => alice.contract.transfer_token({ receiver: bob.accountId, token_id })),
      );

      const newTokensOfAlice = await alice.contract.get_tokens_by_owner({ owner_id: alice.accountId });

      expect(newTokensOfAlice).toHaveLength(0);
    });
  });
});
