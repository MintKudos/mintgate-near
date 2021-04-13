//! This module implements the NFT contract for the MintGate marketplace.
//! The MintGate marketplace consists of two main entities:
//!
//! - `Collectible`s
//! - `Token`s
//!
//! A `Collectible` represents a content that a creator wants to tokenize.
//! A `Token` represents a copy of a given `Collectible`.
//!
//! In addition, this contract implements the following NFT standards:
//!
//! - Non-Fungible Token NEP-171
//! <https://github.com/near/NEPs/blob/master/specs/Standards/NonFungibleToken/Core.md>
//! - Non-Fungible Token Metadata NEP-177
//! <https://github.com/near/NEPs/blob/master/specs/Standards/NonFungibleToken/Metadata.md>
//! - Non-Fungible Token Approval Management NEP-178
//! <https://github.com/near/NEPs/blob/master/specs/Standards/NonFungibleToken/ApprovalManagement.md>
//! - Non-Fungible Token Enumeration NEP-181
//! <https://github.com/near/NEPs/blob/master/specs/Standards/NonFungibleToken/Enumeration.md>
#![deny(warnings)]

use mg_core::{
    crypto_hash, Collectible, ContractMetadata, Fraction, GateId, MarketApproveMsg, NftApproveMsg,
    NonFungibleTokenApprovalMgmt, NonFungibleTokenCore, Token, TokenApproval, TokenId,
    TokenMetadata,
};
use near_env::{near_log, PanicMessage};
use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    collections::{LookupMap, UnorderedMap, UnorderedSet},
    env,
    json_types::{ValidAccountId, U64},
    log, near_bindgen,
    serde::Serialize,
    setup_alloc, AccountId, BorshStorageKey, CryptoHash, PanicOnDefault,
};
use std::{cmp::Ordering, collections::HashMap, convert::TryInto};

setup_alloc!();

/// Entry point data storage for mintgate core contract.
/// Since the contract needs custom initialization,
/// we use `PanicOnDefault` to avoid default construction.
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct NftContract {
    /// Represents a mapping from `GateId` into `Collectible`.
    collectibles: UnorderedMap<GateId, Collectible>,
    collectibles_by_creator: LookupMap<AccountId, UnorderedSet<GateId>>,
    tokens: UnorderedMap<TokenId, Token>,
    tokens_by_owner: LookupMap<AccountId, UnorderedSet<TokenId>>,
    /// Admin account is only account allowed to make certain calls.
    admin_id: AccountId,
    /// Metadata describing this NFT contract
    metadata: ContractMetadata,
    /// Indicates the minimum allowed `royalty` to be set on a `Collectible` when an Artist creates it.
    min_royalty: Fraction,
    /// Indicates the minimum allowed `royalty` to be set on a `Collectible` when an Artist creates it.
    max_royalty: Fraction,
}

/// To create a persistent collection on the blockchain, *e.g.*,
/// `UnorderedMap` or `LookupMap`,
/// a unique prefix key is needed to identify the collection.
/// These variants keep a list of the keys used for persistent collections.
#[derive(BorshSerialize, BorshStorageKey)]
enum Keys {
    Collectibles,
    CollectiblesByCreator,
    CollectiblesByCreatorValue { creator_id_hash: CryptoHash },
    Tokens,
    TokensByOwner,
    TokensByOwnerValue { owner_id_hash: CryptoHash },
}

