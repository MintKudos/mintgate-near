//! This module implement the MintGate marketplace.
#![deny(warnings)]

use std::convert::TryInto;

use mg_core::{
    crypto_hash, GateId, MarketApproveMsg, NonFungibleTokenApprovalsReceiver, Payout, TokenId,
};
use near_env::{near_ext, near_log, PanicMessage};
use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    collections::{LookupMap, UnorderedMap, UnorderedSet},
    env, ext_contract,
    json_types::{ValidAccountId, U128, U64},
    near_bindgen,
    serde::Serialize,
    serde_json, setup_alloc, AccountId, Balance, BorshStorageKey, CryptoHash, Gas, PanicOnDefault,
    Promise, PromiseResult,
};

setup_alloc!();

const GAS_FOR_ROYALTIES: Gas = 120_000_000_000_000;
const NO_DEPOSIT: Balance = 0;

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct MarketContract {
    /// Lists all tokens for sale.
    tokens_for_sale: UnorderedMap<TokenId, TokenForSale>,
    /// Holds token IDs for sale by `gate_id`.
    tokens_by_gate_id: LookupMap<GateId, UnorderedSet<TokenId>>,
    /// Holds token IDs for sale by `owner_id`.
    tokens_by_owner_id: LookupMap<AccountId, UnorderedSet<TokenId>>,
    /// Holds token IDs for sale by `creator_id`.
    tokens_by_creator_id: LookupMap<AccountId, UnorderedSet<TokenId>>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenForSale {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub approval_id: U64,
    pub min_price: U128,
    pub nft_id: AccountId,
    pub gate_id: GateId,
    pub creator_id: AccountId,
}

#[derive(BorshSerialize, BorshStorageKey)]
enum Keys {
    TokensForSale,
    TokensByGateId,
    TokensByGateIdValue(CryptoHash),
    TokensByOwnerId,
    TokensByOwnerIdValue(CryptoHash),
    TokensByCreatorId,
    TokensByCreatorIdValue(CryptoHash),
}

#[derive(Serialize, PanicMessage)]
#[serde(crate = "near_sdk::serde", tag = "err")]
enum Panics {
    #[panic_msg = "Could not find min_price in msg: {}"]
    MsgFormatMinPriceMissing { reason: String },
    #[panic_msg = "Token ID `{:?}` was not found"]
    TokenIdNotFound { token_id: TokenId },
    #[panic_msg = "Buyer cannot buy own token"]
    BuyOwnTokenNotAllowed,
    #[panic_msg = "Not enough deposit to cover token minimum price"]
    NotEnoughDepositToBuyToken,
    #[panic_msg = "Only nft approved contract can delist a token"]
    RevokeNotAllowed,
}

#[near_log(skip_args, only_pub)]
#[near_bindgen]
impl MarketContract {
    /// Initializes the Market contract.
    ///
    /// - `mintgate_fee`: Indicates what percetage MintGate charges for a sale.
    /// - `mintgate_account_id`: Designated MintGate NEAR account id to receive `mintgate_fee` after a sale.
    #[init]
    pub fn init() -> Self {
        Self {
            tokens_for_sale: UnorderedMap::new(Keys::TokensForSale),
            tokens_by_gate_id: LookupMap::new(Keys::TokensByGateId),
            tokens_by_owner_id: LookupMap::new(Keys::TokensByOwnerId),
            tokens_by_creator_id: LookupMap::new(Keys::TokensByCreatorId),
        }
    }

    /// Returns all available tokens for sale.
    /// Use the `nft_on_approve` method to add a token for sale.
    pub fn get_tokens_for_sale(&self) -> Vec<TokenForSale> {
        let mut result = Vec::new();
        for (_, token) in self.tokens_for_sale.iter() {
            result.push(token);
        }
        result
    }

    /// Returns all tokens for sale whose collectible's gate ID is `gate_id`.
    pub fn get_tokens_by_gate_id(&self, gate_id: GateId) -> Vec<TokenForSale> {
        get_tokens_by(&self.tokens_for_sale, &self.tokens_by_gate_id, &gate_id)
    }

    /// Returns all tokens for sale owned by `owner_id`.
    pub fn get_tokens_by_owner_id(&self, owner_id: ValidAccountId) -> Vec<TokenForSale> {
        get_tokens_by(&self.tokens_for_sale, &self.tokens_by_owner_id, owner_id.as_ref())
    }

    /// Returns all tokens for sale whose collectible's creator ID is `creator_id`.
    pub fn get_tokens_by_creator_id(&self, creator_id: ValidAccountId) -> Vec<TokenForSale> {
        get_tokens_by(&self.tokens_for_sale, &self.tokens_by_creator_id, creator_id.as_ref())
    }

    /// Buys the token.
    // accountId -> marketplace accountminAmount -> sell price
    // Selling price: 5NMarktplace fee: 10%, 0.5N = 4.5NRoyalty: 10%, 0.45N = 4.05N
    // Selling price: 5NMarketplace adds royalty: 10%: 5.5NMarketplace adds fee: 10%: 6.05NSelling price: 6.05N
    #[payable]
    pub fn buy_token(&mut self, token_id: TokenId) {
        if let Some(TokenForSale { owner_id, min_price, nft_id, gate_id, creator_id, .. }) =
            self.tokens_for_sale.get(&token_id)
        {
            let buyer_id = env::predecessor_account_id();

            if buyer_id == owner_id {
                Panics::BuyOwnTokenNotAllowed.panic();
            }

            let deposit = env::attached_deposit();
            if deposit < min_price.0 {
                Panics::NotEnoughDepositToBuyToken.panic();
            }

            self.remove_token_id(token_id, &gate_id, &owner_id, &creator_id);

            mg_core::nft::nft_transfer_payout(
                buyer_id.try_into().unwrap(),
                token_id,
                None,
                None,
                Some(min_price),
                &nft_id,
                0,
                env::prepaid_gas() / 3,
            )
            .then(self_callback::make_payouts(
                &env::current_account_id(),
                NO_DEPOSIT,
                GAS_FOR_ROYALTIES,
            ));
        } else {
            Panics::TokenIdNotFound { token_id }.panic();
        }
    }

    fn remove_token_id(
        &mut self,
        token_id: TokenId,
        gate_id: &GateId,
        owner_id: &AccountId,
        creator_id: &AccountId,
    ) {
        self.tokens_for_sale.remove(&token_id);
        remove_token_id_from(&mut self.tokens_by_gate_id, &gate_id, token_id);
        remove_token_id_from(&mut self.tokens_by_owner_id, &owner_id, token_id);
        remove_token_id_from(&mut self.tokens_by_creator_id, &creator_id, token_id);
    }
}

#[near_ext]
#[ext_contract(self_callback)]
trait SelfCallback {
    fn make_payouts(&mut self);
}

#[near_log(skip_args, only_pub)]
#[near_bindgen]
impl SelfCallback for MarketContract {
    #[private]
    fn make_payouts(&mut self) {
        match env::promise_result(0) {
            PromiseResult::NotReady => unreachable!(),
            PromiseResult::Failed => unreachable!(),
            PromiseResult::Successful(value) => {
                if let Ok(payout) = serde_json::from_slice::<Payout>(&value) {
                    for (receiver_id, amount) in payout {
                        Promise::new(receiver_id).transfer(amount.0);
                    }
                } else {
                    unreachable!();
                }
            }
        }
    }
}

#[near_log(skip_args, only_pub)]
#[near_bindgen]
impl NonFungibleTokenApprovalsReceiver for MarketContract {
    /// Callback method to allow this contract to put a `Token` into the marketplace.
    /// The msg must contain the following fields:
    fn nft_on_approve(
        &mut self,
        token_id: TokenId,
        owner_id: ValidAccountId,
        approval_id: U64,
        msg: String,
    ) {
        match serde_json::from_str::<MarketApproveMsg>(&msg) {
            Ok(approve_msg) => {
                // approve_msg.royalty.check();

                let nft_id = env::predecessor_account_id();

                self.tokens_for_sale.insert(
                    &token_id,
                    &TokenForSale {
                        token_id,
                        owner_id: owner_id.clone().into(),
                        approval_id,
                        min_price: approve_msg.min_price,
                        nft_id,
                        gate_id: approve_msg.gate_id.clone(),
                        creator_id: approve_msg.creator_id.clone(),
                        // royalty: approve_msg.royalty,
                    },
                );

                insert_token_id_to(
                    &mut self.tokens_by_gate_id,
                    &approve_msg.gate_id,
                    token_id,
                    Keys::TokensByGateIdValue,
                );
                insert_token_id_to(
                    &mut self.tokens_by_owner_id,
                    &owner_id.into(),
                    token_id,
                    Keys::TokensByOwnerIdValue,
                );
                insert_token_id_to(
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

    /// Callback method to remove this `Token` from the marketplace.
    fn nft_on_revoke(&mut self, token_id: TokenId) {
        let nft_id = env::predecessor_account_id();

        if let Some(token) = self.tokens_for_sale.get(&token_id) {
            if token.nft_id == nft_id {
                self.remove_token_id(token_id, &token.gate_id, &token.owner_id, &token.creator_id);
            } else {
                Panics::RevokeNotAllowed.panic();
            }
        } else {
            Panics::TokenIdNotFound { token_id }.panic();
        }
    }
}

fn insert_token_id_to<F: FnOnce(CryptoHash) -> Keys>(
    tokens_map: &mut LookupMap<String, UnorderedSet<TokenId>>,
    key: &String,
    token_id: TokenId,
    f: F,
) {
    let mut tids = tokens_map.get(&key).unwrap_or_else(|| UnorderedSet::new(f(crypto_hash(key))));
    tids.insert(&token_id);
    tokens_map.insert(key, &tids);
}

fn get_tokens_by<K: BorshSerialize>(
    ts: &UnorderedMap<TokenId, TokenForSale>,
    tokens_map: &LookupMap<K, UnorderedSet<TokenId>>,
    key: &K,
) -> Vec<TokenForSale> {
    match tokens_map.get(&key) {
        None => Vec::new(),
        Some(tids) => {
            tids.iter().map(|token_id| ts.get(&token_id).expect("Token not found")).collect()
        }
    }
}

fn remove_token_id_from<K: BorshSerialize>(
    tokens_map: &mut LookupMap<K, UnorderedSet<TokenId>>,
    key: &K,
    token_id: TokenId,
) {
    match tokens_map.get(&key) {
        None => Panics::TokenIdNotFound { token_id }.panic(),
        Some(mut tids) => {
            if !tids.remove(&token_id) {
                Panics::TokenIdNotFound { token_id }.panic();
            }

            tokens_map.insert(&key, &tids);
        }
    }
}
