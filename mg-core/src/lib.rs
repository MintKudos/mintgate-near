#![deny(warnings)]

#[cfg(not(target_arch = "wasm"))]
pub mod mocked_context;

use fraction::Fraction;
use gate::{GateId, ValidGateId};
use near_env::PanicMessage;
use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    env,
    json_types::{U128, U64},
    serde::{Deserialize, Serialize},
    AccountId, CryptoHash,
};
use std::collections::HashMap;

/// The error variants thrown by *mg-core*.
#[derive(Serialize, PanicMessage)]
#[serde(crate = "near_sdk::serde", tag = "err")]
pub enum CorePanics {
    /// Thrown when a denominator in a `Fraction` is `0`.
    #[panic_msg = "Denominator must be a positive number, but was 0"]
    ZeroDenominatorFraction,
    /// Thrown when a `Fraction` is more than `1`.
    #[panic_msg = "The fraction must be less or equal to 1"]
    FractionGreaterThanOne,
}

pub mod fraction {

    use super::CorePanics;
    use near_sdk::{
        borsh::{self, BorshDeserialize, BorshSerialize},
        serde::{Deserialize, Serialize},
        Balance,
    };
    use std::{fmt::Display, num::ParseIntError, str::FromStr, u128};

    uint::construct_uint! {
        /// 256-bit unsigned integer.
        struct U256(4);
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
                CorePanics::ZeroDenominatorFraction.panic();
            }
            if self.num > self.den {
                CorePanics::FractionGreaterThanOne.panic();
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
}

pub mod gate {

    use near_sdk::{
        borsh::{self, BorshDeserialize, BorshSerialize},
        serde::{self, Serialize},
    };
    use std::convert::{TryFrom, TryInto};
    use std::fmt;

    /// The `GateId` type represents the identifier of each `Collectible`.
    /// This type is meant to be used internally by contracts.
    /// To pass around `GateId` in public interfaces, use `ValidGateId`.
    pub type GateId = String;

    /// Struct used to validate gate IDs during serialization and deserializiation.
    /// A valid `GateId` cannot be empty nor have more than 32 chars long.
    /// Moreover, these are the following valid chars for a `GateId`:
    ///
    /// > 'a'..='z' | 'A'..='Z' | '0'..='9' | '_' | '-'
    ///
    /// ## Examples
    ///
    /// ```
    /// use mg_core::gate::ValidGateId;
    /// use std::convert::TryFrom;
    ///
    /// assert!(ValidGateId::try_from("TGWN_P5W6QNX").is_ok());
    /// assert!(ValidGateId::try_from("YUF6J-4D6ZTB").is_ok());
    /// assert!(ValidGateId::try_from("RHFJS1LPQAS2").is_ok());
    /// assert!(ValidGateId::try_from("ALTRMDMNNMRT").is_ok());
    /// assert!(ValidGateId::try_from("VDvB2TS2xszCyQiCzSQEpD").is_ok());
    ///
    /// assert!(ValidGateId::try_from("VDvB2TS2.szCyQiCzSQEpD").is_err());
    /// assert!(ValidGateId::try_from("VDvB2TS2szCyQ/iCzSQEpD").is_err());
    /// assert!(ValidGateId::try_from("VDvB2TS2xszCyQiCzSQEpDVDvB2TS2xszCyQiCzSQEpD").is_err());
    /// assert!(ValidGateId::try_from("").is_err());
    /// ```
    ///
    /// ## Usage
    ///
    /// ```
    /// use mg_core::gate::ValidGateId;
    /// use near_sdk::serde_json;
    /// use std::convert::TryInto;
    /// use std::convert::TryFrom;
    ///
    /// let key: ValidGateId = serde_json::from_str("\"ALTRMDMNNMRT\"").unwrap();
    /// assert_eq!(key.to_string(), "ALTRMDMNNMRT".to_string());
    ///
    /// let key: ValidGateId = serde_json::from_str("\"VDvB2TS2xszCyQiCzSQEpD\"").unwrap();
    /// assert_eq!(key.to_string(), "VDvB2TS2xszCyQiCzSQEpD".to_string());
    ///
    /// let key: Result<ValidGateId, _> = serde_json::from_str("o7fSzsCYsSedUYRw5HmhTo7fSzsCYsSedUYRw5HmhT");
    /// assert!(key.is_err());
    ///
    /// let key: ValidGateId = "RHFJS1LPQAS2".try_into().unwrap();
    /// let actual: String = serde_json::to_string(&key).unwrap();
    /// assert_eq!(actual, "\"RHFJS1LPQAS2\"");
    ///
    /// let key = ValidGateId::try_from("RHFJS1LPQAS2").unwrap();
    /// assert_eq!(key.as_ref(), &"RHFJS1LPQAS2".to_string());
    /// ```
    #[derive(Debug, Clone, PartialEq, PartialOrd, BorshDeserialize, BorshSerialize, Serialize)]
    #[serde(crate = "near_sdk::serde")]
    pub struct ValidGateId(GateId);

