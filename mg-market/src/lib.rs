use mg_core::Fraction;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, UnorderedSet};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{near_bindgen, AccountId, PanicOnDefault, StorageUsage};

#[global_allocator]
static ALLOC: near_sdk::wee_alloc::WeeAlloc<'_> = near_sdk::wee_alloc::WeeAlloc::INIT;

pub type TokenId = String;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Token {
    pub owner_id: AccountId,
    pub metadata: String,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    pub tokens_per_owner: LookupMap<AccountId, UnorderedSet<TokenId>>,

    pub tokens_by_id: UnorderedMap<TokenId, Token>,

    pub owner_id: AccountId,

    pub total_supply: u64,

    /// The storage size in bytes for one account.
    pub extra_storage_in_bytes_per_token: StorageUsage,

    /// Percentage fee to pay back to Mintgate when a `Token` is being sold.
    /// This field can be set up when the contract is deployed.
    mintgate_fee: Fraction,
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
// [09:31] Zahhar Kirillov
// accountId -> marketplace accountminAmount -> sell price

// [09:36] Zahhar Kirillov
// Selling price: 5NMarktplace fee: 10%, 0.5N = 4.5NRoyalty: 10%, 0.45N = 4.05N

// [09:38] Zahhar Kirillov
// Selling price: 5NMarketplace adds royalty: 10%: 5.5NMarketplace adds fee: 10%: 6.05NSelling price: 6.05N

// }
