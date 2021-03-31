import { v4 as uuidv4 } from 'uuid';
import { CustomConsole } from '@jest/console';

import { addTestCollectible } from './utils';
import { AccountContract, Collectible, NftMethods } from '../src';
import { createProfiler } from './deploy';
import { getConfig } from './config';

global.console = new CustomConsole(process.stdout, process.stderr, (_type, message) => message);

describe('Nft contract', () => {
  let jen: AccountContract;
  let bob: AccountContract;

  beforeAll(async () => {
    const config = await getConfig('development', '');
    const { deploy, users } = await createProfiler('nft', NftMethods, config, 'jen', 'bob');
    [jen, bob] = users;

    await deploy('target/wasm32-unknown-unknown/release/mg_nft.wasm');
  });

  test('that test accounts are different', async () => {
    expect(jen.accountId).not.toBe(bob.accountId);
  });

  describe('create_collectible', () => {
    it('should create collectible with provided data', async () => {
      const gateId = uuidv4();
      const title = 'Test title';
      const description = 'Test description';
      const supply = '100';
      const royalty = {
        num: 5,
        den: 10,
      };

      await addTestCollectible(jen.contract, {
        gate_id: gateId,
        title,
        description,
        supply,
        royalty,
      });

      const collectible = await jen.contract.get_collectible_by_gate_id({ gate_id: gateId });

      expect(collectible).toMatchObject({
        title,
        description,
        current_supply: Number(supply),
        royalty,
      });
    });
  });

  describe('get_collectible_by_gate_id', () => {
    it('should return collectible', async () => {
      const gateId = uuidv4();

      await addTestCollectible(jen.contract, { gate_id: gateId });
      const collectible = await jen.contract.get_collectible_by_gate_id({ gate_id: gateId });

      expect(collectible).toMatchObject({ gate_id: gateId });
    });

    it('should throw an error if no collectible found', async () => {
      const nonExistentId = 'nonExistentId';

      await expect(jen.contract.get_collectible_by_gate_id({ gate_id: nonExistentId }))
        .rejects
        .toThrow('Given gate_id was not found');
    });
  });

  describe('get_collectibles_by_creator', () => {
    it('should return collectibles by one creator', async () => {
      const gateId = uuidv4();
      const numberOfCollectiblesToAdd = 5;
      const newGateIds = Array.from(new Array(numberOfCollectiblesToAdd), (el, i) => `${gateId}${i}`);

      const collectiblesInitial = await jen.contract.get_collectibles_by_creator({ creator_id: jen.accountId });

      await Promise.all(newGateIds.map((id) => addTestCollectible(jen.contract, { gate_id: id })));

      const collectibles = await jen.contract.get_collectibles_by_creator({ creator_id: jen.accountId });

      expect(collectibles).toHaveLength(numberOfCollectiblesToAdd + collectiblesInitial.length);
      expect(collectibles.every((collectible: Collectible) => collectible.creator_id === jen.accountId)).toBe(true);
      expect(
        newGateIds.every((id) => collectibles.some((collectible: Collectible) => collectible.gate_id === id)),
      ).toBe(true);
    });

    it('should return empty array if no collectibles found', async () => {
      const collectibles = await jen.contract.get_collectibles_by_creator({ creator_id: bob.accountId });

      expect(collectibles).toEqual([]);
    });
  });
});
