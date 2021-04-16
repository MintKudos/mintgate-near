#![deny(warnings)]

#[cfg(not(target_arch = "wasm"))]
pub mod mocked_context;

use near_env::{near_ext, PanicMessage};
use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    env, ext_contract,
    json_types::{ValidAccountId, U128, U64},
    serde::{Deserialize, Serialize},
    AccountId, Balance, CryptoHash,
};
use std::{collections::HashMap, fmt::Display, num::ParseIntError, str::FromStr, u128};
use uint::construct_uint;

construct_uint! {
    /// 256-bit unsigned integer.
    struct U256(4);
}

#[derive(Serialize, PanicMessage)]
#[serde(crate = "near_sdk::serde", tag = "err")]
enum Panics {
    #[panic_msg = "Denominator must be a positive number, but was 0"]
    ZeroDenominatorFraction,
    #[panic_msg = "The fraction must be less or equal to 1"]
    FractionGreaterThanOne,
}

/// Represents a number between `0` and `1`.
/// It is meant to be used as percentage to calculate both fees and royalties.
/// As with usual fractions, `den`ominator cannot be `0`.
/// Morever, `num` must be less or equal than `den`.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Eq)]
#[cfg_attr(not(target_arch = "wasm"), derive(Debug, Clone, Copy))]
#[serde(crate = "near_sdk::serde")]
pub struct Fraction {
    /// The *numerator* of this `Fraction`.
    pub num: u32,
    /// The *denominator* of this `Fraction`.
    pub den: u32,
}

impl Fraction {
    /// Checks the given `Fraction` is valid, *i.e.*,
    /// - Has a non-zero denominator, and
    /// - The `num` is less or equal than `den`ominator.
    pub fn check(&self) {
        if self.den == 0 {
            Panics::ZeroDenominatorFraction.panic();
        }
        if self.num > self.den {
            Panics::FractionGreaterThanOne.panic();
        }
    }

    /// Multiplies this `Fraction` by the given `value`.
    pub fn mult(&self, value: Balance) -> Balance {
        (U256::from(self.num) * U256::from(value) / U256::from(self.den)).as_u128()
    }
}

impl PartialEq for Fraction {
    fn eq(&self, other: &Self) -> bool {
        self.mult(u128::MAX) == other.mult(u128::MAX)
    }
}

impl PartialOrd for Fraction {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        self.mult(u128::MAX).partial_cmp(&other.mult(u128::MAX))
    }
}

impl Ord for Fraction {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.mult(u128::MAX).cmp(&other.mult(u128::MAX))
    }
}

impl Display for Fraction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}/{}", self.num, self.den)
    }
}

#[cfg(not(target_arch = "wasm"))]
impl FromStr for Fraction {
    type Err = ParseIntError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let parts = s.split("/").collect::<Vec<&str>>();
        Ok(Self { num: parts[0].parse::<u32>()?, den: parts[1].parse::<u32>()? })
    }
}

/// The `GateId` type represents the identifier of each `Collectible`.
pub type GateId = String;

/// The `TokenId` type represents the identifier of each `Token`.
/// This type can be used in both public interfaces and internal `struct`s.
/// See https://github.com/near-examples/NFT/issues/117 for background.
pub type TokenId = U64;

/// Unix epoch, expressed in miliseconds.
/// Note that 64 bits `number`s cannot be represented in JavaScript.
/// Therefore, this type cannot be used in public interfaces.
/// Only for internal `struct`s.
pub type Timestamp = u64;

/// Mapping from `AccountId`s to balance (in NEARs).
/// The balance indicates the amount a Marketplace contract should pay when a Token is being sold.
pub type Payout = HashMap<AccountId, U128>;

/// Returns the sha256 of `value`.
pub fn crypto_hash(value: &String) -> CryptoHash {
    let mut hash = CryptoHash::default();
    hash.copy_from_slice(&env::sha256(value.as_bytes()));
    hash
}

