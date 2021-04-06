use std::cmp::Ordering;

use mg_core::fraction::Fraction;

#[test]
fn multiply_by_0() {
    assert_eq!(Fraction::new(0, 1).mult(1_000_000), 0);
    assert_eq!(Fraction::new(0, 5).mult(1_000_000), 0);
}

#[test]
fn multiply_by_1() {
    assert_eq!(Fraction::new(1, 1).mult(1_000_000), 1_000_000);
    assert_eq!(Fraction::new(5, 5).mult(1_000_000), 1_000_000);
}

#[test]
fn multiply_by_half() {
    assert_eq!(Fraction::new(1, 2).mult(1_000_000), 500_000);
    assert_eq!(Fraction::new(5, 10).mult(1_000_000), 500_000);
}

#[test]
#[should_panic(expected = "Denominator must be a positive number, but was 0")]
fn zero_denominator_should_panic() {
    Fraction::new(1, 0);
}

#[test]
#[should_panic(expected = "The fraction must be less or equal to 1")]
fn fraction_greater_than_one_should_panic() {
    Fraction::new(2, 1);
}

#[test]
fn equality() {
    assert_eq!(Fraction::new(0, 2), Fraction::new(0, 500));
    assert_eq!(Fraction::new(1, 1), Fraction::new(500, 500));
    assert_eq!(Fraction::new(1, 2), Fraction::new(30, 60));
    assert_eq!(Fraction::new(1, 3), Fraction::new(40, 120));
}

#[test]
fn less_than_and_greater_than() {
    assert_eq!(
        Fraction::new(0, 1).cmp(&Fraction::new(1, u32::MAX)),
        Ordering::Less
    );
    assert_eq!(
        Fraction::new(1, 3).cmp(&Fraction::new(5, 10)),
        Ordering::Less
    );
    assert_eq!(
        Fraction::new(1, 1).cmp(&Fraction::new(9, 10)),
        Ordering::Greater
    );
    assert_eq!(
        Fraction::new(2, 3).cmp(&Fraction::new(5, 10)),
        Ordering::Greater
    );
}
