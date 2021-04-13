import { ContractMetadata, Fraction } from '../src';

export const prefixes = {
  nft: {
    contract: 'nft',
    users: ['alice', 'bob', 'mintgate-fee'],
  },
  market: {
    contract: 'market',
    users: ['merchant-1', 'merchant-2'],
  },
};

export const contractMetadata: ContractMetadata = {
  spec: 'someSpec',
  name: 'someName',
  symbol: 'someSymbol',
  icon: 'someIcon',
  base_uri: 'someUri',
  reference: 'someReference',
  reference_hash: 'someReferenceHash',
};

export const royalty: { min_royalty: Fraction; max_royalty: Fraction } = {
  min_royalty: {
    num: 5,
    den: 100,
  },
  max_royalty: {
    num: 30,
    den: 100,
  },
};
