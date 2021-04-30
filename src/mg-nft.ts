// TypeScript bindings generated with near-ts v0.2.16 https://github.com/epam/near-syn

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
 *  The error variants thrown by *mg-nft*.
 */
export enum Panic {
    /**
     */
    MaxRoyaltyLessThanMinRoyalty,

    /**
     */
    RoyaltyMinThanAllowed,

    /**
     */
    RoyaltyMaxThanAllowed,

    /**
     */
    RoyaltyTooLarge,

    /**
     */
    GateIdAlreadyExists,

    /**
     */
    ZeroSupplyNotAllowed,

    /**
     */
    InvalidArgument,

    /**
     */
    GateIdNotFound,

    /**
     */
    GateIdExhausted,

    /**
     */
    GateIdHasTokens,

    /**
     */
    NotAuthorized,

    /**
     */
    TokenIdNotFound,

    /**
     */
    TokenIdNotOwnedBy,

    /**
     */
    OneApprovalAllowed,

    /**
     */
    SenderNotAuthToTransfer,

    /**
     */
    ReceiverIsOwner,

    /**
     */
    EnforceApprovalFailed,

    /**
     */
    MsgFormatNotRecognized,

    /**
     */
    MsgFormatMinPriceMissing,

    /**
     */
    RevokeApprovalFailed,

    /**
     */
    Errors,

}

/**
 *  Represents a list of errors when performing a batch update,
 *  identified by `TokenId`.
 */
export type Panics = [TokenId, Panic][];

/**
 *  Methods for the NFT contract.
 *  Methods belonging to a NEP Standard are implemented in their own interfaces.
 */
export interface NftContract {
    /**
     *  Initializes the contract.
     *  This contract methods needs to be explicitely called
     *  since the default construction of the contract will panic.
     * 
     *  - `admin_id` is the valid account that is allowed to perform certain operations.
     *  - `metadata` represents the general information of the contract.
     *  - `min_royalty` and `max_royalty` indicates what must be the max and min royalty respectively when creating a collectible.
     *  - `mintgate_fee` is the percetange to be paid to `mintgate_fee_account_id` for each sale.
     */
    init: { admin_id: ValidAccountId, metadata: NFTContractMetadata, min_royalty: Fraction, max_royalty: Fraction, mintgate_fee: Fraction, mintgate_fee_account_id: ValidAccountId };

    /**
     *  Creates a new `Collectible`, identified by `gate_id`.
     *  The `supply` indicates maximum supply for this collectible.
     *  The `royalty` indicates the royalty (as percentage) paid to the creator (`predecessor_account_id`).
     *  This royalty is paid when any `Token` is being resold in any marketplace.
     * 
     *  The sum of `royalty` and `mintgate_fee` should be less than `1`.
     *  Panics otherwise.
     *  This is to be able to make payouts all participants.
     * 
     *  See <https://github.com/epam/mintgate/issues/3>.
     */
    create_collectible(args: { gate_id: ValidGateId, title: string, description: string, supply: number, royalty: Fraction, media: string|null, media_hash: string|null, reference: string|null, reference_hash: string|null }, gas?: any): Promise<void>;

    /**
     *  Returns the `Collectible` with the given `gate_id`.
     *  Panics otherwise.
     * 
     *  See <https://github.com/epam/mintgate/issues/16>.
     */
    get_collectible_by_gate_id(args: { gate_id: ValidGateId }): Promise<Collectible|null>;

    /**
     *  Returns all `Collectible`s created by `creator_id`.
     * 
     *  See <https://github.com/epam/mintgate/issues/15>.
     */
    get_collectibles_by_creator(args: { creator_id: ValidAccountId }): Promise<Collectible[]>;

    /**
     *  Deletes the given `Collectible` by `gate_id`.
     *  The collectible can only be deleted if there are no minted tokens.
     *  Moreover, only the `creator_id` of the collectible or
     *  the contract `admin_id` are allowed to delete the collectible.
     */
    delete_collectible(args: { gate_id: ValidGateId }, gas?: any): Promise<void>;

