// TypeScript bindings generated with near-ts v0.2.11 https://github.com/epam/near-syn

// Exports common NEAR Rust SDK types
export type U64 = string;
export type I64 = string;
export type U128 = string;
export type I128 = string;
export type AccountId = string;
export type ValidAccountId = string;

/**
 */
export enum CorePanics {
    ZeroDenominatorFraction,
    FractionGreaterThanOne,
}

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

/**
 *  The `GateId` type represents the identifier of each `Collectible`.
 *  This type is meant to be used internally by contracts.
 *  To pass around `GateId` in public interfaces, use `ValidGateId`.
 */
export type GateId = string;

/**
 *  Struct used to validate gate IDs during serialization and deserializiation.
 *  A valid `GateId` cannot be empty nor have more than 32 chars long.
 *  Moreover, these are the following valid chars for a `GateId`:
 * 
 *  > 'a'..='z' | 'A'..='Z' | '0'..='9' | '_' | '-'
 * 
 *  ## Examples
 * 
 *  ```
 *  use mg_core::ValidGateId;
 *  use std::convert::TryFrom;
 * 
 *  assert!(ValidGateId::try_from("TGWN_P5W6QNX").is_ok());
 *  assert!(ValidGateId::try_from("YUF6J-4D6ZTB").is_ok());
 *  assert!(ValidGateId::try_from("RHFJS1LPQAS2").is_ok());
 *  assert!(ValidGateId::try_from("ALTRMDMNNMRT").is_ok());
 *  assert!(ValidGateId::try_from("VDvB2TS2xszCyQiCzSQEpD").is_ok());
 * 
 *  assert!(ValidGateId::try_from("VDvB2TS2.szCyQiCzSQEpD").is_err());
 *  assert!(ValidGateId::try_from("VDvB2TS2szCyQ/iCzSQEpD").is_err());
 *  assert!(ValidGateId::try_from("VDvB2TS2xszCyQiCzSQEpDVDvB2TS2xszCyQiCzSQEpD").is_err());
 *  assert!(ValidGateId::try_from("").is_err());
 *  ```
 * 
 *  ## Usage
 * 
 *  ```
 *  use mg_core::ValidGateId;
 *  use near_sdk::serde_json;
 *  use std::convert::TryInto;
 *  use std::convert::TryFrom;
 * 
 *  let key: ValidGateId = serde_json::from_str("\"ALTRMDMNNMRT\"").unwrap();
 *  assert_eq!(key.to_string(), "ALTRMDMNNMRT".to_string());
 * 
 *  let key: ValidGateId = serde_json::from_str("\"VDvB2TS2xszCyQiCzSQEpD\"").unwrap();
 *  assert_eq!(key.to_string(), "VDvB2TS2xszCyQiCzSQEpD".to_string());
 * 
 *  let key: Result<ValidGateId, _> = serde_json::from_str("o7fSzsCYsSedUYRw5HmhTo7fSzsCYsSedUYRw5HmhT");
 *  assert!(key.is_err());
 * 
 *  let key: ValidGateId = "RHFJS1LPQAS2".try_into().unwrap();
 *  let actual: String = serde_json::to_string(&key).unwrap();
 *  assert_eq!(actual, "\"RHFJS1LPQAS2\"");
 * 
 *  let key = ValidGateId::try_from("RHFJS1LPQAS2").unwrap();
 *  assert_eq!(key.as_ref(), &"RHFJS1LPQAS2".to_string());
 *  ```
 */
export type ValidGateId = GateId;

/**
 *  The `TokenId` type represents the identifier of each `Token`.
 *  This type can be used in both public interfaces and internal `struct`s.
 *  See https://github.com/near-examples/NFT/issues/117 for background.
 */
export type TokenId = U64;

/**
 *  Unix epoch, expressed in miliseconds.
 *  Note that 64 bits `number`s cannot be represented in JavaScript.
 *  Therefore, this type cannot be used in public interfaces.
 *  Only for internal `struct`s.
 */
export type Timestamp = number;

