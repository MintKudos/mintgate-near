import { Account, Contract } from 'near-api-js';
import { Fraction } from './auxiliary';
import { Collectible } from './nft';
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
