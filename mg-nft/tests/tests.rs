#![deny(warnings)]

mod context;

use std::{
    convert::TryInto,
    ops::{Deref, DerefMut},
};

use context::MockedContext;
use mg_core::{
    fraction::Fraction,
    nft::{ContractMetadata, GateId, NonFungibleTokenApprovalMgmt, NonFungibleTokenCore, TokenId},
};
use mg_nft::Contract;
use near_sdk::{
    bs58,
    json_types::{ValidAccountId, U64},
};
use sha2::{Digest, Sha256};

struct ContractChecker {
    contract: Contract,
    claimed_tokens: Vec<TokenId>,
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

impl MockedContext<ContractChecker> {
    fn pred_id(&self) -> ValidAccountId {
        self.context
            .predecessor_account_id
            .clone()
            .try_into()
            .unwrap()
    }

    fn create_collectible(&mut self, gate_id: String, supply: u64, royalty: &str) {
        let collectibles_by_owner = self.get_collectibles_by_creator(self.pred_id());

        println!("Creating Collectible `{}` with supply {}", gate_id, supply);
        self.contract.create_collectible(
            gate_id.clone(),
            "My collectible".to_string(),
            "NFT description".to_string(),
            U64::from(supply),
            "someurl".to_string(),
            {
                let parts = royalty.split("/").collect::<Vec<&str>>();
                Fraction::new(
                    parts[0].parse::<u32>().unwrap(),
                    parts[1].parse::<u32>().unwrap(),
                )
            },
        );

        let collectible = self.contract.get_collectible_by_gate_id(gate_id.clone());
        assert_eq!(collectible.gate_id, gate_id);
        assert_eq!(collectible.current_supply.0, supply);

        assert_eq!(
            self.get_collectibles_by_creator(self.pred_id()).len(),
            collectibles_by_owner.len() + 1
        );
    }

    fn create_test_collectible(&mut self, gate_id: String, supply: u64) {
        self.create_collectible(gate_id, supply, "5/100");
    }

    fn claim_token(&mut self, gate_id: GateId) -> TokenId {
        let token_id = self.contract.claim_token(gate_id.clone());

        assert!(self
            .contract
            .get_tokens_by_owner(self.pred_id())
            .iter()
            .map(|token| (token.token_id, token.gate_id.clone()))
            .collect::<Vec<(TokenId, GateId)>>()
            .contains(&(token_id, gate_id.clone())));

        assert!(self
            .contract
            .get_tokens_by_owner_and_gate_id(gate_id.clone(), self.pred_id())
            .iter()
            .map(|token| token.token_id)
            .collect::<Vec<TokenId>>()
            .contains(&token_id));

        assert!(self
            .contract
            .get_tokens_by_owner_and_gate_id(gate_id.clone(), self.pred_id())
            .iter()
            .map(|token| token.gate_id.clone())
            .all(|gid| gid == gate_id));

        self.claimed_tokens.insert(0, token_id);
        token_id
    }

