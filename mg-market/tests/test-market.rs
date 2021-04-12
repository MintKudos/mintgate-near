#![deny(warnings)]

use mg_core::{
    mock_context,
    mocked_context::{alice, any, bob, gate_id, nft},
    GateId, MarketApproveMsg, NonFungibleTokenApprovalsReceiver,
};
use mg_market::MarketContract;
use near_sdk::{json_types::ValidAccountId, serde_json};
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

fn approve_msg(price: u128, gate_id: GateId, creator_id: ValidAccountId, royalty: &str) -> String {
    serde_json::to_string(&MarketApproveMsg {
        min_price: price.into(),
        gate_id,
        creator_id: creator_id.to_string(),
        royalty: royalty.parse().unwrap(),
    })
    .unwrap()
}

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
    init().run_as(nft(), |contract| {
        let token_id = 5.into();
        contract.nft_on_approve(
            token_id,
            alice(),
            0.into(),
            approve_msg(10, gate_id(1), bob(), "1/100"),
        );
        assert_eq!(contract.get_tokens_for_sale(), vec![token_id]);
        assert_eq!(contract.get_tokens_by_gate_id(gate_id(1)), vec![token_id]);
        assert_eq!(contract.get_tokens_by_owner_id(alice()), vec![token_id]);
        assert_eq!(contract.get_tokens_by_creator_id(bob()), vec![token_id]);
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
        contract.nft_on_approve(
            1.into(),
            alice(),
            0.into(),
            approve_msg(10, gate_id(1), alice(), "1/100"),
        );
        contract.buy_token(1.into());
    });
}
