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
  spec: 'nft-0.0.1',
  name: 'Mintgate NFT contract',
  symbol: 'MNTGT',
  icon:
    "data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' enable-background='new 0 0 91 90' viewBox='0 0 91 90'%3e%3cpath d='m72.7 4.6-18.8 27.9c-1.3 1.9 1.2 4.2 3 2.6l18.5-16.1c.5-.4 1.2-.1 1.2.6v50.3c0 .7-.9 1-1.3.5l-56-67c-1.8-2.2-4.4-3.4-7.3-3.4h-2c-5.2 0-9.5 4.3-9.5 9.6v70.8c0 5.3 4.3 9.6 9.6 9.6 3.3 0 6.4-1.7 8.2-4.6l18.8-27.9c1.3-1.9-1.2-4.2-3-2.6l-18.5 16c-.5.4-1.2.1-1.2-.6v-50.2c0-.7.9-1 1.3-.5l56 67c1.8 2.2 4.5 3.4 7.3 3.4h2c5.3 0 9.6-4.3 9.6-9.6v-70.8c0-5.3-4.3-9.6-9.6-9.6-3.4 0-6.5 1.7-8.3 4.6z' fill='%23fff'/%3e%3c/svg%3e",
  base_uri: 'https://www.mintgate.app/',
  reference: 'https://www.mintgate.app/token.json',
  reference_hash: 'MmJlMzViYzY3MWRjOTEyZTdmNTQwZjBlNWEyZTkxNWVmNmE0YTRkYmQyYWRhNWJhOWMxZDJiMTE3YmZjOTA3Yw==',
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
