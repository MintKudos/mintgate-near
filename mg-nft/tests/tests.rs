#![deny(warnings)]

mod context;

use std::{
    convert::TryInto,
    ops::{Deref, DerefMut},
};

use context::MockedContext;
use mg_core::{fraction::Fraction, nft::GateId};
use mg_nft::Contract;
use near_sdk::json_types::{ValidAccountId, U64};

struct ContractChecker {
    contract: Contract,
    claimed_tokens: Vec<u64>,
}

impl Deref for ContractChecker {
    type Target = Contract;
    fn deref(&self) -> &Self::Target {
        &self.contract
    }
}

impl DerefMut for ContractChecker {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.contract
    }
}

impl ContractChecker {
    fn create_test_collectible(&mut self, gate_id: String, supply: u64) {
        self.contract.create_collectible(
            gate_id,
            "My collectible".to_string(),
            "NFT description".to_string(),
            U64::from(supply),
            "someurl".to_string(),
            Fraction::new(5, 100),
        );
    }

    fn claim_token(&mut self, gate_id: GateId) -> u64 {
        let token_id = self.contract.claim_token(gate_id);
        self.claimed_tokens.insert(0, token_id.0);

        token_id.0
    }

    // pub fn last_claimed_token(&self) -> u64 {
    //     *self.claimed_tokens.get(0).unwrap()
    // }
}

fn init() -> MockedContext<ContractChecker> {
    MockedContext::new(|| ContractChecker {
        contract: Contract::init(Fraction::new(25, 1000)),
        claimed_tokens: Vec::new(),
    })
}

fn alice() -> ValidAccountId {
    "alice".try_into().unwrap()
}

fn bob() -> ValidAccountId {
    "bob".try_into().unwrap()
}

fn charlie() -> ValidAccountId {
    "charlie".try_into().unwrap()
}

fn any() -> ValidAccountId {
    "any".try_into().unwrap()
}

fn some_gate_id() -> String {
    "<gate-id>".to_string()
}

#[test]
fn initial_state() {
    init().run_as(any(), |contract| {
        assert_eq!(contract.get_collectibles_by_creator(any()).len(), 0);
        assert_eq!(contract.get_tokens_by_owner(any()).len(), 0);
    });
}

#[test]
fn create_a_collectible() {
    init().run_as(alice(), |contract| {
        contract.create_test_collectible(some_gate_id(), 10);
        assert_eq!(contract.get_collectibles_by_creator(alice()).len(), 1);
    });
}

#[test]
fn claim_a_token() {
    init()
        .run_as(alice(), |contract| {
            contract.create_test_collectible(some_gate_id(), 10);
            assert_eq!(contract.get_collectibles_by_creator(alice()).len(), 1);
        })
        .run_as(bob(), |contract| {
            contract.claim_token(some_gate_id());
            contract.claim_token(some_gate_id());
            contract.claim_token(some_gate_id());

            let tokens = contract.get_tokens_by_owner(bob());
            assert_eq!(tokens.len(), 3);

            let c = contract.get_collectible_by_gate_id(some_gate_id());
            assert_eq!(c.current_supply, 7);
        });
}

#[test]
fn claim_a_few_tokens() {
    init()
        .run_as(alice(), |contract| {
            contract.create_test_collectible(some_gate_id(), 10);
            assert_eq!(contract.get_collectibles_by_creator(alice()).len(), 1);
        })
        .run_as(bob(), |contract| {
            contract.create_test_collectible(some_gate_id(), 10);
            assert_eq!(contract.get_collectibles_by_creator(bob()).len(), 1);
            contract.claim_token(some_gate_id());
        });
}

#[test]
fn transfer_a_token() {
    init()
        .run_as(alice(), |contract| {
            contract.create_test_collectible(some_gate_id(), 10);
        })
        .run_as(bob(), |contract| {
            let token_id = contract.claim_token(some_gate_id());
            contract.transfer_token(charlie(), token_id);

            let ts = contract.get_tokens_by_owner(charlie());
            assert_eq!(ts.len(), 1);
        });
}

#[test]
fn approve() {
    init()
        .run_as(alice(), |contract| {
            contract.create_test_collectible(some_gate_id(), 10);
        })
        .run_as(bob(), |contract| {
            let token_id = contract.claim_token(some_gate_id());
            contract.approve(token_id, any());
        });
}