#[derive(Serialize, PanicMessage)]
#[serde(crate = "near_sdk::serde", tag = "err")]
enum Panics {
    #[panic_msg = "Min royalty `{}` must be less or equal to max royalty `{}`"]
    MaxRoyaltyLessThanMinRoyalty { min_royalty: Fraction, max_royalty: Fraction },
    #[panic_msg = "Royalty `{}` of `{}` is less than min"]
    RoyaltyMinThanAllowed { royalty: Fraction, gate_id: String },
    #[panic_msg = "Royalty `{}` of `{}` is greater than max"]
    RoyaltyMaxThanAllowed { royalty: Fraction, gate_id: String },
    #[panic_msg = "Gate ID `{}` already exists"]
    GateIdAlreadyExists { gate_id: GateId },
    #[panic_msg = "Gate ID `{}` must have a positive supply"]
    ZeroSupplyNotAllowed { gate_id: GateId },
    #[panic_msg = "Gate ID `{}` was not found"]
    GateIdNotFound { gate_id: GateId },
    #[panic_msg = "Tokens for gate id `{}` have already been claimed"]
    GateIdExhausted { gate_id: GateId },
    #[panic_msg = "Token ID `{:?}` was not found"]
    TokenIdNotFound { token_id: U64 },
    #[panic_msg = "Token ID `{:?}` does not belong to account `{}`"]
    TokenIdNotOwnedBy { token_id: U64, owner_id: AccountId },
    #[panic_msg = "At most one approval is allowed per Token"]
    OneApprovalAllowed,
    #[panic_msg = "Sender `{}` is not authorized to make transfer"]
    SenderNotAuthToTransfer { sender_id: AccountId },
    #[panic_msg = "The token owner and the receiver should be different"]
    ReceiverIsOwner,
    #[panic_msg = "The approval_id is different from enforce_approval_id"]
    EnforceApprovalFailed,
    #[panic_msg = "The msg argument must contain the minimum price"]
    MsgFormatNotRecognized,
    #[panic_msg = "Could not find min_price in msg: {}"]
    MsgFormatMinPriceMissing { reason: String },
    #[panic_msg = "Could not revoke approval for `{}`"]
    RevokeApprovalFailed { account_id: AccountId },
}

#[near_log(skip_args, only_pub)]
#[near_bindgen]
impl NftContract {
    /// Initializes the contract.
    /// This contract methods needs to be explicitely called
    /// since the default construction of the contract will panic.
    ///
    /// - `admin_id` is the valid account that is allowed to perform certain operations.
    /// - `metadata` represents the general information of the contract.
    /// - `min_royalty` and `max_royalty` indicates what must be the max and min royalty respectively when creating a collectible.
    #[init]
    pub fn init(
        admin_id: ValidAccountId,
        metadata: ContractMetadata,
        min_royalty: Fraction,
        max_royalty: Fraction,
    ) -> Self {
        min_royalty.check();
        max_royalty.check();

        if max_royalty.cmp(&min_royalty) == Ordering::Less {
            Panics::MaxRoyaltyLessThanMinRoyalty { min_royalty, max_royalty }.panic();
        }

        Self {
            collectibles: UnorderedMap::new(Keys::Collectibles),
            collectibles_by_creator: LookupMap::new(Keys::CollectiblesByCreator),
            tokens: UnorderedMap::new(Keys::Tokens),
            tokens_by_owner: LookupMap::new(Keys::TokensByOwner),
            admin_id: admin_id.as_ref().to_string(),
            metadata,
            min_royalty,
            max_royalty,
        }
    }

