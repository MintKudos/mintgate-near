#![deny(warnings)]

use mg_core::{
    mock_context,
    mocked_context::{
        alice, any, bob, charlie, gate_id, market, mintgate_admin, mintgate_fee_account_id,
    },
    ContractMetadata, GateId, NftApproveMsg, NonFungibleTokenApprovalMgmt, NonFungibleTokenCore,
    TokenApproval, TokenId, ValidGateId,
};
use mg_nft::NftContract;
use near_sdk::{
    json_types::{ValidAccountId, U128, U64},
    serde_json,
};
use std::{
    convert::TryInto,
    ops::{Deref, DerefMut},
};

mock_context!();

struct NftContractChecker {
    contract: NftContract,
    claimed_tokens: Vec<TokenId>,
}

impl Deref for NftContractChecker {
    type Target = NftContract;
    fn deref(&self) -> &Self::Target {
        &self.contract
    }
}

impl DerefMut for NftContractChecker {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.contract
    }
}

impl MockedContext<NftContractChecker> {
    fn create_collectible(&mut self, gate_id: ValidGateId, supply: u64, royalty: &str) {
        let collectibles_by_owner = self.get_collectibles_by_creator(self.pred_id());

        println!("Creating Collectible `{}` with supply {}", gate_id, supply);
        self.contract.create_collectible(
            gate_id.clone(),
            "My collectible".to_string(),
            "NFT description".to_string(),
            U64::from(supply),
            "someurl".to_string(),
            royalty.parse().unwrap(),
        );

        let collectible = self.contract.get_collectible_by_gate_id(gate_id.clone()).unwrap();
        assert_eq!(&collectible.gate_id, gate_id.as_ref());
        assert_eq!(collectible.current_supply.0, supply);

        assert_eq!(
            self.get_collectibles_by_creator(self.pred_id()).len(),
            collectibles_by_owner.len() + 1
        );
    }

    fn create_test_collectible(&mut self, gate_id: ValidGateId, supply: u64) {
        self.create_collectible(gate_id, supply, "5/100");
    }

    fn create_royalty_collectible(&mut self, gate_id: ValidGateId, supply: u64, royalty: &str) {
        self.create_collectible(gate_id, supply, royalty);
    }

    fn claim_token(&mut self, gate_id: ValidGateId) -> TokenId {
        let token_id = self.contract.claim_token(gate_id.clone());

        assert!(self
            .contract
            .get_tokens_by_owner(self.pred_id())
            .iter()
            .map(|token| (token.token_id, token.gate_id.clone()))
            .collect::<Vec<(TokenId, GateId)>>()
            .contains(&(token_id, gate_id.to_string())));

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
            .all(|gid| gid == gate_id.to_string()));

        self.claimed_tokens.insert(0, token_id);
        token_id
    }

    pub fn last_claimed_token(&self) -> TokenId {
        *self.claimed_tokens.get(0).unwrap()
    }
}

fn approve_msg(price: u128) -> Option<String> {
    serde_json::to_string(&NftApproveMsg { min_price: price.into() }).ok()
}

fn init_contract(min_royalty: &str, max_royalty: &str) -> MockedContext<NftContractChecker> {
    MockedContext::new(|| NftContractChecker {
        contract: NftContract::init(
            mintgate_admin(),
            metadata(),
            min_royalty.parse().unwrap(),
            max_royalty.parse().unwrap(),
            "25/1000".parse().unwrap(),
            mintgate_fee_account_id(),
        ),
        claimed_tokens: Vec::new(),
    })
}

