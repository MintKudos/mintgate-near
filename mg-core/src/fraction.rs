use std::{fmt::Display, u128};

use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    serde::{Deserialize, Serialize},
    Balance,
};
use uint::construct_uint;

construct_uint! {
    /// 256-bit unsigned integer.
    struct U256(4);
}

/// Represents a number between `0` and `1`.
/// It is meant to be used as percentage to calculate both fees and royalties.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Eq)]
#[cfg_attr(not(target_arch = "wasm"), derive(Debug))]
#[serde(crate = "near_sdk::serde")]
pub struct Fraction {
    pub num: u32,
    pub den: u32,
}

impl Fraction {
    /// Creates a new `Fraction` with the given `num`erator and `den`ominator.
    pub fn new(num: u32, den: u32) -> Self {
        assert_ne!(den, 0, "Denominator must be a positive number, but was 0");
        assert!(num <= den, "The fraction must be less or equal to 1");

        Self { num, den }
    }

    /// Multiplies this `Fraction` by the given `value`.
    pub fn mult(&self, value: Balance) -> Balance {
        (U256::from(self.num) * U256::from(value) / U256::from(self.den)).as_u128()
    }
}

impl PartialEq for Fraction {
    fn eq(&self, other: &Self) -> bool {
        self.mult(u128::MAX) == other.mult(u128::MAX)
    }
}

impl PartialOrd for Fraction {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        self.mult(u128::MAX).partial_cmp(&other.mult(u128::MAX))
    }
}

impl Ord for Fraction {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.mult(u128::MAX).cmp(&other.mult(u128::MAX))
    }
}

impl Display for Fraction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}/{}", self.num, self.den)
    }
}
