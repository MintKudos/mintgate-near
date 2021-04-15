#![deny(warnings)]

use mg_core::{
    mock_context,
    mocked_context::{alice, any, bob, charlie, gate_id, nft},
    GateId, MarketApproveMsg, NonFungibleTokenApprovalsReceiver, TokenId,
};
use mg_market::{MarketContract, TokenForSale};
use near_sdk::{
    json_types::{ValidAccountId, U64},
    serde_json,
};
use std::{
    collections::BTreeSet,
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

impl MockedContext<MarketContractChecker> {
    fn nft_on_approve(
        &mut self,
        token_id: TokenId,
        owner_id: ValidAccountId,
        approval_id: U64,
        msg: MarketApproveMsg,
    ) {
        fn set_cmp(a: &Vec<TokenForSale>, b: &mut Vec<TokenForSale>, t: TokenForSale) {
            let f = |t: &TokenForSale| {
                (
                    t.token_id.0,
                    t.owner_id.clone(),
                    t.approval_id.0,
                    t.min_price.0,
                    t.nft_id.clone(),
                    t.gate_id.clone(),
                    t.creator_id.clone(),
                    // t.royalty,
                )
            };
            b.push(t);
            let a: BTreeSet<_> = a.into_iter().map(f).collect();
            let b: &Vec<TokenForSale> = b;
            let b: BTreeSet<_> = b.into_iter().map(f).collect();

            assert_eq!(a, b);
        }

        fn snapshot(
            contract: &MarketContract,
            msg: &MarketApproveMsg,
            owner_id: ValidAccountId,
        ) -> [Vec<TokenForSale>; 4] {
            [
                contract.get_tokens_for_sale(),
                contract.get_tokens_by_gate_id(msg.gate_id.clone()),
                contract.get_tokens_by_owner_id(owner_id),
                contract.get_tokens_by_creator_id(msg.creator_id.clone().try_into().unwrap()),
            ]
        }

        let mut b = snapshot(&self.contract, &msg, owner_id.clone());

        self.contract.nft_on_approve(
            token_id,
            owner_id.clone(),
            approval_id,
            serde_json::to_string(&msg).unwrap(),
        );

        let a = snapshot(&self.contract, &msg, owner_id.clone());
        a.iter().zip(b.iter_mut()).for_each(|(x, y)| {
            set_cmp(
                x,
                y,
                TokenForSale {
                    token_id,
                    owner_id: owner_id.to_string(),
                    approval_id,
                    min_price: msg.min_price,
                    nft_id: self.context.predecessor_account_id.clone(),
                    gate_id: msg.gate_id.clone(),
                    creator_id: msg.creator_id.clone(),
                    // royalty: msg.royalty,
                },
            );
        });
    }
}

fn approve_msg(price: u128, gate_id: GateId, creator_id: ValidAccountId) -> MarketApproveMsg {
    MarketApproveMsg { min_price: price.into(), gate_id, creator_id: creator_id.to_string() }
}

fn init_contract(mintgate_fee: &str) -> MockedContext<MarketContractChecker> {
    MockedContext::new(|| MarketContractChecker {
        contract: MarketContract::init(mintgate_fee.parse().unwrap(), any()),
    })
}

fn init() -> MockedContext<MarketContractChecker> {
    init_contract("25/1000")
}

mod initial_state {

    use super::*;

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
    fn init_state() {
        init().run_as(any(), |contract| {
            assert_eq!(contract.get_tokens_for_sale().len(), 0);
            assert_eq!(contract.get_tokens_by_gate_id(gate_id(99)).len(), 0);
            assert_eq!(contract.get_tokens_by_owner_id(any()).len(), 0);
            assert_eq!(contract.get_tokens_by_creator_id(any()).len(), 0);
        });
    }
}

mod nft_on_approve {

    use super::*;

    #[test]
    #[should_panic(expected = "Could not find min_price in msg: ")]
    fn nft_on_approve_with_no_msg_should_panic() {
        init().run_as(nft(), |contract| {
            contract.contract.nft_on_approve(0.into(), alice(), 0.into(), "".to_string());
        });
    }

    #[test]
    #[should_panic(expected = "Could not find min_price in msg: ")]
    fn nft_on_approve_with_invalid_msg_should_panic() {
        init().run_as(nft(), |contract| {
            contract.contract.nft_on_approve(0.into(), alice(), 0.into(), "min_price".to_string());
        });
    }

    #[test]
    fn nft_on_approve_should_add_token_for_sale() {
        init().run_as(nft(), |contract| {
            let ids = [alice(), bob(), charlie()];
            for token_id in 1..12 {
                contract.nft_on_approve(
                    token_id.into(),
                    ids[token_id as usize % 3].clone(),
                    0.into(),
                    approve_msg((token_id * 10).into(), gate_id(token_id % 4), bob()),
                );
            }
        });
    }
}

mod buy_token {

    use super::*;

    #[test]
    #[should_panic(expected = "Token ID `U64(99)` was not found")]
    fn buy_a_non_existent_token_should_panic() {
        init().run_as(alice(), |contract| {
            contract.buy_token(99.into());
        });
    }

    #[test]
    #[should_panic(expected = "Buyer cannot buy own token")]
    fn buy_own_token_should_panic() {
        let token_id = 5.into();
        init()
            .run_as(nft(), |contract| {
                let msg = approve_msg(10, gate_id(1), charlie());
                contract.nft_on_approve(token_id, bob(), 0.into(), msg);
            })
            .run_as(bob(), |contract| {
                contract.buy_token(token_id);
            });
    }

    #[test]
    #[should_panic(expected = "Not enough deposit to cover token minimum price")]
    fn buy_a_token_with_no_deposit_should_panic() {
        let token_id = 5.into();
        init()
            .run_as(nft(), |contract| {
                let msg = approve_msg(1000, gate_id(1), charlie());
                contract.nft_on_approve(token_id, bob(), 0.into(), msg);
            })
            .run_as(alice(), |contract| {
                contract.attach_deposit(700);
                contract.buy_token(token_id);
            });
    }

    #[test]
    fn buy_a_token() {
        let token_id = 5.into();
        init()
            .run_as(nft(), |contract| {
                let msg = approve_msg(1000, gate_id(1), charlie());
                contract.nft_on_approve(token_id, bob(), 0.into(), msg);
            })
            .run_as(alice(), |contract| {
                assert_eq!(contract.get_tokens_for_sale().len(), 1);
                assert_eq!(contract.get_tokens_by_gate_id(gate_id(1)).len(), 1);
                assert_eq!(contract.get_tokens_by_owner_id(bob()).len(), 1);
                assert_eq!(contract.get_tokens_by_creator_id(charlie()).len(), 1);

                contract.attach_deposit(1500);
                contract.buy_token(token_id);

                assert_eq!(contract.get_tokens_for_sale().len(), 0);
                assert_eq!(contract.get_tokens_by_gate_id(gate_id(1)).len(), 0);
                assert_eq!(contract.get_tokens_by_owner_id(bob()).len(), 0);
                assert_eq!(contract.get_tokens_by_creator_id(charlie()).len(), 0);
            });
    }
}
