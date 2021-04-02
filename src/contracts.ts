import { Account, Contract } from 'near-api-js';
import { Fraction } from './auxiliary';
import { Collectible, Token } from './nft';

export interface NftContract extends Contract {
  init(mintgateFee: { mintgate_fee: Fraction }): Promise<void>;

  create_collectible(collectibleData: {
    gate_id: string;
    gate_url: string;
    title: string;
    description: string;
    supply: string;
    royalty: Fraction;
  }): void;

  get_collectible_by_gate_id(gateId: { gate_id: string }): Promise<Collectible>;

  get_collectibles_by_creator(creatorId: { creator_id: string }): Promise<Collectible[]>;

  claim_token(gateId: { gate_id: string }): Promise<string>;

  get_tokens_by_owner(ownerId: { owner_id: string }): Promise<Token[]>;

  nft_transfer(data: { receiver_id: string, token_id: string }): Promise<void>;

  approve(args: { token_id: string, account_id: string }): Promise<void>;
}

export type AccountContract = {
  contract: NftContract;
  accountId: string;
  account: Account;
};
