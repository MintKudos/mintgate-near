import { NearConfig } from 'near-api-js/lib/near';

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
