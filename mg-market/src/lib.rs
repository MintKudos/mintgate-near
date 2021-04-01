use mg_core::{
    fraction::Fraction,
    nft::{NonFungibleTokenApprovalsReceiver, TokenId},
};
use near_env::near_envlog;
use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    env,
    json_types::U64,
    near_bindgen,
    serde::{Deserialize, Serialize},
    setup_alloc, AccountId, PanicOnDefault,
};

setup_alloc!();

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Token {
    pub owner_id: AccountId,
    pub metadata: String,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
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
// accountId -> marketplace accountminAmount -> sell price

// Selling price: 5NMarktplace fee: 10%, 0.5N = 4.5NRoyalty: 10%, 0.45N = 4.05N

// Selling price: 5NMarketplace adds royalty: 10%: 5.5NMarketplace adds fee: 10%: 6.05NSelling price: 6.05N

// }

#[near_envlog(skip_args, only_pub)]
#[near_bindgen]
impl Contract {
    #[init]
    pub fn init(mintgate_fee: Fraction) -> Self {
        Self { mintgate_fee }
    }
}

#[near_envlog(skip_args, only_pub)]
#[near_bindgen]
impl NonFungibleTokenApprovalsReceiver for Contract {
    fn nft_on_approve(
        &mut self,
        token_id: TokenId,
        owner_id: AccountId,
        approval_id: U64,
        msg: String,
    ) {
        env::log(b"nft_on_approve");
    }
}
