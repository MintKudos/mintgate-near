use near_sdk::Balance;
use near_sdk_sim::UserAccount;

mod sim;
use sim::*;

#[test]
fn payouts() {
    let Sim { nft, mintgate, market, alice, bob, .. } = &init();

    create_collectible(nft, alice, 1, 10, "10/100");
    claim_token(nft, bob, 1);
    let token_id = claim_token(nft, alice, 1);
    nft_approve(nft, market, alice, token_id, "3");
    buy_token(market, nft, bob, token_id, "3");
    assert_amount(bob, 1);
    assert_amount(alice, 1);
    assert_amount(mintgate, 1);
}

#[test]
fn revoke() {
    let Sim { nft, market, alice, .. } = &init();

    create_collectible(nft, alice, 1, 10, "10/100");
    let token_id = claim_token(nft, alice, 1);
    nft_approve(nft, market, alice, token_id, "1");
    nft_revoke(nft, alice, token_id);
}

fn assert_amount(user_account: &UserAccount, _amount: Balance) {
    let account = user_account.account().unwrap();
    println!("{}: N{}", user_account.account_id, account.amount);
}