    impl ValidGateId {
        fn is_valid(&self) -> bool {
            let gate_id = self.0.as_bytes();

            if gate_id.len() == 0 || gate_id.len() > 32 {
                return false;
            }

            for c in gate_id {
                match *c {
                    b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'_' | b'-' => {}
                    _ => return false,
                }
            }
            true
        }

        pub fn to_string(&self) -> String {
            self.0.clone()
        }
    }

    impl fmt::Display for ValidGateId {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "{}", self.0)
        }
    }

    impl AsRef<GateId> for ValidGateId {
        fn as_ref(&self) -> &GateId {
            &self.0
        }
    }

    impl<'de> serde::Deserialize<'de> for ValidGateId {
        fn deserialize<D>(deserializer: D) -> Result<Self, <D as serde::Deserializer<'de>>::Error>
        where
            D: serde::Deserializer<'de>,
        {
            let s = <String as serde::Deserialize>::deserialize(deserializer)?;
            s.try_into().map_err(|err: Box<dyn std::error::Error>| {
                serde::de::Error::custom(err.to_string())
            })
        }
    }

    impl TryFrom<&str> for ValidGateId {
        type Error = Box<dyn std::error::Error>;

        fn try_from(value: &str) -> Result<Self, Self::Error> {
            Self::try_from(value.to_string())
        }
    }

    impl TryFrom<String> for ValidGateId {
        type Error = Box<dyn std::error::Error>;

        fn try_from(value: String) -> Result<Self, Self::Error> {
            let res = Self(value);
            if res.is_valid() {
                Ok(res)
            } else {
                Err("The gate ID is invalid".into())
            }
        }
    }

    impl From<ValidGateId> for GateId {
        fn from(value: ValidGateId) -> Self {
            value.0
        }
    }
}

/// The `TokenId` type represents the identifier of each `Token`.
/// This type can be used in both public interfaces and internal `struct`s.
/// See https://github.com/near-examples/NFT/issues/117 for background.
pub type TokenId = U64;

/// Unix epoch, expressed in miliseconds.
/// Note that 64 bits `number`s cannot be represented in JavaScript,
/// thus maximum number allowed is `2^53`.
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

/// A `Collectible` represents something of value.
/// `Token`s can be then minted from a given collectible.
/// A collectible is identified by `gate_id`.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[cfg_attr(not(target_arch = "wasm"), derive(PartialEq, Debug))]
#[serde(crate = "near_sdk::serde")]
pub struct Collectible {
    /// The unique identifier of this `Collectible`.
    pub gate_id: GateId,
    /// The account id that created this `Collectible`.
    pub creator_id: AccountId,
    /// Indicates how many `Token`s can be minted out of this `Collectible`.
    pub current_supply: u16,
    /// The list of `TokenId`s actually minted out of this `Collectible`.
    pub minted_tokens: Vec<TokenId>,
    /// Indicates the royalty as percentage (in NEARs) to be paid to `creator_id`
    /// every time a minted token out of this `Collectible` is reselled.
    pub royalty: Fraction,
    /// Additional info provided by NEP-177.
    pub metadata: Metadata,
}