    /// Creates a new `Collectible`, identified by `gate_id`.
    /// The `supply` indicates maximum supply for this collectible.
    /// The `royalty` indicates the royalty (as percentage) paid to the creator (`predecessor_account_id`).
    /// This royalty is paid when any `Token` is being resold in any marketplace.
    ///
    /// See <https://github.com/epam/mintgate/issues/3>.
    pub fn create_collectible(
        &mut self,
        gate_id: String,
        title: String,
        description: String,
        supply: U64,
        gate_url: String,
        royalty: Fraction,
    ) {
        royalty.check();
        if royalty.cmp(&self.min_royalty) == Ordering::Less {
            Panics::RoyaltyMinThanAllowed { royalty, gate_id }.panic();
        }
        if royalty.cmp(&self.max_royalty) == Ordering::Greater {
            Panics::RoyaltyMaxThanAllowed { royalty, gate_id }.panic();
        }
        if self.collectibles.get(&gate_id).is_some() {
            Panics::GateIdAlreadyExists { gate_id }.panic();
        }
        if supply.0 == 0 {
            Panics::ZeroSupplyNotAllowed { gate_id }.panic();
        }

        // if env::predecessor_account_id() != admin_id {
        //     panic();
        // }

        let creator_id = env::predecessor_account_id();

        let collectible = Collectible {
            gate_id,
            creator_id,
            current_supply: supply,
            gate_url,
            minted_tokens: Vec::new(),
            royalty,
            metadata: TokenMetadata {
                title: Some(title),
                description: Some(description),
                media: None,
                media_hash: None,
                copies: Some(supply),
                issued_at: None,
                expires_at: None,
                starts_at: None,
                updated_at: None,
                extra: None,
                reference: None,
                reference_hash: None,
            },
        };
        self.collectibles.insert(&collectible.gate_id, &collectible);

        let mut gids =
            self.collectibles_by_creator.get(&collectible.creator_id).unwrap_or_else(|| {
                UnorderedSet::new(Keys::CollectiblesByCreatorValue {
                    creator_id_hash: crypto_hash(&collectible.creator_id),
                })
            });
        gids.insert(&collectible.gate_id);

        self.collectibles_by_creator.insert(&collectible.creator_id, &gids);
    }

    /// Returns the `Collectible` with the given `gate_id`.
    /// Panics otherwise.
    ///
    /// See <https://github.com/epam/mintgate/issues/16>.
    pub fn get_collectible_by_gate_id(&self, gate_id: String) -> Option<Collectible> {
        match self.collectibles.get(&gate_id) {
            None => None,
            Some(collectible) => {
                assert!(collectible.gate_id == gate_id);
                Some(collectible)
            }
        }
    }

    /// Returns all `Collectible`s created by `creator_id`.
    ///
    /// See <https://github.com/epam/mintgate/issues/15>.
    pub fn get_collectibles_by_creator(&self, creator_id: ValidAccountId) -> Vec<Collectible> {
        match self.collectibles_by_creator.get(creator_id.as_ref()) {
            None => Vec::new(),
            Some(list) => list
                .iter()
                .map(|gate_id| {
                    let collectible = self.collectibles.get(&gate_id).expect("Gate Id not found");
                    assert!(collectible.gate_id == gate_id);
                    assert!(&collectible.creator_id == creator_id.as_ref());
                    collectible
                })
                .collect(),
        }
    }

    /// Claims a `Token` for the `Collectible` indicated by `gate_id`.
    /// The claim is on behalf the `predecessor_account_id`.
    /// Returns a `TokenId` that represents this claim.
    /// If the given `gate_id` has exhausted its supply, this call will panic.
    ///
    /// See <https://github.com/epam/mintgate/issues/6>.
    pub fn claim_token(&mut self, gate_id: String) -> TokenId {
        match self.collectibles.get(&gate_id) {
            None => Panics::GateIdNotFound { gate_id }.panic(),
            Some(mut collectible) => {
                if collectible.current_supply.0 == 0 {
                    Panics::GateIdExhausted { gate_id }.panic()
                }

                let owner_id = env::predecessor_account_id();
                let now = env::block_timestamp();

                let token_id = self.tokens.len();
                let token = Token {
                    token_id: U64::from(token_id),
                    gate_id: gate_id.clone(),
                    owner_id,
                    created_at: now,
                    modified_at: now,
                    sender_id: "".to_string(),
                    approvals: HashMap::new(),
                    approval_counter: U64::from(0),
                };
                self.insert_token(&token);

                collectible.current_supply.0 = collectible.current_supply.0 - 1;
                self.collectibles.insert(&gate_id, &collectible);

                U64::from(token_id)
            }
        }
    }