/// Associated metadata for the NFT contract as defined by
/// https://github.com/near/NEPs/discussions/177
#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Clone)]
#[cfg_attr(not(target_arch = "wasm"), derive(PartialEq, Debug))]
#[serde(crate = "near_sdk::serde", deny_unknown_fields)]
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
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[cfg_attr(not(target_arch = "wasm"), derive(PartialEq, Debug))]
#[serde(crate = "near_sdk::serde")]
pub struct TokenMetadata {
    pub title: Option<String>, // ex. "Arch Nemesis: Mail Carrier" or "Parcel #5055"
    pub description: Option<String>, // free-form description
    pub media: Option<String>, // URL to associated media, preferably to decentralized, content-addressed storage
    pub media_hash: Option<String>, // Base64-encoded sha256 hash of content referenced by the `media` field. Required if `media` is included.
    pub copies: Option<U64>, // number of copies of this set of metadata in existence when token was minted.
    pub issued_at: Option<Timestamp>, // ISO 8601 datetime when token was issued or minted
    pub expires_at: Option<Timestamp>, // ISO 8601 datetime when token expires
    pub starts_at: Option<Timestamp>, // ISO 8601 datetime when token starts being valid
    pub updated_at: Option<Timestamp>, // ISO 8601 datetime when token was last updated
    pub extra: Option<String>, // anything extra the NFT wants to store on-chain. Can be stringified JSON.
    pub reference: Option<String>, // URL to an off-chain JSON file with more info.
    pub reference_hash: Option<String>, // Base64-encoded sha256 hash of JSON from reference field. Required if `reference` is included.
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[cfg_attr(not(target_arch = "wasm"), derive(PartialEq, Debug))]
#[serde(crate = "near_sdk::serde")]
pub struct Collectible {
    pub gate_id: GateId,
    pub creator_id: AccountId,
    pub current_supply: U64,
    pub gate_url: String,
    pub minted_tokens: Vec<TokenId>,
    pub royalty: Fraction,
    pub metadata: TokenMetadata,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[cfg_attr(not(target_arch = "wasm"), derive(PartialEq, Debug))]
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
    pub approvals: HashMap<AccountId, TokenApproval>,
    /// Counter to assign next approval ID.
    pub approval_counter: U64,
}

/// Represents an individual approval by some marketplace account id.
#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[cfg_attr(not(target_arch = "wasm"), derive(PartialEq, Debug))]
#[serde(crate = "near_sdk::serde")]
pub struct TokenApproval {
    /// Id used to avoid selling the same token more than once.
    pub approval_id: U64,
    /// Minimum price a token should be sell for.
    pub min_price: U128,
}

#[near_ext]
#[ext_contract(nft)]
pub trait NonFungibleTokenCore {
    fn nft_metadata(&self) -> ContractMetadata;

    fn nft_transfer(
        &mut self,
        receiver_id: ValidAccountId,
        token_id: TokenId,
        enforce_approval_id: Option<U64>,
        memo: Option<String>,
    );

    fn nft_payout(&self, token_id: U64, balance: U128) -> Payout;

    fn nft_transfer_payout(
        &mut self,
        receiver_id: ValidAccountId,
        token_id: TokenId,
        approval_id: Option<U64>,
        memo: Option<String>,
        balance: Option<U128>,
    ) -> Option<Payout>;

    fn nft_total_supply(&self) -> U64;

    fn nft_token(&self, token_id: TokenId) -> Option<Token>;
}

pub trait NonFungibleTokenApprovalMgmt {
    fn nft_approve(&mut self, token_id: TokenId, account_id: ValidAccountId, msg: Option<String>);

    fn nft_revoke(&mut self, token_id: TokenId, account_id: ValidAccountId);

    fn nft_revoke_all(&mut self, token_id: TokenId);
}

/// In our implementation of the standard,
/// The `nft_approve` method must conform with the following:
/// - The `msg` argument must contain a value, *i.e.*, cannot be `None`.
/// - The value of `msg` must be a valid JSON,
///   that deserializes to this struct.
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct NftApproveMsg {
    /// Indicates the minimum price (in NEARs) requested by owner to pay for the token.
    pub min_price: U128,
}

/// Represents the payload that arrives to the Marketplace contract,
/// from our NFT implementation.
/// It contains the `min_price` of the token.
/// Additionally it is augmented with `gate_id` and `creator_id`
/// so the Marketplace can lookup by this fields.
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct MarketApproveMsg {
    /// Indicates the minimum price (in NEARs) that an account must pay to buy a token.
    pub min_price: U128,
    /// Represents the `gate_id` of the token being approved.
    pub gate_id: GateId,
    /// Represents the `creator_id` of the collectible of the token being approved.
    pub creator_id: AccountId,
}

#[near_ext]
#[ext_contract(market)]
pub trait NonFungibleTokenApprovalsReceiver {
    fn nft_on_approve(
        &mut self,
        token_id: TokenId,
        owner_id: ValidAccountId,
        approval_id: U64,
        msg: String,
    );

    fn nft_on_revoke(&mut self, token_id: TokenId);
}