/// Represents a copy made out of a given collectible.
#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[cfg_attr(not(target_arch = "wasm"), derive(PartialEq, Debug, Deserialize))]
#[serde(crate = "near_sdk::serde")]
pub struct Token {
    /// The unique identifier for a `Token`.
    /// Any two different tokens, will have different `token_id`s,
    /// even if they belong to different `gate_id`s.
    pub token_id: TokenId,
    /// The collectible identifier for this `Token`.
    pub gate_id: GateId,
    /// The owner of this token.
    pub owner_id: AccountId,
    /// Represents when this `Token` was minted, in nanoseconds.
    /// Once this `Token` is minted, this field remains unchanged.
    pub created_at: Timestamp,
    /// Represents when this `Token` was last modified, in nanoseconds.
    /// Either when created or transferred.
    pub modified_at: Timestamp,
    /// Holds the list of accounts that can `transfer_token`s on behalf of the token's owner.
    /// It is mapped to the approval id and minimum amount that this token should be transfer for.
    pub approvals: HashMap<AccountId, TokenApproval>,
    /// Counter to assign next approval ID.
    pub approval_counter: U64,

    #[borsh_skip]
    /// Additional info defined by NEP-177.
    /// This `metadata` effectively joins fields from its respective `gate_id`.
    pub metadata: Metadata,
}

/// Associated metadata with a `GateId` as defined by NEP-177
///
/// Doc-comments for these fields were taken from:
/// <https://nomicon.io/Standards/NonFungibleToken/Metadata.html#interface>
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Default)]
#[cfg_attr(not(target_arch = "wasm"), derive(PartialEq, Debug))]
#[serde(crate = "near_sdk::serde")]
pub struct Metadata {
    /// ex. "Arch Nemesis: Mail Carrier" or "Parcel #5055".
    pub title: Option<String>,
    /// Free-form description.
    pub description: Option<String>,
    /// URL to associated media, preferably to decentralized, content-addressed storage.
    pub media: Option<String>,
    /// Base64-encoded sha256 hash of content referenced by the `media` field.
    /// Required if `media` is included.
    pub media_hash: Option<String>,
    /// Number of copies of this set of metadata in existence when token was minted.
    pub copies: Option<u16>,
    /// UNIX epoch datetime (in miliseconds) when token was issued or minted.
    pub issued_at: Option<Timestamp>,
    /// UNIX epoch datetime (in miliseconds) when token expires.
    pub expires_at: Option<Timestamp>,
    /// UNIX epoch datetime (in miliseconds) when token starts being valid.
    pub starts_at: Option<Timestamp>,
    /// UNIX epoch datetime (in miliseconds) when token was last updated.
    pub updated_at: Option<Timestamp>,
    /// Anything extra the NFT wants to store on-chain.
    /// It can be stringified JSON.
    pub extra: Option<String>,
    /// URL to an off-chain JSON file with more info.
    pub reference: Option<String>,
    /// Base64-encoded sha256 hash of JSON from reference field.
    /// Required if `reference` is included.
    pub reference_hash: Option<String>,
}

/// Represents an individual approval by some marketplace account id.
#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[cfg_attr(not(target_arch = "wasm"), derive(PartialEq, Debug, Deserialize))]
#[serde(crate = "near_sdk::serde")]
pub struct TokenApproval {
    /// Id used to avoid selling the same token more than once.
    pub approval_id: U64,
    /// Minimum price a token should be sell for.
    pub min_price: U128,
}

impl TokenApproval {
    #[cfg(not(target_arch = "wasm"))]
    pub fn new(approval_id: u64, min_price: U128) -> Self {
        Self { approval_id: approval_id.into(), min_price }
    }
}

/// Non-Fungible Token (NEP-171) v1.0.0
/// https://nomicon.io/Standards/NonFungibleToken/Core.html
///
/// Payouts is part of an ongoing (yet not settled) NEP spec:
/// <https://github.com/thor314/NEPs/blob/patch-5/specs/Standards/NonFungibleToken/payouts.md>
pub mod nep171 {

    use super::{Payout, Token, TokenId};
    use near_env::near_ext;
    use near_sdk::ext_contract;
    use near_sdk::json_types::{ValidAccountId, U128, U64};

