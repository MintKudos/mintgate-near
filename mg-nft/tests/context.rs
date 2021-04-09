use near_sdk::{test_utils::VMContextBuilder, testing_env, MockedBlockchain, VMContext};
use std::{
    convert::TryInto,
    ops::{Deref, DerefMut},
};

pub struct MockedContext<T> {
    contract: T,
    pub context: VMContext,
}

impl<T> Deref for MockedContext<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.contract
    }
}

impl<T> DerefMut for MockedContext<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.update_context();
        &mut self.contract
    }
}

impl<T> MockedContext<T> {
    pub fn new<F>(init: F) -> Self
    where
        F: FnOnce() -> T,
    {
        let context = VMContextBuilder::new().build();
        testing_env!(context.clone());
        Self {
            contract: init(),
            context,
        }
    }

    /// Runs the given `action` as account `account_id`.
    pub fn run_as<S, F>(&mut self, account_id: S, action: F) -> &mut Self
    where
        F: FnOnce(&mut MockedContext<T>) -> (),
        S: AsRef<String>,
    {
        self.context.predecessor_account_id = account_id.as_ref().clone();
        self.update_context();
        action(self);
        self
    }

    // pub fn attach_deposit(&mut self, attached_deposit: u128) -> &mut Self {
    //     self.context.attached_deposit = attached_deposit;
    //     self
    // }

    fn update_context(&mut self) {
        self.context.random_seed =
            (u128::from_le_bytes(self.context.random_seed[..16].try_into().unwrap()) + 1)
                .to_ne_bytes()
                .to_vec();
        self.context.block_timestamp += 1;
        testing_env!(self.context.clone());
    }
}
