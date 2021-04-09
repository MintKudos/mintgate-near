// TypeScript bindings generated with near-ts v0.1.1 https://github.com/acuarica/near-doc on 2021-04-09 15:30:40.076563 UTC

// Exports common NEAR Rust SDK types
export type U64 = string;
export type U128 = string;
export type AccountId = string;
export type ValidAccountId = string;

export interface Fraction {
    num: number;
    den: number;
}

export type GateId = string;

export type TokenId = U64;

export type Timestamp = number;

export interface ContractMetadata {
    spec: string;
    name: string;
    symbol: string;
    icon: string|null;
    base_uri: string|null;
    reference: string|null;
    reference_hash: string|null;
}

export interface TokenMetadata {
    title: string|null;
    description: string|null;
    media: string|null;
    media_hash: string|null;
    copies: U64|null;
    issued_at: Timestamp|null;
    expires_at: Timestamp|null;
    starts_at: Timestamp|null;
    updated_at: Timestamp|null;
    extra: string|null;
    reference: string|null;
    reference_hash: string|null;
}

export interface Collectible {
    gate_id: GateId;
    creator_id: AccountId;
    current_supply: U64;
    gate_url: string;
    minted_tokens: TokenId[];
    royalty: Fraction;
    metadata: TokenMetadata;
}

export interface Token {
    token_id: TokenId;
    gate_id: GateId;
    owner_id: AccountId;
    created_at: number;
    modified_at: number;
    sender_id: AccountId;
    approvals: Record<AccountId, TokenApproval>;
    approval_counter: U64;
}

export interface TokenApproval {
    approval_id: U64;
    min_price: U128;
}

export interface ApproveMsg {
    min_price: U128;
}

export interface Self {
    init(args: { admin_id: ValidAccountId, metadata: ContractMetadata, min_royalty: Fraction, max_royalty: Fraction }): Promise<Self>;

    create_collectible(args: { gate_id: string, title: string, description: string, supply: U64, gate_url: string, royalty: Fraction }): Promise<void>;

    get_collectible_by_gate_id(args: { gate_id: string }): Promise<Collectible|null>;

    get_collectibles_by_creator(args: { creator_id: ValidAccountId }): Promise<Collectible[]>;

    claim_token(args: { gate_id: string }): Promise<TokenId>;

    get_tokens_by_owner(args: { owner_id: ValidAccountId }): Promise<Token[]>;

    get_tokens_by_owner_and_gate_id(args: { gate_id: GateId, owner_id: ValidAccountId }): Promise<Token[]>;

}

export interface NonFungibleTokenCore {
    nft_metadata(): Promise<ContractMetadata>;

    nft_transfer(args: { receiver_id: ValidAccountId, token_id: TokenId, enforce_approval_id: U64|null, memo: string|null }): Promise<void>;

    nft_total_supply(): Promise<U64>;

    nft_token(args: { token_id: TokenId }): Promise<Token|null>;

}

export interface NonFungibleTokenApprovalMgmt {
    nft_approve(args: { token_id: TokenId, account_id: ValidAccountId, msg: string|null }): Promise<void>;

    nft_revoke(args: { token_id: TokenId, account_id: ValidAccountId }): Promise<void>;

    nft_revoke_all(args: { token_id: TokenId }): Promise<void>;

}

export type NftContract = Self & NonFungibleTokenCore & NonFungibleTokenApprovalMgmt;

export const NftContractMethods = {
    viewMethods: [
        "get_collectible_by_gate_id",
        "get_collectibles_by_creator",
        "get_tokens_by_owner",
        "get_tokens_by_owner_and_gate_id",
        "nft_metadata",
        "nft_total_supply",
        "nft_token",
    ],
    changeMethods: [
        "init",
        "create_collectible",
        "claim_token",
        "nft_transfer",
        "nft_approve",
        "nft_revoke",
        "nft_revoke_all",
    ],
};
