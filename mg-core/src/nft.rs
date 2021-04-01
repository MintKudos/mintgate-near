use crate::fraction::Fraction;
use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    collections::UnorderedMap,
    json_types::{ValidAccountId, U128, U64},
    serde::{Deserialize, Serialize},
    AccountId, Balance,
};

/// The `GateId` type represents the identifier of each `Collectible`.
pub type GateId = String;

/// The `TokenId` type represents the identifier of each `Token`.
pub type TokenId = u64;

/// The `ValidTokenId` is meant to be used in public interfaces
/// to represent `TokenId`.
/// See https://github.com/near-examples/NFT/issues/117
/// for background.
pub type ValidTokenId = U64;

/// Unix epoch, expressed in miliseconds.
pub type Timestamp = u64;

/// Associated metadata for the NFT contract as defined by
/// https://github.com/near/NEPs/discussions/177
#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Clone)]
#[cfg_attr(not(target_arch = "wasm"), derive(PartialEq, Debug))]
#[serde(crate = "near_sdk::serde")]
pub struct ContractMetadata {
    pub spec: String,              // required, essentially a version like "nft-1.0.0"
    pub name: String, // required, ex. "Mochi Rising — Digital Edition" or "Metaverse 3"
    pub symbol: String, // required, ex. "MOCHI"
    pub icon: Option<String>, // Data URL
    pub base_uri: Option<String>, // Centralized gateway known to have reliable access to decentralized storage assets referenced by `reference` or `media` URLs
    pub reference: Option<String>, // URL to a JSON file with more info
    pub reference_hash: Option<String>, // Base64-encoded sha256 hash of JSON from reference field. Required if `reference` is included.
}

/// Associated metadata with a `GateId` as defined by
/// https://github.com/near/NEPs/discussions/177
#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[cfg_attr(not(target_arch = "wasm"), derive(Debug))]
#[serde(crate = "near_sdk::serde")]
pub struct TokenMetadata {
    pub title: Option<String>, // ex. "Arch Nemesis: Mail Carrier" or "Parcel #5055"
    pub description: Option<String>, // free-form description
    pub media: Option<String>, // URL to associated media, preferably to decentralized, content-addressed storage
    pub media_hash: Option<String>, // Base64-encoded sha256 hash of content referenced by the `media` field. Required if `media` is included.
    pub copies: Option<u64>, // number of copies of this set of metadata in existence when token was minted.
    pub issued_at: Option<Timestamp>, // ISO 8601 datetime when token was issued or minted
    pub expires_at: Option<Timestamp>, // ISO 8601 datetime when token expires
    pub starts_at: Option<Timestamp>, // ISO 8601 datetime when token starts being valid
    pub updated_at: Option<Timestamp>, // ISO 8601 datetime when token was last updated
    pub extra: Option<String>, // anything extra the NFT wants to store on-chain. Can be stringified JSON.
    pub reference: Option<String>, // URL to an off-chain JSON file with more info.
    pub reference_hash: Option<String>, // Base64-encoded sha256 hash of JSON from reference field. Required if `reference` is included.
}

#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[cfg_attr(not(target_arch = "wasm"), derive(Debug))]
#[serde(crate = "near_sdk::serde")]
pub struct Collectible {
    pub gate_id: GateId,
    pub creator_id: AccountId,
    pub current_supply: u64,
    pub gate_url: String,
    pub minted_tokens: Vec<TokenId>,
    pub royalty: Fraction,
    pub metadata: TokenMetadata,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Token {
    /// The unique identifier for a `Token`.
    /// Any two different tokens, will have different `token_id`s,
    /// even if they belong to different `gate_id`s.
    pub token_id: TokenId,
    pub gate_id: GateId,
    /// The owner of this token.
    pub owner_id: AccountId,
    /// Represents when this `Token` was minted, in nanoseconds.
    /// Once this `Token` is minted, this field remains unchanged.
    pub created_at: u64,
    /// Represents when this `Token` was last modified, in nanoseconds.
    /// Either when created or transferred.
    pub modified_at: u64,
    /// If this `Token` was transferred, this field holds the previous owner.
    /// Otherwise is empty.
    pub sender_id: AccountId,
    /// Holds the list of accounts that can `transfer_token`s on behalf of the token's owner.
    /// It is mapped to the approval id and minimum amount that this token should be transfer for.
    #[serde(skip_serializing)]
    pub approvals: UnorderedMap<AccountId, (u64, Balance)>,

    #[serde(skip_serializing)]
    /// Counter to assign next approval ID.
    pub approval_counter: u64,
}

pub trait NonFungibleTokenCore {
    fn nft_metadata(&self) -> ContractMetadata;

    fn nft_transfer(
        &mut self,
        receiver_id: ValidAccountId,
        token_id: ValidTokenId,
        enforce_approval_id: Option<U64>,
        memo: Option<String>,
    );

    fn nft_total_supply(&self) -> U64;

    fn nft_token(&self, token_id: ValidTokenId) -> Option<Token>;
}

pub trait NonFungibleTokenApprovalMgmt {
    fn nft_approve(
        &mut self,
        token_id: ValidTokenId,
        account_id: ValidAccountId,
        msg: Option<String>,
    );

    fn nft_revoke(&mut self, token_id: ValidTokenId, account_id: ValidAccountId);

    fn nft_revoke_all(&mut self, token_id: ValidTokenId);
}

/// In our implementation of the standard,
/// The `nft_approve` method must conform with the following:
/// - The `msg` argument must contain a value, *i.e.*, cannot be `None`.
/// - The value of `msg` must be a valid JSON,
///   that deserializes to this struct.
#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ApproveMsg {
    pub min_price: U128,
}

pub trait NonFungibleTokenApprovalsReceiver {
    fn nft_on_approve(
        &mut self,
        token_id: ValidTokenId,
        owner_id: ValidAccountId,
        approval_id: U64,
        msg: String,
    );
}
