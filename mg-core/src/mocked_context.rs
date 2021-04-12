use std::convert::TryInto;

use near_sdk::{bs58, json_types::ValidAccountId};
use sha2::{Digest, Sha256};

#[macro_export]
macro_rules! mock_context {
    () => {
        use near_sdk::{testing_env, MockedBlockchain};

        pub struct MockedContext<T> {
            contract: T,
            pub context: ::near_sdk::VMContext,
        }

        impl<T> ::std::ops::Deref for MockedContext<T> {
            type Target = T;

            fn deref(&self) -> &Self::Target {
                &self.contract
            }
        }

        impl<T> ::std::ops::DerefMut for MockedContext<T> {
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
                let context = ::near_sdk::test_utils::VMContextBuilder::new().build();
                testing_env!(context.clone());
                Self { contract: init(), context }
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

            pub fn pred_id(&self) -> ValidAccountId {
                self.context.predecessor_account_id.clone().try_into().unwrap()
            }

            fn update_context(&mut self) {
                use std::convert::TryInto;

                self.context.random_seed =
                    (u128::from_le_bytes(self.context.random_seed[..16].try_into().unwrap()) + 1)
                        .to_ne_bytes()
                        .to_vec();
                self.context.block_timestamp += 1;
                testing_env!(self.context.clone());
            }
        }
    };
}

pub fn any() -> ValidAccountId {
    "any".try_into().unwrap()
}

pub fn admin() -> ValidAccountId {
    "admin".try_into().unwrap()
}

pub fn alice() -> ValidAccountId {
    "alice".try_into().unwrap()
}

pub fn bob() -> ValidAccountId {
    "bob".try_into().unwrap()
}

pub fn charlie() -> ValidAccountId {
    "charlie".try_into().unwrap()
}

pub fn market() -> ValidAccountId {
    "market".try_into().unwrap()
}

pub fn gate_id(n: u64) -> String {
    let mut hasher = Sha256::new();
    hasher.update(n.to_ne_bytes());
    let result = hasher.finalize();
    let data: &[u8] = result[..16].try_into().unwrap();
    bs58::encode(data).into_string()
}

pub fn min_price(price: u64) -> Option<String> {
    Some(format!(r#"{{"min_price": "{}"}}"#, price))
}
