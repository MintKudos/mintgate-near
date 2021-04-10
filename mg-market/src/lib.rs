//! This module implement the MintGate marketplace.
#![deny(warnings)]

use mg_core::{ApproveMsg, Fraction, NonFungibleTokenApprovalsReceiver, TokenId};
use near_env::{near_log, PanicMessage};
use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    collections::UnorderedMap,
    json_types::{ValidAccountId, U64},
    near_bindgen,
    serde::{Deserialize, Serialize},
    serde_json, setup_alloc, AccountId, PanicOnDefault,
};

setup_alloc!();

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Token2 {
    pub owner_id: AccountId,
    pub metadata: String,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct MarketContract {
    /// Percentage fee to pay back to Mintgate when a `Token` is being sold.
    /// This field can be set up when the contract is deployed.
    mintgate_fee: Fraction,
    /// Lists all tokens for sale.
    tokens_for_sale: UnorderedMap<TokenId, (AccountId, u64, u128)>,
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

#[near_log(skip_args, only_pub)]
#[near_bindgen]
impl MarketContract {
    /// Initializes the Market contract.
    ///
    /// - `mintgate_fee`: Indicates what percetage MintGate charges for a sale.
    #[init]
    pub fn init(mintgate_fee: Fraction) -> Self {
        Self {
            mintgate_fee,
            tokens_for_sale: UnorderedMap::new(vec![b'0']),
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
}

#[derive(Serialize, PanicMessage)]
#[serde(crate = "near_sdk::serde", tag = "err")]
enum Panics {
    #[panic_msg = "Could not find min_price in msg: {}"]
    MsgFormatMinPriceMissing { reason: String },
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
        match serde_json::from_str::<ApproveMsg>(&msg) {
            Ok(approve_msg) => {
                self.tokens_for_sale.insert(
                    &token_id,
                    &(owner_id.into(), approval_id.0, approve_msg.min_price.0),
                );
            }
            Err(err) => {
                Panics::MsgFormatMinPriceMissing {
                    reason: err.to_string(),
                }
                .panic();
            }
        }
    }
}
