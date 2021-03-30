import { Account, Contract } from 'near-api-js';
import { NearConfig } from 'near-api-js/lib/near';
export interface Fraction {
    num: number;
    den: number;
}
export interface Collectible {
    gate_id: string;
    creator_id: string;
    title: string;
    description: string;
    current_supply: number;
    gate_url: string;
    minted_tokens: [];
    royalty: Fraction;
}
export interface NftContract extends Contract {
    init(mintgateFee: {
        mintgate_fee: Fraction;
    }): Promise<void>;
    create_collectible(collectibleData: {
        gate_id: string;
        gate_url: string;
        title: string;
        description: string;
        supply: string;
        royalty: Fraction;
    }): void;
    get_collectible_by_gate_id(gateId: {
        gate_id: string;
    }): Promise<Collectible>;
    get_collectibles_by_creator(creatorId: {
        creator_id: string;
    }): Promise<Collectible[]>;
}
export declare type AccountContract = {
    contract: NftContract;
    accountId: string;
    account: Account;
};
export interface Config extends NearConfig {
    contractName: string;
}
export interface ConfigLocal extends Config {
    keyPath: string;
}
export interface ConfigNet extends Config {
    helperUrl: string;
}
export declare type Environment = 'production' | 'development' | 'testnet' | 'betanet' | 'local';
