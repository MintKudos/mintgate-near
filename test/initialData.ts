import { NFTContractMetadata, Fraction } from '../src';

export const prefixes = {
  nft: {
    contract: 'nft',
    users: ['alice', 'bob'],
    feeUser: 'mintgate-fee',
    admin: 'admin',
  },
  market: {
    contract: 'market',
    users: ['merchant-1', 'merchant-2'],
  },
};

export const contractMetadata: NFTContractMetadata = {
  spec: 'someSpec',
  name: 'someName',
  symbol: 'someSymbol',
  icon: 'someIcon',
  base_uri: 'https://example.com',
  reference: 'someReference',
  reference_hash: 'someReferenceHash',
};

export const royalty: { min_royalty: Fraction; max_royalty: Fraction } = {
  min_royalty: {
    num: 5,
    den: 100,
  },
  max_royalty: {
    num: 99,
    den: 100,
  },
};

export const MINTGATE_FEE: Fraction = {
  num: 25,
  den: 1000,
};
