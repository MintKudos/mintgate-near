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
    NonFungibleTokenApprovalMgmt, NonFungibleTokenCore, Payout, Token, TokenApproval, TokenId,
    TokenMetadata, ValidGateId,
};
use near_env::{near_log, PanicMessage};
use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    collections::{LookupMap, UnorderedMap, UnorderedSet},
    env,
    json_types::{ValidAccountId, U128, U64},
    log, near_bindgen,
    serde::Serialize,
    setup_alloc, AccountId, BorshStorageKey, CryptoHash, PanicOnDefault, Promise,
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
    /// Percentage fee to pay back to Mintgate when a `Token` is being sold.
    /// This field can be set up when the contract is deployed.
    mintgate_fee: Fraction,
    /// Designated MintGate NEAR account id to receive `mintgate_fee` after a sale.
    mintgate_fee_account_id: AccountId,
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
pub enum Panics {
    #[panic_msg = "Min royalty `{}` must be less or equal to max royalty `{}`"]
    MaxRoyaltyLessThanMinRoyalty { min_royalty: Fraction, max_royalty: Fraction },
    #[panic_msg = "Royalty `{}` of `{}` is less than min"]
    RoyaltyMinThanAllowed { royalty: Fraction, gate_id: String },
    #[panic_msg = "Royalty `{}` of `{}` is greater than max"]
    RoyaltyMaxThanAllowed { royalty: Fraction, gate_id: String },
    #[panic_msg = "Royalty `{}` is too large for the given NFT fee `{}`"]
    RoyaltyTooLarge { royalty: Fraction, mintgate_fee: Fraction },
    #[panic_msg = "Gate ID `{}` already exists"]
    GateIdAlreadyExists { gate_id: GateId },
    #[panic_msg = "Gate ID `{}` must have a positive supply"]
    ZeroSupplyNotAllowed { gate_id: GateId },
    #[panic_msg = "Gate ID `{}` was not found"]
    GateIdNotFound { gate_id: GateId },
    #[panic_msg = "Tokens for gate id `{}` have already been claimed"]
    GateIdExhausted { gate_id: GateId },
    #[panic_msg = "Gate ID `{}` has already some claimed tokens"]
    GateIdHasTokens { gate_id: GateId },
    #[panic_msg = "Unable to delete gate ID `{}`"]
    NotAuthorized { gate_id: GateId },
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

/// Methods for the NFT contract.
/// Methods belonging to a NEP Standard are implemented in their own interfaces.
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
    /// - `mintgate_fee` is the percetange to be paid to `mintgate_fee_account_id` for each sale.
    #[init]
    pub fn init(
        admin_id: ValidAccountId,
        metadata: ContractMetadata,
        min_royalty: Fraction,
        max_royalty: Fraction,
        mintgate_fee: Fraction,
        mintgate_fee_account_id: ValidAccountId,
    ) -> Self {
        min_royalty.check();
        max_royalty.check();
        mintgate_fee.check();

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
            mintgate_fee,
            mintgate_fee_account_id: mintgate_fee_account_id.to_string(),
        }
    }

    /// Creates a new `Collectible`, identified by `gate_id`.
    /// The `supply` indicates maximum supply for this collectible.
    /// The `royalty` indicates the royalty (as percentage) paid to the creator (`predecessor_account_id`).
    /// This royalty is paid when any `Token` is being resold in any marketplace.
    ///
    /// The sum of `royalty` and `mintgate_fee` should be less than `1`.
    /// Panics otherwise.
    /// This is to be able to make payouts all participants.
    ///
    /// See <https://github.com/epam/mintgate/issues/3>.
    pub fn create_collectible(
        &mut self,
        gate_id: ValidGateId,
        title: String,
        description: String,
        supply: U64,
        gate_url: String,
        royalty: Fraction,
    ) {
        let gate_id = gate_id.to_string();

        royalty.check();

        if royalty.cmp(&self.min_royalty) == Ordering::Less {
            Panics::RoyaltyMinThanAllowed { royalty, gate_id }.panic();
        }
        if royalty.cmp(&self.max_royalty) == Ordering::Greater {
            Panics::RoyaltyMaxThanAllowed { royalty, gate_id }.panic();
        }
        let bn = 1_000_000_000_000_000_000_000;
        if self.mintgate_fee.mult(bn) + royalty.mult(bn) >= bn {
            Panics::RoyaltyTooLarge { royalty, mintgate_fee: self.mintgate_fee }.panic();
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
    pub fn get_collectible_by_gate_id(&self, gate_id: ValidGateId) -> Option<Collectible> {
        let gate_id = gate_id.to_string();

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

    /// Deletes the given `Collectible` by `gate_id`.
    /// The collectible can only be deleted if there are no minted tokens.
    /// Moreover, only the `creator_id` of the collectible or
    /// the contract `admin_id` are allowed to delete the collectible.
    pub fn delete_collectible(&mut self, gate_id: ValidGateId) {
        let gate_id: GateId = From::from(gate_id);
        match self.collectibles.get(&gate_id) {
            None => Panics::GateIdNotFound { gate_id }.panic(),
            Some(collectible) => {
                assert!(collectible.gate_id == gate_id);

                if !collectible.minted_tokens.is_empty() {
                    Panics::GateIdHasTokens { gate_id }.panic();
                }

                let pred_id = env::predecessor_account_id();
                if pred_id == collectible.creator_id || pred_id == self.admin_id {
                    self.collectibles.remove(&gate_id).unwrap();
                } else {
                    Panics::NotAuthorized { gate_id }.panic();
                }
            }
        }
    }

    /// Claims a `Token` for the `Collectible` indicated by `gate_id`.
    /// The claim is on behalf the `predecessor_account_id`.
    /// Returns a `TokenId` that represents this claim.
    /// If the given `gate_id` has exhausted its supply, this call will panic.
    ///
    /// See <https://github.com/epam/mintgate/issues/6>.
    pub fn claim_token(&mut self, gate_id: ValidGateId) -> TokenId {
        let gate_id = gate_id.to_string();

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
                collectible.minted_tokens.push(U64(token_id));
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
        gate_id: ValidGateId,
        owner_id: ValidAccountId,
    ) -> Vec<Token> {
        let gate_id = gate_id.to_string();

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
        token.approvals.clear();
        self.insert_token(&token);
    }

    /// Query whom to be paid out for a given `token_id`, derived from some `balance`.
    /// For example, given the following settings for the NFT contract and collectible `gate_id`:
    ///
    /// - `mintgate_fee`: `25/1000` (2.5%)
    /// - `royalty`: `30/100` (30%)
    ///
    /// Then `nft_payout(token_id, 5_000_000)` will return
    ///
    /// - `mintgate_fee_account_id` -> 125_000
    /// - `collectible.creator_id` -> 3_375_000
    /// - `token.owner_id` -> 1_500_000
    ///
    /// for any `token_id` claimed from `gate_id`.
    ///
    /// This is part of an ongoing (yet not settled) NEP spec:
    /// <https://github.com/thor314/NEPs/blob/patch-5/specs/Standards/NonFungibleToken/payouts.md>
    fn nft_payout(&self, token_id: TokenId, balance: U128) -> Payout {
        let token = self.get_token(token_id);
        match self.collectibles.get(&token.gate_id) {
            None => Panics::GateIdNotFound { gate_id: token.gate_id }.panic(),
            Some(collectible) => {
                let royalty_amount = collectible.royalty.mult(balance.0);
                let fee_amount = self.mintgate_fee.mult(balance.0);
                let owner_amount = balance.0 - royalty_amount - fee_amount;
                let entries = vec![
                    (collectible.creator_id, royalty_amount),
                    (self.mintgate_fee_account_id.clone(), fee_amount),
                    (token.owner_id, owner_amount),
                ];

                let mut payout = HashMap::new();
                for (account_id, amount) in entries {
                    payout.entry(account_id).or_insert(U128(0)).0 += amount;
                }
                payout
            }
        }
    }

    /// Attempts to transfer the token.
    /// Afterwards returns the payout data.
    /// Effectively it is calling `nft_transfer` followed by `nft_payout`.
    ///
    /// This is part of an ongoing (yet not settled) NEP spec:
    /// <https://github.com/thor314/NEPs/blob/patch-5/specs/Standards/NonFungibleToken/payouts.md>
    fn nft_transfer_payout(
        &mut self,
        receiver_id: ValidAccountId,
        token_id: TokenId,
        approval_id: Option<U64>,
        memo: Option<String>,
        balance: Option<U128>,
    ) -> Option<Payout> {
        let payout = balance.map(|balance| self.nft_payout(token_id, balance));
        self.nft_transfer(receiver_id, token_id, approval_id, memo);
        payout
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
    fn nft_approve(
        &mut self,
        token_id: TokenId,
        account_id: ValidAccountId,
        msg: Option<String>,
    ) -> Promise {
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
                    gate_id: Some(token.gate_id.try_into().unwrap()),
                    creator_id: Some(collectible.creator_id),
                };
                mg_core::market::nft_on_approve(
                    token_id,
                    owner_id.try_into().unwrap(),
                    U64::from(token.approval_counter),
                    near_sdk::serde_json::to_string(&market_msg).unwrap(),
                    account_id.as_ref(),
                    0,
                    env::prepaid_gas() / 2,
                )
            }
        }
    }

    /// Revokes approval for `token_id` from `account_id`.
    fn nft_revoke(&mut self, token_id: TokenId, account_id: ValidAccountId) -> Promise {
        let owner_id = env::predecessor_account_id();
        let mut token = self.get_token(token_id);
        if &owner_id != &token.owner_id {
            Panics::TokenIdNotOwnedBy { token_id, owner_id }.panic();
        }
        if token.approvals.remove(account_id.as_ref()).is_none() {
            Panics::RevokeApprovalFailed { account_id: account_id.to_string() }.panic();
        }
        self.tokens.insert(&token_id, &token);
        mg_core::market::nft_on_revoke(token_id, account_id.as_ref(), 0, env::prepaid_gas() / 2)
    }

    /// Revokes all approval for `token_id`.
    fn nft_revoke_all(&mut self, token_id: TokenId) {
        let owner_id = env::predecessor_account_id();
        let mut token = self.get_token(token_id);
        if &owner_id != &token.owner_id {
            Panics::TokenIdNotOwnedBy { token_id, owner_id }.panic();
        }
        for (nft_id, _) in &token.approvals {
            mg_core::market::nft_on_revoke(token_id, nft_id, 0, env::prepaid_gas() / 2);
        }

        token.approvals.clear();
        self.tokens.insert(&token_id, &token);
    }
}
