// TypeScript bindings generated with near-ts v0.2.2 https://github.com/acuarica/near-syn on 2021-04-14 12:23:46.425520400 UTC

// Exports common NEAR Rust SDK types
export type U64 = string;
export type I64 = string;
export type U128 = string;
export type I128 = string;
export type AccountId = string;
export type ValidAccountId = string;

/**
 *  Represents a number between `0` and `1`.
 *  It is meant to be used as percentage to calculate both fees and royalties.
 *  As with usual fractions, `den`ominator cannot be `0`.
 *  Morever, `num` must be less or equal than `den`.
 */
export interface Fraction {
    /**
     *  The *numerator* of this `Fraction`.
     */
    num: number;

    /**
     *  The *denominator* of this `Fraction`.
     */
    den: number;

}

export type GateId = string;

export type TokenId = U64;

export type Timestamp = number;

/**
 *  Associated metadata for the NFT contract as defined by
 *  https://github.com/near/NEPs/discussions/177
 */
export interface ContractMetadata {
    /**
     */
    spec: string;

    /**
     */
    name: string;

    /**
     */
    symbol: string;

    /**
     */
    icon: string|null;

    /**
     */
    base_uri: string|null;

    /**
     */
    reference: string|null;

    /**
     */
    reference_hash: string|null;

}

/**
 *  Associated metadata with a `GateId` as defined by
 *  https://github.com/near/NEPs/discussions/177
 */
export interface TokenMetadata {
    /**
     */
    title: string|null;

    /**
     */
    description: string|null;

    /**
     */
    media: string|null;

    /**
     */
    media_hash: string|null;

    /**
     */
    copies: U64|null;

    /**
     */
    issued_at: Timestamp|null;

    /**
     */
    expires_at: Timestamp|null;

    /**
     */
    starts_at: Timestamp|null;

    /**
     */
    updated_at: Timestamp|null;

    /**
     */
    extra: string|null;

    /**
     */
    reference: string|null;

    /**
     */
    reference_hash: string|null;

}

/**
 */
export interface Collectible {
    /**
     */
    gate_id: GateId;

    /**
     */
    creator_id: AccountId;

    /**
     */
    current_supply: U64;

    /**
     */
    gate_url: string;

    /**
     */
    minted_tokens: TokenId[];

    /**
     */
    royalty: Fraction;

    /**
     */
    metadata: TokenMetadata;

}

/**
 */
export interface Token {
    /**
     *  The unique identifier for a `Token`.
     *  Any two different tokens, will have different `token_id`s,
     *  even if they belong to different `gate_id`s.
     */
    token_id: TokenId;

    /**
     */
    gate_id: GateId;

    /**
     *  The owner of this token.
     */
    owner_id: AccountId;

    /**
     *  Represents when this `Token` was minted, in nanoseconds.
     *  Once this `Token` is minted, this field remains unchanged.
     */
    created_at: number;

    /**
     *  Represents when this `Token` was last modified, in nanoseconds.
     *  Either when created or transferred.
     */
    modified_at: number;

    /**
     *  If this `Token` was transferred, this field holds the previous owner.
     *  Otherwise is empty.
     */
    sender_id: AccountId;

    /**
     *  Holds the list of accounts that can `transfer_token`s on behalf of the token's owner.
     *  It is mapped to the approval id and minimum amount that this token should be transfer for.
     */
    approvals: Record<AccountId, TokenApproval>;

    /**
     *  Counter to assign next approval ID.
     */
    approval_counter: U64;

}

/**
 */
export interface TokenApproval {
    /**
     */
    approval_id: U64;

    /**
     */
    min_price: U128;

}

/**
 *  In our implementation of the standard,
 *  The `nft_approve` method must conform with the following:
 *  - The `msg` argument must contain a value, *i.e.*, cannot be `None`.
 *  - The value of `msg` must be a valid JSON,
 *    that deserializes to this struct.
 */
export interface NftApproveMsg {
    /**
     */
    min_price: U128;

}

/**
 */
export interface MarketApproveMsg {
    /**
     *  Indicates the minimum price (in NEARs) that an account must pay to buy a token.
     */
    min_price: U128;

    /**
     *  Represents the `gate_id` of the token being approved.
     */
    gate_id: GateId;

    /**
     */
    creator_id: AccountId;

    /**
     */
    royalty: Fraction;

}

/**
 */
export interface TokenForSale {
    /**
     */
    token_id: TokenId;

    /**
     */
    owner_id: AccountId;

    /**
     */
    approval_id: U64;

    /**
     */
    min_price: U128;

    /**
     */
    nft_id: AccountId;

    /**
     */
    gate_id: GateId;

    /**
     */
    creator_id: AccountId;

    /**
     */
    royalty: Fraction;

}

export interface Self {
    /**
     *  Initializes the Market contract.
     * 
     *  - `mintgate_fee`: Indicates what percetage MintGate charges for a sale.
     *  - `mintgate_account_id`: Designated MintGate NEAR account id to receive `mintgate_fee` after a sale.
     */
    init: { mintgate_fee: Fraction, mintgate_account_id: ValidAccountId };

    /**
     *  Returns all available tokens for sale.
     *  Use the `nft_on_approve` method to add a token for sale.
     */
    get_tokens_for_sale(): Promise<TokenForSale[]>;

    /**
     *  Returns all tokens for sale whose collectible's gate ID is `gate_id`.
     */
    get_tokens_by_gate_id(args: { gate_id: GateId }): Promise<TokenForSale[]>;

    /**
     *  Returns all tokens for sale owned by `owner_id`.
     */
    get_tokens_by_owner_id(args: { owner_id: ValidAccountId }): Promise<TokenForSale[]>;

    /**
     *  Returns all tokens for sale whose collectible's creator ID is `creator_id`.
     */
    get_tokens_by_creator_id(args: { creator_id: ValidAccountId }): Promise<TokenForSale[]>;

    /**
     *  Buys the token.
     */
    buy_token(args: { token_id: TokenId }, gas?: any, amount?: any): Promise<void>;

}

export interface NonFungibleTokenApprovalsReceiver {
    /**
     *  Callback method to allow this contract to put a `Token` into the marketplace.
     *  The msg must contain the following fields:
     */
    nft_on_approve(args: { token_id: TokenId, owner_id: ValidAccountId, approval_id: U64, msg: string }, gas?: any): Promise<void>;

    /**
     */
    nft_on_revoke(args: { token_id: TokenId }, gas?: any): Promise<void>;

}

export type MarketContract = Self & NonFungibleTokenApprovalsReceiver;

export const MarketContractMethods = {
    viewMethods: [
        "get_tokens_for_sale",
        "get_tokens_by_gate_id",
        "get_tokens_by_owner_id",
        "get_tokens_by_creator_id",
    ],
    changeMethods: [
        "buy_token",
        "nft_on_approve",
        "nft_on_revoke",
    ],
};
