#![deny(warnings)]

use mg_core::{
    mock_context,
    mocked_context::{self, alice, any},
    NonFungibleTokenApprovalsReceiver,
};
use mg_market::MarketContract;
use mocked_context::min_price;
use near_sdk::json_types::ValidAccountId;
use std::{
    convert::TryInto,
    ops::{Deref, DerefMut},
};

mock_context!();

struct MarketContractChecker {
    contract: MarketContract,
}

impl Deref for MarketContractChecker {
    type Target = MarketContract;
    fn deref(&self) -> &Self::Target {
        &self.contract
    }
}

impl DerefMut for MarketContractChecker {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.contract
    }
}

impl MockedContext<MarketContractChecker> {}

fn init_contract(mintgate_fee: &str) -> MockedContext<MarketContractChecker> {
    MockedContext::new(|| MarketContractChecker {
        contract: MarketContract::init(mintgate_fee.parse().unwrap()),
    })
}

fn init() -> MockedContext<MarketContractChecker> {
    init_contract("25/1000")
}

#[test]
fn initial_state() {
    init().run_as(any(), |contract| {
        assert_eq!(contract.get_tokens_for_sale().len(), 0);
    });
}

#[test]
#[should_panic(expected = "Denominator must be a positive number, but was 0")]
fn init_state_with_zero_den_mintgate_fee_should_panic() {
    init_contract("5/0");
}

#[test]
#[should_panic(expected = "The fraction must be less or equal to 1")]
fn init_state_with_invalid_mintgate_fee_should_panic() {
    init_contract("5/4");
}

#[test]
fn nft_on_approve_should_add_token_for_sale() {
    init().run_as(alice(), |contract| {
        contract.nft_on_approve(1.into(), alice(), 0.into(), min_price(10).unwrap());
        assert_eq!(contract.get_tokens_for_sale().len(), 1);
    });
}

#[test]
#[should_panic(expected = "Could not find min_price in msg: ")]
fn nft_on_approve_with_no_price_should_panic() {
    init().run_as(alice(), |contract| {
        contract.nft_on_approve(1.into(), alice(), 0.into(), "".to_string());
        assert_eq!(contract.get_tokens_for_sale().len(), 1);
    });
}

#[test]
#[should_panic(expected = "Token ID `U64(99)` was not found")]
fn buy_a_non_existent_token_should_panic() {
    init().run_as(alice(), |contract| {
        contract.buy_token(99.into());
    });
}

#[test]
fn buy_a_token() {
    init().run_as(alice(), |contract| {
        contract.nft_on_approve(1.into(), alice(), 0.into(), min_price(10).unwrap());
        contract.buy_token(1.into());
    });
}
