import type { Environment, ConfigLocal, ConfigNet } from '../src';

export const getConfig = async (env: Environment, contractName: string): Promise<ConfigLocal | ConfigNet> => {
  const { HOME } = process.env;

  switch (env) {
    case 'production':
      return {
        networkId: 'mainnet',
        nodeUrl: 'https://rpc.mainnet.near.org',
        contractName,
        walletUrl: 'https://wallet.mainnet.near.org',
        helperUrl: 'https://helper.mainnet.near.org',
      };
    case 'development':
    case 'testnet':
      return {
        networkId: 'default',
        nodeUrl: 'https://rpc.testnet.near.org',
        contractName,
        walletUrl: 'https://wallet.testnet.near.org',
        helperUrl: 'https://helper.testnet.near.org',
      };
    case 'betanet':
      return {
        networkId: 'betanet',
        nodeUrl: 'https://rpc.betanet.near.org',
        contractName,
        walletUrl: 'https://wallet.betanet.near.org',
        helperUrl: 'https://helper.betanet.near.org',
      };
    case 'local':
      if (!HOME) {
        throw Error('Environment variable `HOME` is not set.');
      }

      return {
        networkId: 'local',
        nodeUrl: 'http://localhost:3030',
        keyPath: `${HOME}/.near/validator_key.json`,
        walletUrl: 'http://localhost:4000/wallet',
        contractName,
      };
    default:
      throw Error(`Unconfigured environment '${env}'. Can be configured in src/config.js.`);
  }
};
