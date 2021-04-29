import { Account, Contract } from 'near-api-js';
import { NearConfig } from 'near-api-js/lib/near';
import { MarketContract } from './mg-market';
import { NftContract } from './mg-nft';

export { Fraction, NFTContractMetadata, NftContract, NftContractMethods, Collectible, Token } from './mg-nft';
export { MarketContract, MarketContractMethods } from './mg-market';

export interface Config extends NearConfig {
  contractName: string;
}

export interface ConfigLocal extends Config {
  keyPath: string;
}

export interface ConfigNet extends Config {
  helperUrl: string;
}

export type Environment = 'production' | 'development' | 'testnet' | 'betanet' | 'local';

export type AccountContract<T extends NftContract | MarketContract> = {
  contract: T & (Contract & { [key: string]: (args: unknown) => unknown });
  accountId: string;
  account: Account;
  contractAccount: Account;
};

export interface Methods {
  viewMethods: string[];
  changeMethods: string[];
}