    pub fn last_claimed_token(&self) -> TokenId {
        *self.claimed_tokens.get(0).unwrap()
    }
}

fn init() -> MockedContext<ContractChecker> {
    MockedContext::new(|| ContractChecker {
        contract: Contract::init(
            admin(),
            metadata(),
            Fraction::new(5, 100),
            Fraction::new(30, 100),
        ),
        claimed_tokens: Vec::new(),
    })
}

fn metadata() -> ContractMetadata {
    ContractMetadata {
        spec: "mg-nft-1.0.0".to_string(),
        name: "MintGate App".to_string(),
        symbol: "MG".to_string(),
        icon: None,
        base_uri: Some("https://mintgate.app/t/".to_string()),
        reference: None,
        reference_hash: None,
    }
}

fn admin() -> ValidAccountId {
    "admin".try_into().unwrap()
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

fn market() -> ValidAccountId {
    "market".try_into().unwrap()
}

fn any() -> ValidAccountId {
    "any".try_into().unwrap()
}

fn gate_id(n: u64) -> String {
    let mut hasher = Sha256::new();
    hasher.update(n.to_ne_bytes());
    let result = hasher.finalize();
    let data: &[u8] = result[..16].try_into().unwrap();
    bs58::encode(data).into_string()
}

#[test]
fn initial_state() {
    init().run_as(any(), |contract| {
        assert_eq!(contract.get_collectibles_by_creator(any()).len(), 0);
        assert_eq!(contract.get_tokens_by_owner(any()).len(), 0);
        assert_eq!(contract.nft_metadata(), metadata());
    });
}

#[test]
#[should_panic(expected = "Gate ID `Nekq22i3rvzDe7c51Yc8hU` was not found")]
fn get_nonexistent_gate_id_should_panic() {
    init().run_as(alice(), |contract| {
        contract.get_collectible_by_gate_id(gate_id(0));
    });
}

#[test]
#[should_panic(expected = "Royalty `0/100` of `GPZkspuVGaZxwWoP6bJoWU` is less than min")]
fn create_a_collectible_with_no_royalty_should_panic() {
    init().run_as(alice(), |contract| {
        contract.create_collectible(gate_id(1), 10, "0/100");
    });
}

#[test]
#[should_panic(expected = "Royalty `2/100` of `GPZkspuVGaZxwWoP6bJoWU` is less than min")]
fn create_a_collectible_with_less_than_min_royalty_should_panic() {
    init().run_as(alice(), |contract| {
        contract.create_collectible(gate_id(1), 10, "2/100");
    });
}

#[test]
#[should_panic(expected = "Royalty `5/10` of `GPZkspuVGaZxwWoP6bJoWU` is greater than max")]
fn create_a_collectible_with_greater_than_max_royalty_should_panic() {
    init().run_as(alice(), |contract| {
        contract.create_collectible(gate_id(1), 10, "5/10");
    });
}

#[test]
#[should_panic(expected = "Royalty `1/1` of `GPZkspuVGaZxwWoP6bJoWU` is greater than max")]
fn create_a_collectible_with_all_royalty_should_panic() {
    init().run_as(alice(), |contract| {
        contract.create_collectible(gate_id(1), 10, "1/1");
    });
}

#[test]
#[should_panic(expected = "Gate ID `GPZkspuVGaZxwWoP6bJoWU` must have a positive supply")]
fn create_a_collectible_with_no_supply_should_panic() {
    init().run_as(alice(), |contract| {
        contract.create_test_collectible(gate_id(1), 0);
    });
}

#[test]
fn create_a_collectible() {
    init().run_as(alice(), |contract| {
        contract.create_test_collectible(gate_id(1), 10);
    });
}

#[test]
fn create_a_few_collectibles() {
    init()
        .run_as(alice(), |contract| {
            for i in 0..20 {
                contract.create_test_collectible(gate_id(i), i + 1);
            }
            assert_eq!(contract.get_collectibles_by_creator(alice()).len(), 20);
        })
        .run_as(bob(), |contract| {
            for i in 20..50 {
                contract.create_test_collectible(gate_id(i), i + 1);
            }
            assert_eq!(contract.get_collectibles_by_creator(bob()).len(), 30);
        });
}

#[test]
#[should_panic(expected = "Gate ID `GPZkspuVGaZxwWoP6bJoWU` already exists")]
fn create_collectible_with_same_gate_id_should_panic() {
    init().run_as(alice(), |contract| {
        contract.create_test_collectible(gate_id(1), 10);
        contract.create_test_collectible(gate_id(1), 20);
    });
}

#[test]
fn get_empty_collectibles_by_creator() {
    init().run_as(alice(), |contract| {
        assert_eq!(contract.get_collectibles_by_creator(alice()), vec!());
        assert_eq!(contract.get_collectibles_by_creator(bob()), vec!());
    });
}

#[test]
fn claim_a_token() {
    init()
        .run_as(alice(), |contract| {
            contract.create_test_collectible(gate_id(1), 10);
            assert_eq!(contract.get_collectibles_by_creator(alice()).len(), 1);
        })
        .run_as(bob(), |contract| {
            contract.claim_token(gate_id(1));
            contract.claim_token(gate_id(1));
            contract.claim_token(gate_id(1));

            let tokens = contract.get_tokens_by_owner(bob());
            assert_eq!(tokens.len(), 3);

            let c = contract.get_collectible_by_gate_id(gate_id(1));
            assert_eq!(c.current_supply.0, 7);
        });
}

#[test]
fn claim_a_few_tokens() {
    init()
        .run_as(alice(), |contract| {
            contract.create_test_collectible(gate_id(1), 10);
            assert_eq!(contract.get_collectibles_by_creator(alice()).len(), 1);
        })
        .run_as(bob(), |contract| {
            contract.create_test_collectible(gate_id(2), 15);
            assert_eq!(contract.get_collectibles_by_creator(bob()).len(), 1);
            contract.claim_token(gate_id(2));
        });
}

#[test]
fn transfer_a_token() {
    init()
        .run_as(alice(), |contract| {
            contract.create_test_collectible(gate_id(1), 10);
        })
        .run_as(bob(), |contract| {
            let token_id = contract.claim_token(gate_id(1));
            contract.nft_transfer(charlie(), token_id, None, None);

            let ts = contract.get_tokens_by_owner(charlie());
            assert_eq!(ts.len(), 1);
        });
}

#[test]
fn approve_and_transfer_token() {
    init()
        .run_as(alice(), |contract| {
            contract.create_test_collectible(gate_id(1), 10);
        })
        .run_as(bob(), |contract| {
            let token_id = contract.claim_token(gate_id(1));
            contract.nft_approve(
                token_id,
                market(),
                Some(r#"{"min_price": "10"}"#.to_string()),
            );
        })
        .run_as(market(), |contract| {
            let token_id = contract.last_claimed_token();
            contract.nft_transfer(charlie(), token_id, None, None);
        });
}