    /**
     *  Claims a `Token` for the `Collectible` indicated by `gate_id`.
     *  The claim is on behalf the `predecessor_account_id`.
     *  Returns a `TokenId` that represents this claim.
     *  If the given `gate_id` has exhausted its supply, this call will panic.
     * 
     *  See <https://github.com/epam/mintgate/issues/6>.
     */
    claim_token(args: { gate_id: ValidGateId }, gas?: any): Promise<TokenId>;

    /**
     *  Burns (deletes) the `Token` identifed by `token_id`.
     *  Only the `owner_id` can burn the token.
     * 
     *  After succefully delete the token,
     *  a cross-contract call  is made to `nft_on_revoke` for each approval
     *  to delist from their marketplaces.
     */
    burn_token(args: { token_id: TokenId }, gas?: any): Promise<void>;

    /**
     *  Returns all `Token`s owned by `owner_id`.
     */
    get_tokens_by_owner(args: { owner_id: ValidAccountId }): Promise<Token[]>;

    /**
     *  Returns all tokens claimed by `owner_id` belonging to `gate_id`.
     * 
     *  See <https://github.com/epam/mintgate/issues/14>.
     */
    get_tokens_by_owner_and_gate_id(args: { gate_id: ValidGateId, owner_id: ValidAccountId }): Promise<Token[]>;

    /**
     *  Approves a batch of tokens, similar to `nft_approve`.
     *  Each approval contains the `TokenId` to approve and the minimum price to sell the token for.
     *  `account_id` indicates the market account contract where list these tokens.
     */
    batch_approve(args: { tokens: [TokenId, U128][], account_id: ValidAccountId }, gas?: any): Promise<void>;

}

/**
 *  Non-Fungible Token (NEP-171) v1.0.0
 *  https://nomicon.io/Standards/NonFungibleToken/Core.html
 * 
 *  Payouts is part of an ongoing (yet not settled) NEP spec:
 *  <https://github.com/thor314/NEPs/blob/patch-5/specs/Standards/NonFungibleToken/payouts.md>
 */
export interface NonFungibleTokenCore {
    /**
     *  Transfer the token `token_id` to the `receiver_id` account.
     * 
     *  See <https://github.com/epam/mintgate/issues/18>.
     */
    nft_transfer(args: { receiver_id: ValidAccountId, token_id: TokenId, enforce_approval_id: U64|null, memo: string|null }, gas?: any): Promise<void>;

    /**
     *  Query whom to be paid out for a given `token_id`, derived from some `balance`.
     *  For example, given the following settings for the NFT contract and collectible `gate_id`:
     * 
     *  - `mintgate_fee`: `25/1000` (2.5%)
     *  - `royalty`: `30/100` (30%)
     * 
     *  Then `nft_payout(token_id, 5_000_000)` will return
     * 
     *  - `mintgate_fee_account_id` -> 125_000
     *  - `collectible.creator_id` -> 3_375_000
     *  - `token.owner_id` -> 1_500_000
     * 
     *  for any `token_id` claimed from `gate_id`.
     * 
     *  This is part of an ongoing (yet not settled) NEP spec:
     *  <https://github.com/thor314/NEPs/blob/patch-5/specs/Standards/NonFungibleToken/payouts.md>
     */
    nft_payout(args: { token_id: TokenId, balance: U128 }): Promise<Payout>;

    /**
     *  Attempts to transfer the token.
     *  Afterwards returns the payout data.
     *  Effectively it is calling `nft_transfer` followed by `nft_payout`.
     * 
     *  This is part of an ongoing (yet not settled) NEP spec:
     *  <https://github.com/thor314/NEPs/blob/patch-5/specs/Standards/NonFungibleToken/payouts.md>
     */
    nft_transfer_payout(args: { receiver_id: ValidAccountId, token_id: TokenId, approval_id: U64|null, memo: string|null, balance: U128|null }, gas?: any): Promise<Payout|null>;