    #[near_ext]
    #[ext_contract(nft)]
    pub trait NonFungibleTokenCore {
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

        fn nft_token(&self, token_id: TokenId) -> Option<Token>;
    }
}

/// Non-Fungible Token Metadata (NEP-177) v1.0.0
///
/// <https://nomicon.io/Standards/NonFungibleToken/Metadata.html>
pub mod nep177 {

    use near_sdk::{
        borsh::{self, BorshDeserialize, BorshSerialize},
        serde::{Deserialize, Serialize},
    };

    /// Associated metadata for the NFT contract as defined by NEP-177
    ///
    /// Doc-comments for these fields were taken from:
    /// <https://nomicon.io/Standards/NonFungibleToken/Metadata.html#interface>
    #[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Clone)]
    #[cfg_attr(not(target_arch = "wasm"), derive(PartialEq, Debug))]
    #[serde(crate = "near_sdk::serde", deny_unknown_fields)]
    pub struct NFTContractMetadata {
        /// Required, essentially a version like "nft-1.0.0".
        pub spec: String,
        /// Required, ex. "Mochi Rising — Digital Edition" or "Metaverse 3".
        pub name: String,
        /// Required, ex. "MOCHI".
        pub symbol: String,
        /// Data URL.
        pub icon: Option<String>,
        /// Centralized gateway known to have reliable access to decentralized storage assets referenced by `reference` or `media` URLs.
        pub base_uri: Option<String>,
        /// URL to a JSON file with more info.
        pub reference: Option<String>,
        /// Base64-encoded sha256 hash of JSON from reference field. Required if `reference` is included.
        pub reference_hash: Option<String>,
    }

    pub trait NonFungibleTokenMetadata {
        fn nft_metadata(&self) -> NFTContractMetadata;
    }
}

/// Non-Fungible Token Approval Management (NEP-178) v1.0.0
///
/// <https://nomicon.io/Standards/NonFungibleToken/ApprovalManagement.html>
pub mod nep178 {

    use super::{MarketApproveMsg, TokenId};
    use near_env::near_ext;
    use near_sdk::{
        ext_contract,
        json_types::{ValidAccountId, U64},
        Promise,
    };

    pub trait NonFungibleTokenApprovalMgmt {
        fn nft_approve(
            &mut self,
            token_id: TokenId,
            account_id: ValidAccountId,
            msg: Option<String>,
        ) -> Promise;

        fn nft_revoke(&mut self, token_id: TokenId, account_id: ValidAccountId) -> Promise;

        fn nft_revoke_all(&mut self, token_id: TokenId);
    }

    /// This interface defines methods to be called
    /// when approval or removal happened in a NFT contract.
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

        fn batch_on_approve(
            &mut self,
            tokens: Vec<(TokenId, MarketApproveMsg)>,
            owner_id: ValidAccountId,
        );

        fn nft_on_revoke(&mut self, token_id: TokenId);
    }
}

/// Non-Fungible Token Enumeration (NEP-181) v1.0.0
///
/// <https://nomicon.io/Standards/NonFungibleToken/Enumeration.html>
pub mod nep181 {

    use super::{Token, TokenId};
    use near_sdk::json_types::{ValidAccountId, U64};

    pub trait NonFungibleTokenEnumeration {
        fn nft_total_supply(&self) -> U64;

        fn nft_tokens(&self, from_index: Option<U64>, limit: Option<u32>) -> Vec<Token>;

        fn nft_supply_for_owner(&self, account_id: ValidAccountId) -> U64;

        fn nft_tokens_for_owner(
            &self,
            account_id: ValidAccountId,
            from_index: Option<U64>,
            limit: Option<u32>,
        ) -> Vec<Token>;

        fn nft_token_uri(&self, token_id: TokenId) -> Option<String>;
    }
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
    /// Represents the `gate_id` of the token being approved if present.
    pub gate_id: Option<ValidGateId>,
    /// Represents the `creator_id` of the collectible of the token being approved if present.
    pub creator_id: Option<AccountId>,
}