/**
 *  Mapping from `AccountId`s to balance (in NEARs).
 *  The balance indicates the amount a Marketplace contract should pay when a Token is being sold.
 */
export type Payout = Record<AccountId, U128>;

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
 *  Represents an individual approval by some marketplace account id.
 */
export interface TokenApproval {
    /**
     *  Id used to avoid selling the same token more than once.
     */
    approval_id: U64;

    /**
     *  Minimum price a token should be sell for.
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
     *  Indicates the minimum price (in NEARs) requested by owner to pay for the token.
     */
    min_price: U128;

}

/**
 *  Represents the payload that arrives to the Marketplace contract,
 *  from our NFT implementation.
 *  It contains the `min_price` of the token.
 *  Additionally it is augmented with `gate_id` and `creator_id`
 *  so the Marketplace can lookup by this fields.
 */
export interface MarketApproveMsg {
    /**
     *  Indicates the minimum price (in NEARs) that an account must pay to buy a token.
     */
    min_price: U128;

    /**
     *  Represents the `gate_id` of the token being approved if present.
     */
    gate_id: ValidGateId|null;

    /**
     *  Represents the `creator_id` of the collectible of the token being approved if present.
     */
    creator_id: AccountId|null;

}

/**
 *  In marketplace contract, each token must be addressed by `<nft contract id, token id>`.
 */
export type TokenKey = [AccountId, TokenId];

/**
 */
export interface TokenForSale {
    /**
     */
    nft_id: AccountId;

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
    gate_id: GateId|null;

    /**
     */
    creator_id: AccountId|null;

}

/**
 */
export enum Panics {
    MsgFormatMinPriceMissing,
    TokenKeyNotFound,
    BuyOwnTokenNotAllowed,
    NotEnoughDepositToBuyToken,
}

/**
 */
export interface Self0 {
    /**
     *  Initializes the Market contract.
     */
    init: {  };

    /**
     *  Returns all available tokens for sale.
     *  Use the `nft_on_approve` method to add a token for sale.
     */
    get_tokens_for_sale(): Promise<TokenForSale[]>;

    /**
     *  Returns all tokens for sale owned by `owner_id`.
     */
    get_tokens_by_owner_id(args: { owner_id: ValidAccountId }): Promise<TokenForSale[]>;

    /**
     *  Returns all tokens for sale whose collectible's gate ID is `gate_id`.
     */
    get_tokens_by_gate_id(args: { gate_id: ValidGateId }): Promise<TokenForSale[]>;

    /**
     *  Returns all tokens for sale whose collectible's creator ID is `creator_id`.
     */
    get_tokens_by_creator_id(args: { creator_id: ValidAccountId }): Promise<TokenForSale[]>;

    /**
     *  Buys the token.
     */
    buy_token(args: { nft_id: ValidAccountId, token_id: TokenId }, gas?: any, amount?: any): Promise<void>;

}

/**
 */
export interface NonFungibleTokenApprovalsReceiver {
    /**
     *  Callback method to allow this contract to put a `Token` into the marketplace.
     *  The msg must contain the following fields:
     */
    nft_on_approve(args: { token_id: TokenId, owner_id: ValidAccountId, approval_id: U64, msg: string }, gas?: any): Promise<void>;

    /**
     *  Callback method to remove this `Token` from the marketplace.
     */
    nft_on_revoke(args: { token_id: TokenId }, gas?: any): Promise<void>;

    /**
     */
    batch_on_approve(args: { tokens: [TokenId, MarketApproveMsg][], owner_id: ValidAccountId }, gas?: any): Promise<void>;

}

export type MarketContract = Self0 & NonFungibleTokenApprovalsReceiver;

export const MarketContractMethods = {
    viewMethods: [
        "get_tokens_for_sale",
        "get_tokens_by_owner_id",
        "get_tokens_by_gate_id",
        "get_tokens_by_creator_id",
    ],
    changeMethods: [
        "buy_token",
        "nft_on_approve",
        "nft_on_revoke",
        "batch_on_approve",
    ],
};
