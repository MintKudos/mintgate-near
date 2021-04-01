import { customAlphabet } from 'nanoid/async';

import type { Fraction, NftContract } from '../src';

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12);

export const generateId = async (): Promise<string> => nanoid();

const collectibleDefaultData = {
  gate_url: 'Test gate url',
  title: 'Test title',
  description: 'Test description',
  supply: '100',
  royalty: {
    num: 3,
    den: 10,
  },
};

export const addTestCollectible = async (
  contract: NftContract,
  collectibleData: {
    gate_id?: string;
    gate_url?: string;
    title?: string;
    description?: string;
    supply?: string;
    royalty?: Fraction;
  } = {},
): Promise<void> => {
  let { gate_id } = collectibleData;

  if (!gate_id) {
    gate_id = await generateId();
  }

  return contract.create_collectible({ ...collectibleDefaultData, ...collectibleData, gate_id });
};
