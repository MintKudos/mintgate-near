//! This module implement the MintGate marketplace.
#![deny(warnings)]

use std::convert::TryInto;

use mg_core::{Fraction, GateId, MarketApproveMsg, NonFungibleTokenApprovalsReceiver, TokenId};
use near_env::{near_log, PanicMessage};
use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    collections::{LookupMap, UnorderedMap, UnorderedSet},
    env,
    json_types::{ValidAccountId, U128, U64},
    near_bindgen,
    serde::{Deserialize, Serialize},
    serde_json, setup_alloc, AccountId, BorshStorageKey, PanicOnDefault, Promise,
};

setup_alloc!();

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct MarketContract {
    /// Percentage fee to pay back to Mintgate when a `Token` is being sold.
    /// This field can be set up when the contract is deployed.
    mintgate_fee: Fraction,
    /// Lists all tokens for sale.
    tokens_for_sale: UnorderedMap<TokenId, TokenForSale>,
    /// Token gate id
    tokens_by_gate_id: LookupMap<GateId, UnorderedSet<TokenId>>,
    /// Token gate id
    tokens_by_owner_id: LookupMap<AccountId, UnorderedSet<TokenId>>,
    /// Token gate id
    tokens_by_creator_id: LookupMap<AccountId, UnorderedSet<TokenId>>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenForSale {
    pub owner_id: AccountId,
    pub approval_id: U64,
    pub min_price: U128,
}

// fn asdf() {
//     marketplace_clearance:

//     pay Fee to AdminAccountId

//     read Royalty (%, CreatorAccountId)

//     pay Royalty to CreatorAccountId

//     pay remaining to currentOwnerId

//     call nft_transfer(tokeId, newOwnerId)
// }

// fn pay_royalty () {
// //
// accountId -> marketplace accountminAmount -> sell price

// Selling price: 5NMarktplace fee: 10%, 0.5N = 4.5NRoyalty: 10%, 0.45N = 4.05N

// Selling price: 5NMarketplace adds royalty: 10%: 5.5NMarketplace adds fee: 10%: 6.05NSelling price: 6.05N

// }

#[derive(BorshSerialize, BorshStorageKey)]
enum Keys {
    TokensForSale,
    TokensByGateId,
    // TokensByGateIdValue { token_id: TokenId },
    TokensByGateIdValue(TokenId),
    TokensByOwnerId,
    // TokensByOwnerIdValue { token_id: TokenId },
    TokensByOwnerIdValue(TokenId),
    TokensByCreatorId,
    // TokensByCreatorIdValue { token_id: TokenId },
    TokensByCreatorIdValue(TokenId),
}

#[derive(Serialize, PanicMessage)]
#[serde(crate = "near_sdk::serde", tag = "err")]
enum Panics {
    #[panic_msg = "Could not find min_price in msg: {}"]
    MsgFormatMinPriceMissing { reason: String },
    #[panic_msg = "Token ID `{:?}` was not found"]
    TokenIdNotFound { token_id: TokenId },
}

#[near_log(skip_args, only_pub)]
#[near_bindgen]
impl MarketContract {
    /// Initializes the Market contract.
    ///
    /// - `mintgate_fee`: Indicates what percetage MintGate charges for a sale.
    #[init]
    pub fn init(mintgate_fee: Fraction) -> Self {
        mintgate_fee.check();

        Self {
            mintgate_fee,
            tokens_for_sale: UnorderedMap::new(Keys::TokensForSale),
            tokens_by_gate_id: LookupMap::new(Keys::TokensByGateId),
            tokens_by_owner_id: LookupMap::new(Keys::TokensByOwnerId),
            tokens_by_creator_id: LookupMap::new(Keys::TokensByCreatorId),
        }
    }

    /// Returns all available `TokenId`s for sale.
    /// Use the `nft_on_approve` method to add an item for sale.
    pub fn get_tokens_for_sale(&self) -> Vec<TokenId> {
        let mut result = Vec::new();
        for (token_id, _) in self.tokens_for_sale.iter() {
            result.push(token_id);
        }
        result
    }

    /// Returns all `TokenId`s for sale whose collectible's gate ID is `gate_id`.
    pub fn get_tokens_by_gate_id(&self, gate_id: GateId) -> Vec<TokenId> {
        get_tokens_by(&self.tokens_by_gate_id, &gate_id)
    }

    /// Returns all `TokenId`s for sale owned by `owner_id`.
    pub fn get_tokens_by_owner_id(&self, owner_id: ValidAccountId) -> Vec<TokenId> {
        get_tokens_by(&self.tokens_by_owner_id, owner_id.as_ref())
    }

    /// Returns all `TokenId`s for sale whose collectible's creator ID is `creator_id`.
    pub fn get_tokens_by_creator_id(&self, creator_id: ValidAccountId) -> Vec<TokenId> {
        get_tokens_by(&self.tokens_by_creator_id, creator_id.as_ref())
    }

    /// Buys the token.
    #[payable]
    pub fn buy_token(&mut self, token_id: TokenId) {
        if let Some(TokenForSale { owner_id, min_price, .. }) = self.tokens_for_sale.get(&token_id)
        {
            let nft_id = env::signer_account_id();
            let receiver_id = env::predecessor_account_id();

            mg_core::nft::nft_transfer(
                receiver_id.try_into().unwrap(),
                token_id,
                None,
                None,
                &nft_id,
                0,
                env::prepaid_gas() / 4,
            );

            Promise::new(owner_id).transfer(min_price.0);
        } else {
            Panics::TokenIdNotFound { token_id }.panic();
        }
    }
}

#[near_log(skip_args, only_pub)]
#[near_bindgen]
impl NonFungibleTokenApprovalsReceiver for MarketContract {
    /// Callback method to allow this contract to put a `Token` into the marketplace.
    fn nft_on_approve(
        &mut self,
        token_id: TokenId,
        owner_id: ValidAccountId,
        approval_id: U64,
        msg: String,
    ) {
        match serde_json::from_str::<MarketApproveMsg>(&msg) {
            Ok(approve_msg) => {
                self.tokens_for_sale.insert(
                    &token_id,
                    &TokenForSale {
                        owner_id: owner_id.clone().into(),
                        approval_id,
                        min_price: approve_msg.min_price,
                    },
                );

                append(
                    &mut self.tokens_by_gate_id,
                    &approve_msg.gate_id,
                    token_id,
                    Keys::TokensByGateIdValue,
                );
                append(
                    &mut self.tokens_by_owner_id,
                    &owner_id.into(),
                    token_id,
                    Keys::TokensByOwnerIdValue,
                );
                append(
                    &mut self.tokens_by_creator_id,
                    &approve_msg.creator_id,
                    token_id,
                    Keys::TokensByCreatorIdValue,
                );
            }
            Err(err) => {
                let reason = err.to_string();
                Panics::MsgFormatMinPriceMissing { reason }.panic();
            }
        }
    }
}

fn append<K: BorshSerialize, F: FnOnce(TokenId) -> Keys>(
    tokens_map: &mut LookupMap<K, UnorderedSet<TokenId>>,
    key: &K,
    token_id: TokenId,
    f: F,
) {
    let mut tids = tokens_map.get(&key).unwrap_or_else(|| UnorderedSet::new(f(token_id)));
    tids.insert(&token_id);
    tokens_map.insert(key, &tids);
}

fn get_tokens_by<K: BorshSerialize>(
    tokens_map: &LookupMap<K, UnorderedSet<TokenId>>,
    key: &K,
) -> Vec<TokenId> {
    tokens_map.get(&key).map_or_else(Vec::new, |s| s.to_vec())
}
