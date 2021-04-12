use mg_core::Fraction;
use near_sdk::{test_utils::VMContextBuilder, testing_env, MockedBlockchain};
use std::cmp::Ordering;

#[test]
fn parse_fraction() {
    assert_eq!("0/1".parse::<Fraction>().unwrap(), Fraction { num: 0, den: 1 });
}

#[test]
fn multiply_by_0() {
    assert_eq!(Fraction { num: 0, den: 1 }.mult(1_000_000), 0);
    assert_eq!(Fraction { num: 0, den: 5 }.mult(1_000_000), 0);
}

#[test]
fn multiply_by_1() {
    assert_eq!(Fraction { num: 1, den: 1 }.mult(1_000_000), 1_000_000);
    assert_eq!(Fraction { num: 5, den: 5 }.mult(1_000_000), 1_000_000);
}

#[test]
fn multiply_by_half() {
    assert_eq!(Fraction { num: 1, den: 2 }.mult(1_000_000), 500_000);
    assert_eq!(Fraction { num: 5, den: 10 }.mult(1_000_000), 500_000);
}

#[test]
#[should_panic(expected = "Denominator must be a positive number, but was 0")]
fn zero_denominator_should_panic() {
    testing_env!(VMContextBuilder::new().build());
    Fraction { num: 1, den: 0 }.check();
}

#[test]
#[should_panic(expected = "The fraction must be less or equal to 1")]
fn fraction_greater_than_one_should_panic() {
    testing_env!(VMContextBuilder::new().build());
    Fraction { num: 2, den: 1 }.check();
}

#[test]
fn equality() {
    assert_eq!(Fraction { num: 0, den: 2 }, Fraction { num: 0, den: 500 });
    assert_eq!(Fraction { num: 1, den: 1 }, Fraction { num: 500, den: 500 });
    assert_eq!(Fraction { num: 1, den: 2 }, Fraction { num: 30, den: 60 });
    assert_eq!(Fraction { num: 1, den: 3 }, Fraction { num: 40, den: 120 });
}

#[test]
fn less_than_and_greater_than() {
    assert_eq!(
        Fraction { num: 0, den: 1 }.cmp(&Fraction { num: 1, den: u32::MAX }),
        Ordering::Less
    );
    assert_eq!(Fraction { num: 1, den: 3 }.cmp(&Fraction { num: 5, den: 10 }), Ordering::Less);
    assert_eq!(Fraction { num: 1, den: 1 }.cmp(&Fraction { num: 9, den: 10 }), Ordering::Greater);
    assert_eq!(Fraction { num: 2, den: 3 }.cmp(&Fraction { num: 5, den: 10 }), Ordering::Greater);
}
