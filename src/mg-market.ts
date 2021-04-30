// TypeScript bindings generated with near-syn v0.3.0 https://github.com/epam/near-syn

// Exports common NEAR Rust SDK types
export type U64 = string;
export type I64 = string;
export type U128 = string;
export type I128 = string;
export type AccountId = string;
export type ValidAccountId = string;

/**
 *  The error variants thrown by *mg-core*.
 */
export enum CorePanics {
    /**
     *  Thrown when a denominator in a `Fraction` is `0`.
     */
    ZeroDenominatorFraction,

    /**
     *  Thrown when a `Fraction` is more than `1`.
     */
    FractionGreaterThanOne,

}

/**
 *  Represents a number between `0` and `1`.
 *  It is meant to be used as percentage to calculate both fees and royalties.
 *  As with usual fractions, `den`ominator cannot be `0`.
 *  Morever, `num` must be less or equal than `den`.
 */
export type Fraction = {
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
 *  use mg_core::gate::ValidGateId;
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
 *  use mg_core::gate::ValidGateId;
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
 *  Note that 64 bits `number`s cannot be represented in JavaScript,
 *  thus maximum number allowed is `2^53`.
 */
export type Timestamp = number;

/**
 *  Mapping from `AccountId`s to balance (in NEARs).
 *  The balance indicates the amount a Marketplace contract should pay when a Token is being sold.
 */
export type Payout = Record<AccountId, U128>;

/**
 *  A `Collectible` represents something of value.
 *  `Token`s can be then minted from a given collectible.
 *  A collectible is identified by `gate_id`.
 */
export type Collectible = {
    /**
     *  The unique identifier of this `Collectible`.
     */
    gate_id: GateId;

    /**
     *  The account id that created this `Collectible`.
     */
    creator_id: AccountId;

    /**
     *  Indicates how many `Token`s can be minted out of this `Collectible`.
     */
    current_supply: number;

    /**
     *  The list of `TokenId`s actually minted out of this `Collectible`.
     */
    minted_tokens: TokenId[];

    /**
     *  Indicates the royalty as percentage (in NEARs) to be paid to `creator_id`
     *  every time a minted token out of this `Collectible` is reselled.
     */
    royalty: Fraction;

    /**
     *  Additional info provided by NEP-177.
     */
    metadata: Metadata;

}

/**
 *  Represents a copy made out of a given collectible.
 */
export type Token = {
    /**
     *  The unique identifier for a `Token`.
     *  Any two different tokens, will have different `token_id`s,
     *  even if they belong to different `gate_id`s.
     */
    token_id: TokenId;

    /**
     *  The collectible identifier for this `Token`.
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
    created_at: Timestamp;

    /**
     *  Represents when this `Token` was last modified, in nanoseconds.
     *  Either when created or transferred.
     */
    modified_at: Timestamp;

    /**
     *  Holds the list of accounts that can `transfer_token`s on behalf of the token's owner.
     *  It is mapped to the approval id and minimum amount that this token should be transfer for.
     */
    approvals: Record<AccountId, TokenApproval>;

    /**
     *  Counter to assign next approval ID.
     */
    approval_counter: U64;

    /**
     *  Additional info defined by NEP-177.
     *  This `metadata` effectively joins fields from its respective `gate_id`.
     */
    metadata: Metadata;

}

/**
 *  Associated metadata with a `GateId` as defined by NEP-177
 * 
 *  Doc-comments for these fields were taken from:
 *  <https://nomicon.io/Standards/NonFungibleToken/Metadata.html#interface>
 */
export type Metadata = {
    /**
     *  ex. "Arch Nemesis: Mail Carrier" or "Parcel #5055".
     */
    title: string|null;

    /**
     *  Free-form description.
     */
    description: string|null;

    /**
     *  URL to associated media, preferably to decentralized, content-addressed storage.
     */
    media: string|null;

    /**
     *  Base64-encoded sha256 hash of content referenced by the `media` field.
     *  Required if `media` is included.
     */
    media_hash: string|null;

    /**
     *  Number of copies of this set of metadata in existence when token was minted.
     */
    copies: number|null;

    /**
     *  UNIX epoch datetime (in miliseconds) when token was issued or minted.
     */
    issued_at: Timestamp|null;

    /**
     *  UNIX epoch datetime (in miliseconds) when token expires.
     */
    expires_at: Timestamp|null;

    /**
     *  UNIX epoch datetime (in miliseconds) when token starts being valid.
     */
    starts_at: Timestamp|null;

    /**
     *  UNIX epoch datetime (in miliseconds) when token was last updated.
     */
    updated_at: Timestamp|null;

    /**
     *  Anything extra the NFT wants to store on-chain.
     *  It can be stringified JSON.
     */
    extra: string|null;

    /**
     *  URL to an off-chain JSON file with more info.
     */
    reference: string|null;

    /**
     *  Base64-encoded sha256 hash of JSON from reference field.
     *  Required if `reference` is included.
     */
    reference_hash: string|null;

}

/**
 *  Represents an individual approval by some marketplace account id.
 */
export type TokenApproval = {
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
 *  Associated metadata for the NFT contract as defined by NEP-177
 * 
 *  Doc-comments for these fields were taken from:
 *  <https://nomicon.io/Standards/NonFungibleToken/Metadata.html#interface>
 */
export type NFTContractMetadata = {
    /**
     *  Required, essentially a version like "nft-1.0.0".
     */
    spec: string;

    /**
     *  Required, ex. "Mochi Rising — Digital Edition" or "Metaverse 3".
     */
    name: string;

    /**
     *  Required, ex. "MOCHI".
     */
    symbol: string;

    /**
     *  Data URL.
     */
    icon: string|null;

    /**
     *  Centralized gateway known to have reliable access to decentralized storage assets referenced by `reference` or `media` URLs.
     */
    base_uri: string|null;

    /**
     *  URL to a JSON file with more info.
     */
    reference: string|null;

    /**
     *  Base64-encoded sha256 hash of JSON from reference field. Required if `reference` is included.
     */
    reference_hash: string|null;

}

/**
 *  In our implementation of the standard,
 *  The `nft_approve` method must conform with the following:
 *  - The `msg` argument must contain a value, *i.e.*, cannot be `None`.
 *  - The value of `msg` must be a valid JSON,
 *    that deserializes to this struct.
 */
export type NftApproveMsg = {
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
export type MarketApproveMsg = {
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
 *  Represents a token being sold in this marketplace.
 */
export type TokenForSale = {
    /**
     *  The contract account where this token has been minted.
     */
    nft_contract_id: AccountId;

    /**
     *  The token id for this token.
     */
    token_id: TokenId;

    /**
     *  Indicates the owner of this token within the `nft_contract_id`.
     */
    owner_id: AccountId;

    /**
     *  Internal approval id according to NEP-178.
     */
    approval_id: U64;

    /**
     *  Indicates the minimum price to which this token must being sold.
     */
    min_price: U128;

    /**
     *  The `gate_id` to which this token belongs to, if any.
     */
    gate_id: GateId|null;

    /**
     *  The `creator_id` of the collectible of this token, if any.
     */
    creator_id: AccountId|null;

}

/**
 *  The error variants thrown by *mg-market*.
 */
export enum Panics {
    /**
     *  Thrown when `nft_on_approve` does not find `min_price`.
     */
    MsgFormatMinPriceMissing,

    /**
     *  Thrown when the `token_key` was not found.
     */
    TokenKeyNotFound,

    /**
     *  Thrown when buyer attempts to buy own token.
     */
    BuyOwnTokenNotAllowed,

    /**
     *  Thrown when deposit is not enough to buy a token.
     */
    NotEnoughDepositToBuyToken,

}

/**
 *  Methods for the Marketplace contract.
 *  Methods belonging to a `trait` are implemented in their own interfaces.
 */
export interface MarketContract {
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
     *  Indicates that `predecessor_account_id` wants to buy the token `nft_contract_id:token_id`.
     * 
     *  The caller must attach at least `min_price` NEARs in order to pay for the given token.
     *  Moreover, the owner cannot buy his/her own tokens.
     * 
     *  When the token is sold,
     *  royalties are paid by this marketplace according to `nft_contract_id::nft_transfer_payout`.
     */
    buy_token(args: { nft_contract_id: ValidAccountId, token_id: TokenId }, gas?: any, amount?: any): Promise<void>;

}

/**
 *  This interface defines methods to be called
 *  when approval or removal happened in a NFT contract.
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
     *  Callback method to allow this contract to put multiple `Token`s into the marketplace.
     */
    batch_on_approve(args: { tokens: [TokenId, MarketApproveMsg][], owner_id: ValidAccountId }, gas?: any): Promise<void>;

}

export interface MarketContract extends NonFungibleTokenApprovalsReceiver {}

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