    /**
     *  Returns the token identified by `token_id`.
     *  Or `null` if the `token_id` was not found.
     * 
     *  See <https://github.com/epam/mintgate/issues/17>.
     */
    nft_token(args: { token_id: TokenId }): Promise<Token|null>;

}

/**
 *  Non-Fungible Token Metadata (NEP-177) v1.0.0
 * 
 *  <https://nomicon.io/Standards/NonFungibleToken/Metadata.html>
 */
export interface NonFungibleTokenMetadata {
    /**
     *  Returns the NFT metadata for this contract.
     */
    nft_metadata(): Promise<NFTContractMetadata>;

}

/**
 *  Non-Fungible Token Approval Management (NEP-178) v1.0.0
 * 
 *  <https://nomicon.io/Standards/NonFungibleToken/ApprovalManagement.html>
 */
export interface NonFungibleTokenApprovalMgmt {
    /**
     *  Allows `account_id` to transfer `token_id` on behalf of its owner.
     *  The `msg` argument allows the caller to pass into additional information.
     *  A contract implementing the `nft_on_approve` methods must be
     *  deployed into `account_id`.
     */
    nft_approve(args: { token_id: TokenId, account_id: ValidAccountId, msg: string|null }, gas?: any): Promise<void>;

    /**
     *  Revokes approval for `token_id` from `account_id`.
     */
    nft_revoke(args: { token_id: TokenId, account_id: ValidAccountId }, gas?: any): Promise<void>;

    /**
     *  Revokes all approval for `token_id`.
     */
    nft_revoke_all(args: { token_id: TokenId }, gas?: any): Promise<void>;

}

/**
 *  Non-Fungible Token Enumeration (NEP-181) v1.0.0
 * 
 *  <https://nomicon.io/Standards/NonFungibleToken/Enumeration.html>
 */
export interface NonFungibleTokenEnumeration {
    /**
     *  Returns the total token supply.
     */
    nft_total_supply(): Promise<U64>;

    /**
     *  Returns all or paginated `Token`s minted by this contract.
     *  Pagination is given by:
     * 
     *  - `from_index` the index to start fetching tokens.
     *  - `limit` indicates how many tokens will be at most returned.
     */
    nft_tokens(args: { from_index: U64|null, limit: number|null }): Promise<Token[]>;

    /**
     *  Returns how many `Token`s are owned by `account_id`.
     */
    nft_supply_for_owner(args: { account_id: ValidAccountId }): Promise<U64>;

    /**
     *  Returns all or paginated `Token`s owned by `account_id`.
     *  Pagination is given by:
     * 
     *  - `from_index` the index to start fetching tokens.
     *  - `limit` indicates how many tokens will be at most returned.
     */
    nft_tokens_for_owner(args: { account_id: ValidAccountId, from_index: U64|null, limit: number|null }): Promise<Token[]>;

    /**
     *  Gets the URI for the given `token_id`.
     *  The uri combines the `base_uri` from the contract metadata and
     *  the `gate_id` from the token.
     */
    nft_token_uri(args: { token_id: TokenId }): Promise<string|null>;

}

export interface NftContract extends NonFungibleTokenCore, NonFungibleTokenMetadata, NonFungibleTokenApprovalMgmt, NonFungibleTokenEnumeration {}

export const NftContractMethods = {
    viewMethods: [
        "get_collectible_by_gate_id",
        "get_collectibles_by_creator",
        "get_tokens_by_owner",
        "get_tokens_by_owner_and_gate_id",
        "nft_payout",
        "nft_token",
        "nft_metadata",
        "nft_total_supply",
        "nft_tokens",
        "nft_supply_for_owner",
        "nft_tokens_for_owner",
        "nft_token_uri",
    ],
    changeMethods: [
        "create_collectible",
        "delete_collectible",
        "claim_token",
        "burn_token",
        "batch_approve",
        "nft_transfer",
        "nft_transfer_payout",
        "nft_approve",
        "nft_revoke",
        "nft_revoke_all",
    ],
};
