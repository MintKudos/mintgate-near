// TypeScript bindings generated with near-ts v0.2.1 https://github.com/acuarica/near-syn on 2021-04-12 12:26:59.081618 UTC

// Exports common NEAR Rust SDK types
export type U64 = string;
export type U128 = string;
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
     */
    min_price: U128;

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
     *  Initializes the contract.
     *  This contract methods needs to be explicitely called
     *  since the default construction of the contract will panic.
     * 
     *  - `admin_id` is the valid account that is allowed to perform certain operations.
     *  - `metadata` represents the general information of the contract.
     *  - `min_royalty` and `max_royalty` indicates what must be the max and min royalty respectively when creating a collectible.
     */
    init(args: { admin_id: ValidAccountId, metadata: ContractMetadata, min_royalty: Fraction, max_royalty: Fraction }): Promise<Self>;

    /**
     *  Creates a new `Collectible`, identified by `gate_id`.
     *  The `supply` indicates maximum supply for this collectible.
     *  The `royalty` indicates the royalty (as percentage) paid to the creator (`predecessor_account_id`).
     *  This royalty is paid when any `Token` is being resold in any marketplace.
     * 
     *  See <https://github.com/epam/mintgate/issues/3>.
     */
    create_collectible(args: { gate_id: string, title: string, description: string, supply: U64, gate_url: string, royalty: Fraction }): Promise<void>;

    /**
     *  Returns the `Collectible` with the given `gate_id`.
     *  Panics otherwise.
     * 
     *  See <https://github.com/epam/mintgate/issues/16>.
     */
    get_collectible_by_gate_id(args: { gate_id: string }): Promise<Collectible|null>;

    /**
     *  Returns all `Collectible`s created by `creator_id`.
     * 
     *  See <https://github.com/epam/mintgate/issues/15>.
     */
    get_collectibles_by_creator(args: { creator_id: ValidAccountId }): Promise<Collectible[]>;

    /**
     *  Claims a `Token` for the `Collectible` indicated by `gate_id`.
     *  The claim is on behalf the `predecessor_account_id`.
     *  Returns a `TokenId` that represents this claim.
     *  If the given `gate_id` has exhausted its supply, this call will panic.
     * 
     *  See <https://github.com/epam/mintgate/issues/6>.
     */
    claim_token(args: { gate_id: string }): Promise<TokenId>;

    /**
     *  Returns all `Token`s owned by `owner_id`.
     */
    get_tokens_by_owner(args: { owner_id: ValidAccountId }): Promise<Token[]>;

    /**
     *  Returns all tokens claimed by `owner_id` belonging to `gate_id`.
     * 
     *  See <https://github.com/epam/mintgate/issues/14>.
     */
    get_tokens_by_owner_and_gate_id(args: { gate_id: GateId, owner_id: ValidAccountId }): Promise<Token[]>;

}

export interface NonFungibleTokenCore {
    /**
     *  Returns the NFT metadata for this contract.
     */
    nft_metadata(): Promise<ContractMetadata>;

    /**
     *  Transfer the token `token_id` to the `receiver_id` account.
     * 
     *  See <https://github.com/epam/mintgate/issues/18>.
     */
    nft_transfer(args: { receiver_id: ValidAccountId, token_id: TokenId, enforce_approval_id: U64|null, memo: string|null }): Promise<void>;

    /**
     *  Returns the total token supply.
     */
    nft_total_supply(): Promise<U64>;

    /**
     *  Returns the token identified by `token_id`.
     *  Or `null` if the `token_id` was not found.
     * 
     *  See <https://github.com/epam/mintgate/issues/17>.
     */
    nft_token(args: { token_id: TokenId }): Promise<Token|null>;

}

export interface NonFungibleTokenApprovalMgmt {
    /**
     *  Allows `account_id` to transfer `token_id` on behalf of its owner.
     *  The `msg` argument allows the caller to pass into additional information.
     *  A contract implementing the `nft_on_approve` methods must be
     *  deployed into `account_id`.
     */
    nft_approve(args: { token_id: TokenId, account_id: ValidAccountId, msg: string|null }): Promise<void>;

    /**
     *  Revokes approval for `token_id` from `account_id`.
     */
    nft_revoke(args: { token_id: TokenId, account_id: ValidAccountId }): Promise<void>;

    /**
     *  Revokes all approval for `token_id`.
     */
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
