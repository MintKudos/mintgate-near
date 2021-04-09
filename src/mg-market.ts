// TypeScript bindings generated with near-ts v0.1.1 https://github.com/acuarica/near-doc on 2021-04-09 15:03:37.217539 UTC

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

export interface Token2 {
    owner_id: AccountId;
    metadata: string;
}

export interface Self {
    init(args: { mintgate_fee: Fraction }): Promise<Self>;

    get_tokens_for_sale(): Promise<TokenId[]>;

}

export interface NonFungibleTokenApprovalsReceiver {
    nft_on_approve(args: { token_id: TokenId, owner_id: ValidAccountId, approval_id: U64, msg: string }): Promise<void>;

}

export type MarketContract = Self & NonFungibleTokenApprovalsReceiver;

export const MarketContractMethods = {
    viewMethods: [
        "get_tokens_for_sale",
    ],
    changeMethods: [
        "init",
        "nft_on_approve",
    ],
};
