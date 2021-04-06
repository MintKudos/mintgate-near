import { Account, Contract } from 'near-api-js';
import { Fraction } from './auxiliary';
import { Collectible, Token } from './nft';

export interface ContractMetadata {
  spec: string;
  name: string;
  symbol: string;
  icon?: string;
  base_uri?: string;
  reference?: string;
  reference_hash?: string;
}

export interface NftContract extends Contract {
  init(args: { admin_id: string; metadata: ContractMetadata }): Promise<void>;

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

  get_tokens_by_owner_and_gate_id(args: { gate_id: string; owner_id: string }): Promise<Token[]>;

  nft_metadata(): Promise<ContractMetadata>;

  nft_transfer(data: { receiver_id: string; token_id: string }): Promise<void>;

  nft_total_supply(): Promise<string>;

  nft_token(tokenId: { token_id: string }): Promise<Token>;

  nft_approve(args: { token_id: string; account_id: string; msg?: string }): Promise<void>;

  nft_revoke(args: { token_id: string; account_id: string }): Promise<void>;

  nft_revoke_all(token_id: { token_id: string }): Promise<void>;
}

export interface MarketContract extends Contract {
  init(mintgateFee: { mintgate_fee: Fraction }): Promise<void>;

  get_tokens_for_sale(): Promise<Token[]>;

  nft_on_approve(args: { token_id: string; owner_id: string; approval_id: string; msg: string }): Promise<void>;
}

export type AccountContract<T extends NftContract | MarketContract> = {
  contract: T;
  accountId: string;
  account: Account;
};