    /// Returns all `Token`s owned by `owner_id`.
    pub fn get_tokens_by_owner(&self, owner_id: ValidAccountId) -> Vec<Token> {
        match self.tokens_by_owner.get(owner_id.as_ref()) {
            None => Vec::new(),
            Some(list) => list
                .iter()
                .map(|token_id| {
                    let token = self.tokens.get(&token_id).expect("Token not found");
                    assert!(token.token_id == token_id);
                    assert!(&token.owner_id == owner_id.as_ref());
                    token
                })
                .collect(),
        }
    }

    /// Returns all tokens claimed by `owner_id` belonging to `gate_id`.
    ///
    /// See <https://github.com/epam/mintgate/issues/14>.
    pub fn get_tokens_by_owner_and_gate_id(
        &self,
        gate_id: GateId,
        owner_id: ValidAccountId,
    ) -> Vec<Token> {
        match self.tokens_by_owner.get(owner_id.as_ref()) {
            None => Vec::new(),
            Some(list) => list
                .iter()
                .map(|token_id| {
                    let token = self.tokens.get(&token_id).expect("Token not found");
                    assert!(token.token_id == token_id);
                    assert!(&token.owner_id == owner_id.as_ref());
                    token
                })
                .filter(|token| token.gate_id == gate_id)
                .collect(),
        }
    }

    /// Gets the `Token` with given `token_id`.
    /// Panics otherwise.
    fn get_token(&self, token_id: TokenId) -> Token {
        match self.tokens.get(&token_id) {
            None => Panics::TokenIdNotFound { token_id }.panic(),
            Some(token) => {
                assert!(token.token_id == token_id);
                token
            }
        }
    }

    /// Inserts the given `Token` into `tokens` and `tokens_by_owner`.
    fn insert_token(&mut self, token: &Token) {
        self.tokens.insert(&token.token_id, token);

        let mut tids = self.tokens_by_owner.get(&token.owner_id).unwrap_or_else(|| {
            UnorderedSet::new(Keys::TokensByOwnerValue {
                owner_id_hash: crypto_hash(&token.owner_id),
            })
        });
        tids.insert(&token.token_id);

        self.tokens_by_owner.insert(&token.owner_id, &tids);
    }

    /// Internal method to delete the corgi with `id` owned by `owner`.
    /// Panics if `owner` does not own the corgi with `id`.
    fn delete_token_from(&mut self, token_id: TokenId, owner_id: &AccountId) {
        match self.tokens_by_owner.get(&owner_id) {
            None => Panics::TokenIdNotOwnedBy { token_id, owner_id: owner_id.clone() }.panic(),
            Some(mut list) => {
                if !list.remove(&token_id) {
                    Panics::TokenIdNotOwnedBy { token_id, owner_id: owner_id.clone() }.panic();
                }
                self.tokens_by_owner.insert(&owner_id, &list);

                let was_removed = self.tokens.remove(&token_id);
                assert!(was_removed.is_some());
            }
        }
    }
}

#[near_log(skip_args, only_pub)]
#[near_bindgen]
impl NonFungibleTokenCore for NftContract {
    /// Returns the NFT metadata for this contract.
    fn nft_metadata(&self) -> ContractMetadata {
        self.metadata.clone()
    }

    /// Transfer the token `token_id` to the `receiver_id` account.
    ///
    /// See <https://github.com/epam/mintgate/issues/18>.
    fn nft_transfer(
        &mut self,
        receiver_id: ValidAccountId,
        token_id: TokenId,
        enforce_approval_id: Option<U64>,
        memo: Option<String>,
    ) {
        let sender_id = env::predecessor_account_id();
        let mut token = self.get_token(token_id);

        if sender_id != token.owner_id && token.approvals.get(&sender_id).is_none() {
            Panics::SenderNotAuthToTransfer { sender_id }.panic();
        }

        if &token.owner_id == receiver_id.as_ref() {
            Panics::ReceiverIsOwner.panic();
        }

        if let Some(enforce_approval_id) = enforce_approval_id {
            let TokenApproval { approval_id, min_price: _ } = token
                .approvals
                .get(receiver_id.as_ref())
                .expect("Receiver not an approver of this token.");
            if approval_id != &enforce_approval_id {
                Panics::EnforceApprovalFailed.panic();
            }
        }

        if let Some(memo) = memo {
            log!("Memo: {}", memo);
        }

        self.delete_token_from(token_id, &token.owner_id);

        token.owner_id = receiver_id.as_ref().to_string();
        token.sender_id = sender_id;
        token.modified_at = env::block_timestamp();
        self.insert_token(&token);
    }

