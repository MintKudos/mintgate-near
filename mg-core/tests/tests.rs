use std::convert::TryInto;

use mg_core::{fraction::Fraction, Contract};
use near_sdk::{
    json_types::ValidAccountId, test_utils::VMContextBuilder, testing_env, MockedBlockchain,
};

fn init_contract() -> Contract {
    Contract::init(Fraction::new(25, 1000))
}

fn any() -> ValidAccountId {
    "any".try_into().unwrap()
}

#[test]
fn initial_state() {
    let context = VMContextBuilder::new().build();
    testing_env!(context);

    let contract = init_contract();
    assert_eq!(contract.get_collectibles_by_creator(any()).len(), 0);
    assert_eq!(contract.get_tokens_by_owner(any()).len(), 0);
}