fn init() -> MockedContext<NftContractChecker> {
    init_contract("5/100", "30/100")
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

mod initial_state {

    use super::*;

    #[test]
    #[should_panic(expected = "Denominator must be a positive number, but was 0")]
    fn init_state_with_zero_den_min_royalty_should_panic() {
        init_contract("1/0", "5/10");
    }

    #[test]
    #[should_panic(expected = "Denominator must be a positive number, but was 0")]
    fn init_state_with_zero_den_max_royalty_should_panic() {
        init_contract("1/1", "5/0");
    }

    #[test]
    #[should_panic(expected = "The fraction must be less or equal to 1")]
    fn init_state_with_invalid_min_royalty_should_panic() {
        init_contract("5/4", "2/3");
    }

    #[test]
    #[should_panic(expected = "The fraction must be less or equal to 1")]
    fn init_state_with_invalid_max_royalty_should_panic() {
        init_contract("5/10", "3/2");
    }

    #[test]
    #[should_panic(expected = "Min royalty `5/100` must be less or equal to max royalty `2/100`")]
    fn init_state_with_max_royalty_less_than_min_royalty_should_panic() {
        init_contract("5/100", "2/100");
    }

    #[test]
    fn initial_state() {
        init().run_as(any(), |contract| {
            assert_eq!(contract.get_collectibles_by_creator(any()).len(), 0);
            assert_eq!(contract.get_collectibles_by_creator(alice()).len(), 0);
            assert_eq!(contract.get_tokens_by_owner(any()).len(), 0);
            assert_eq!(contract.nft_metadata(), metadata());
            assert_eq!(contract.get_collectible_by_gate_id(gate_id(0)), None);
            assert_eq!(contract.nft_token(0.into()), None);
        });
    }
}

mod create_collectible {

    use super::*;

    #[test]
    #[should_panic(expected = "Denominator must be a positive number, but was 0")]
    fn create_a_collectible_with_zero_den_royalty_should_panic() {
        init().run_as(alice(), |contract| {
            contract.create_collectible(gate_id(1), 10, "1/0");
        });
    }

    #[test]
    #[should_panic(expected = "The fraction must be less or equal to 1")]
    fn create_a_collectible_with_invalid_royalty_should_panic() {
        init().run_as(alice(), |contract| {
            contract.create_collectible(gate_id(1), 10, "2/1");
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
    #[should_panic(expected = "Royalty `1/1` is too large for the given NFT fee `25/1000`")]
    fn create_a_collectible_with_full_royalty_should_panic() {
        init_contract("0/10", "30/30").run_as(alice(), |contract| {
            contract.create_royalty_collectible(gate_id(1), 10, "1/1");
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
                for i in 0..10 {
                    contract.create_test_collectible(gate_id(i), i + 1);
                }
                assert_eq!(contract.get_collectibles_by_creator(alice()).len(), 10);
            })
            .run_as(bob(), |contract| {
                for i in 10..25 {
                    contract.create_test_collectible(gate_id(i), i + 1);
                }
                assert_eq!(contract.get_collectibles_by_creator(bob()).len(), 15);
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
}

mod delete_collectible {

    use super::*;

    #[test]
    #[should_panic(expected = "Gate ID `Nekq22i3rvzDe7c51Yc8hU` was not found")]
    fn delete_a_non_existent_collectible_should_panic() {
        init().run_as(alice(), |contract| {
            contract.delete_collectible(gate_id(0));
        });
    }

    #[test]
    #[should_panic(expected = "Gate ID `GPZkspuVGaZxwWoP6bJoWU` has already some claimed tokens")]
    fn delete_a_claimed_gate_id_should_panic() {
        init().run_as(alice(), |contract| {
            contract.create_test_collectible(gate_id(1), 10);
            contract.claim_token(gate_id(1));
            contract.delete_collectible(gate_id(1));
        });
    }

    #[test]
    #[should_panic(expected = "Unable to delete gate ID `GPZkspuVGaZxwWoP6bJoWU`")]
    fn delete_a_collectible_from_non_creator_should_panic() {
        init()
            .run_as(alice(), |contract| {
                contract.create_test_collectible(gate_id(1), 10);
            })
            .run_as(bob(), |contract| {
                contract.delete_collectible(gate_id(1));
            });
    }

    #[test]
    fn delete_a_collectible_from_creator() {
        init().run_as(alice(), |contract| {
            contract.create_test_collectible(gate_id(1), 10);
            assert!(contract.get_collectible_by_gate_id(gate_id(1)).is_some());

            contract.delete_collectible(gate_id(1));
            assert!(contract.get_collectible_by_gate_id(gate_id(1)).is_none());
        });
    }

    #[test]
    fn delete_a_collectible_from_admin() {
        init()
            .run_as(alice(), |contract| {
                contract.create_test_collectible(gate_id(1), 10);
                assert!(contract.get_collectible_by_gate_id(gate_id(1)).is_some());
            })
            .run_as(mintgate_admin(), |contract| {
                contract.delete_collectible(gate_id(1));
                assert!(contract.get_collectible_by_gate_id(gate_id(1)).is_none());
            });
    }
}

mod claim_token {

    use super::*;

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

                let c = contract.get_collectible_by_gate_id(gate_id(1)).unwrap();
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
    #[should_panic(expected = "Gate ID `Nekq22i3rvzDe7c51Yc8hU` was not found")]
    fn claim_a_token_of_non_existent_gate_id_should_panic() {
        init().run_as(alice(), |contract| {
            contract.claim_token(gate_id(0));
        });
    }

    #[test]
    #[should_panic(
        expected = "Tokens for gate id `GPZkspuVGaZxwWoP6bJoWU` have already been claimed"
    )]
    fn claim_a_token_with_no_supply_should_panic() {
        init()
            .run_as(alice(), |contract| {
                contract.create_test_collectible(gate_id(1), 1);
                contract.claim_token(gate_id(1));
            })
            .run_as(bob(), |contract| {
                contract.claim_token(gate_id(1));
            });
    }
}

mod nft_transfer {

    use super::*;

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
    #[should_panic(expected = "Token ID `U64(99)` was not found")]
    fn transfer_a_non_existent_token_should_panic() {
        init().run_as(alice(), |contract| {
            contract.nft_transfer(charlie(), 99.into(), None, None);
        });
    }

    #[test]
    #[should_panic(expected = "Sender `bob` is not authorized to make transfer")]
    fn transfer_a_non_approved_token_should_panic() {
        init()
            .run_as(alice(), |contract| {
                contract.create_test_collectible(gate_id(1), 10);
                contract.claim_token(gate_id(1));
            })
            .run_as(bob(), |contract| {
                let token_id = contract.last_claimed_token();
                contract.nft_transfer(charlie(), token_id, None, None);
            });
    }
}

mod nft_approve {

    use super::*;

    #[test]
    #[should_panic(expected = "The msg argument must contain the minimum price")]
    fn nft_approve_with_no_msg_should_panic() {
        init().run_as(alice(), |contract| {
            contract.nft_approve(0.into(), bob(), None);
        });
    }

    #[test]
    #[should_panic(expected = "Could not find min_price in msg: ")]
    fn nft_approve_with_invalid_msg_should_panic() {
        init().run_as(alice(), |contract| {
            contract.nft_approve(0.into(), bob(), Some("".to_string()));
        });
    }

    #[test]
    #[should_panic(expected = "Token ID `U64(99)` was not found")]
    fn nft_approve_a_non_existent_token_should_panic() {
        init().run_as(alice(), |contract| {
            contract.nft_approve(99.into(), bob(), approve_msg(10));
        });
    }

    #[test]
    fn nft_approve_a_token() {
        init().run_as(alice(), |contract| {
            contract.create_test_collectible(gate_id(1), 10);
            let token_id = contract.claim_token(gate_id(1));
            contract.nft_approve(token_id, bob(), approve_msg(10));

            let token = contract.nft_token(token_id).unwrap();
            assert_eq!(token.approval_counter, U64(1));
            assert_eq!(token.approvals.len(), 1);
            assert_eq!(token.approvals[bob().as_ref()], TokenApproval::new(1, U128(10)));
        });
    }

    #[test]
    #[should_panic(expected = "At most one approval is allowed per Token")]
    fn nft_approve_a_token_twice_should_panic() {
        init().run_as(alice(), |contract| {
            contract.create_test_collectible(gate_id(1), 10);
            let token_id = contract.claim_token(gate_id(1));
            contract.nft_approve(token_id, bob(), approve_msg(10));
            contract.nft_approve(token_id, charlie(), approve_msg(15));
        });
    }

    #[test]
    fn nft_approve_before_transfer_a_token() {
        init()
            .run_as(alice(), |contract| {
                contract.create_test_collectible(gate_id(1), 10);
            })
            .run_as(bob(), |contract| {
                let token_id = contract.claim_token(gate_id(1));
                contract.nft_approve(token_id, market(), approve_msg(10));

                let token = contract.nft_token(token_id).unwrap();
                assert_eq!(token.approval_counter, U64(1));
                assert_eq!(token.approvals.len(), 1);
                assert_eq!(token.approvals[market().as_ref()], TokenApproval::new(1, U128(10)));
            })
            .run_as(market(), |contract| {
                let token_id = contract.last_claimed_token();
                contract.nft_transfer(charlie(), token_id, None, None);

                let token = contract.nft_token(token_id).unwrap();
                assert_eq!(token.approval_counter, U64(1));
                assert_eq!(token.approvals.len(), 0);
            });
    }
}

mod nft_revoke_all {
    use super::*;

    #[test]
    #[should_panic(expected = "Token ID `U64(99)` was not found")]
    fn nft_revoke_all_for_non_existent_token_should_panic() {
        init().run_as(bob(), |contract| {
            contract.nft_revoke_all(99.into());
        });
    }

    #[test]
    #[should_panic(expected = "Token ID `U64(0)` does not belong to account `bob")]
    fn nft_revoke_all_for_non_owned_token_should_panic() {
        init()
            .run_as(alice(), |contract| {
                contract.create_test_collectible(gate_id(1), 10);
                contract.claim_token(gate_id(1));
            })
            .run_as(bob(), |contract| {
                let token_id = contract.last_claimed_token();
                contract.nft_revoke_all(token_id);
            });
    }
}

mod nft_payout {

    use super::*;

    #[test]
    #[should_panic(expected = "Token ID `U64(99)` was not found")]
    fn nft_payout_non_existent_token_id_should_panic() {
        init().run_as(bob(), |contract| {
            contract.nft_payout(99.into(), 0.into());
        });
    }

    #[test]
    fn nft_get_payout_no_royalty() {
        init_contract("0/10", "30/100")
            .run_as(alice(), |contract| {
                contract.create_royalty_collectible(gate_id(1), 10, "0/1");
            })
            .run_as(bob(), |contract| {
                let token_id = contract.claim_token(gate_id(1));
                let payout = contract.nft_payout(token_id, 2000.into());
                assert_eq!(payout.len(), 3);
                assert_eq!(payout.get(mintgate_fee_account_id().as_ref()).unwrap().0, 50);
                assert_eq!(payout.get(alice().as_ref()).unwrap().0, 0);
                assert_eq!(payout.get(bob().as_ref()).unwrap().0, 1950);
            });
    }

    #[test]
    fn nft_get_payout() {
        init()
            .run_as(alice(), |contract| {
                contract.create_royalty_collectible(gate_id(1), 10, "15/100");
            })
            .run_as(bob(), |contract| {
                let token_id = contract.claim_token(gate_id(1));
                let payout = contract.nft_payout(token_id, 2000.into());
                assert_eq!(payout.len(), 3);
                assert_eq!(payout.get(mintgate_fee_account_id().as_ref()).unwrap().0, 50);
                assert_eq!(payout.get(alice().as_ref()).unwrap().0, 300);
                assert_eq!(payout.get(bob().as_ref()).unwrap().0, 1650);
            });
    }

    #[test]
    fn nft_get_example_payout() {
        init()
            .run_as(alice(), |contract| {
                contract.create_royalty_collectible(gate_id(1), 10, "30/100");
            })
            .run_as(bob(), |contract| {
                let token_id = contract.claim_token(gate_id(1));
                let payout = contract.nft_payout(token_id, 5_000_000.into());
                assert_eq!(payout.len(), 3);
                assert_eq!(payout.get(mintgate_fee_account_id().as_ref()).unwrap().0, 125_000);
                assert_eq!(payout.get(alice().as_ref()).unwrap().0, 1_500_000);
                assert_eq!(payout.get(bob().as_ref()).unwrap().0, 3_375_000);
            });
    }

    #[test]
    fn nft_get_payout_periodic_royalty_fraction() {
        init()
            .run_as(alice(), |contract| {
                contract.create_royalty_collectible(gate_id(1), 10, "1/6");
            })
            .run_as(bob(), |contract| {
                let token_id = contract.claim_token(gate_id(1));
                let payout = contract.nft_payout(token_id, 2000.into());
                assert_eq!(payout.len(), 3);
                assert_eq!(payout.get(mintgate_fee_account_id().as_ref()).unwrap().0, 50);
                assert_eq!(payout.get(alice().as_ref()).unwrap().0, 333);
                assert_eq!(payout.get(bob().as_ref()).unwrap().0, 1617);
            });
    }

    #[test]
    fn nft_get_payout_infinite_royalty_fraction() {
        init()
            .run_as(alice(), |contract| {
                contract.create_royalty_collectible(gate_id(1), 10, "1/7");
            })
            .run_as(bob(), |contract| {
                let token_id = contract.claim_token(gate_id(1));
                let payout = contract.nft_payout(token_id, 2000.into());
                assert_eq!(payout.len(), 3);
                assert_eq!(payout.get(mintgate_fee_account_id().as_ref()).unwrap().0, 50);
                assert_eq!(payout.get(alice().as_ref()).unwrap().0, 285);
                assert_eq!(payout.get(bob().as_ref()).unwrap().0, 1665);
            });
    }

    #[test]
    fn nft_get_payout_when_creator_and_owner_are_the_same() {
        init().run_as(bob(), |contract| {
            contract.create_royalty_collectible(gate_id(1), 10, "1/7");
            let token_id = contract.claim_token(gate_id(1));
            let payout = contract.nft_payout(token_id, 2000.into());
            assert_eq!(payout.len(), 2);
            assert_eq!(payout.get(mintgate_fee_account_id().as_ref()).unwrap().0, 50);
            assert_eq!(payout.get(bob().as_ref()).unwrap().0, 1950);
        });
    }

    #[test]
    fn nft_get_payout_when_creator_and_owner_are_the_same_with_no_royalty() {
        init_contract("0/1", "1/1").run_as(bob(), |contract| {
            contract.create_royalty_collectible(gate_id(1), 10, "0/7");
            let token_id = contract.claim_token(gate_id(1));
            let payout = contract.nft_payout(token_id, 2000.into());
            assert_eq!(payout.len(), 2);
            assert_eq!(payout.get(mintgate_fee_account_id().as_ref()).unwrap().0, 50);
            assert_eq!(payout.get(bob().as_ref()).unwrap().0, 1950);
        });
    }
}

mod nft_transfer_payout {

    use super::*;

    #[test]
    fn nft_get_transfer_payout() {
        init()
            .run_as(alice(), |contract| {
                contract.create_royalty_collectible(gate_id(1), 10, "15/100");
            })
            .run_as(bob(), |contract| {
                let token_id = contract.claim_token(gate_id(1));
                let payout = contract
                    .nft_transfer_payout(charlie(), token_id, None, None, Some(2000.into()))
                    .unwrap();
                assert_eq!(payout.len(), 3);
                assert_eq!(payout.get(mintgate_fee_account_id().as_ref()).unwrap().0, 50);
                assert_eq!(payout.get(alice().as_ref()).unwrap().0, 300);
                assert_eq!(payout.get(bob().as_ref()).unwrap().0, 1650);
            });
    }
}