    /// Returns the total token supply.
    fn nft_total_supply(&self) -> U64 {
        U64::from(self.tokens.len())
    }

    /// Returns the token identified by `token_id`.
    /// Or `null` if the `token_id` was not found.
    ///
    /// See <https://github.com/epam/mintgate/issues/17>.
    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.get(&token_id)
    }
}

#[near_log(skip_args, only_pub)]
#[near_bindgen]
impl NonFungibleTokenApprovalMgmt for NftContract {
    /// Allows `account_id` to transfer `token_id` on behalf of its owner.
    /// The `msg` argument allows the caller to pass into additional information.
    /// A contract implementing the `nft_on_approve` methods must be
    /// deployed into `account_id`.
    fn nft_approve(&mut self, token_id: TokenId, account_id: ValidAccountId, msg: Option<String>) {
        let min_price = {
            if let Some(msg) = msg.clone() {
                match near_sdk::serde_json::from_str::<NftApproveMsg>(&msg) {
                    Ok(approve_msg) => approve_msg.min_price,
                    Err(err) => {
                        Panics::MsgFormatMinPriceMissing { reason: err.to_string() }.panic()
                    }
                }
            } else {
                Panics::MsgFormatNotRecognized.panic();
            }
        };

        let owner_id = env::predecessor_account_id();

        let mut token = self.get_token(token_id);

        if &owner_id != &token.owner_id {
            Panics::TokenIdNotOwnedBy { token_id, owner_id }.panic();
        }

        if token.approvals.len() > 0 {
            Panics::OneApprovalAllowed.panic();
        }

        token.approval_counter.0 = token.approval_counter.0 + 1;
        token.approvals.insert(
            account_id.clone().into(),
            TokenApproval { approval_id: token.approval_counter, min_price },
        );
        self.tokens.insert(&token_id, &token);

        match self.collectibles.get(&token.gate_id) {
            None => Panics::GateIdNotFound { gate_id: token.gate_id }.panic(),
            Some(collectible) => {
                let market_msg = MarketApproveMsg {
                    min_price,
                    gate_id: token.gate_id,
                    creator_id: collectible.creator_id,
                    royalty: collectible.royalty,
                };
                mg_core::market::nft_on_approve(
                    token_id,
                    owner_id.try_into().unwrap(),
                    U64::from(token.approval_counter),
                    near_sdk::serde_json::to_string(&market_msg).unwrap(),
                    account_id.as_ref(),
                    0,
                    env::prepaid_gas() / 2,
                );
            }
        }
    }

    /// Revokes approval for `token_id` from `account_id`.
    fn nft_revoke(&mut self, token_id: TokenId, account_id: ValidAccountId) {
        let owner_id = env::predecessor_account_id();
        let mut token = self.get_token(token_id);
        if &owner_id != &token.owner_id {
            Panics::TokenIdNotOwnedBy { token_id, owner_id }.panic();
        }
        if token.approvals.remove(account_id.as_ref()).is_none() {
            Panics::RevokeApprovalFailed { account_id: account_id.to_string() }.panic();
        }
        self.tokens.insert(&token_id, &token);
    }

    /// Revokes all approval for `token_id`.
    fn nft_revoke_all(&mut self, token_id: TokenId) {
        let owner_id = env::predecessor_account_id();
        let mut token = self.get_token(token_id);
        if &owner_id != &token.owner_id {
            Panics::TokenIdNotOwnedBy { token_id, owner_id }.panic();
        }
        token.approvals.clear();
        self.tokens.insert(&token_id, &token);
    }
}
