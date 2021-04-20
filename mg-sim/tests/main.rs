use mg_core::mocked_context::gate_id;
use mg_nft::Panics;
use near_sdk::Balance;
use near_sdk_sim::UserAccount;

mod sim;
use sim::*;

#[test]
fn create_same_collectible_twice_should_fail() {
    let Sim { nft, alice, bob, charlie, .. } = &init();

    for k in 1..=40 {
        create_collectible(nft, alice, k, k * 10, "10/100").unwrap();
        create_collectible(nft, bob, k + 40, k * 10, "10/100").unwrap();
        create_collectible(nft, charlie, k, k * 10, "10/100")
            .failure(Panics::GateIdAlreadyExists { gate_id: gate_id(k) }.msg());
    }
}

#[test]
fn nft_approve_should_list_token_on_market() {
    let Sim { nft, market, alice, bob, charlie, .. } = &init();
    let users = [alice, bob, charlie];

    for u in 0..(users.len() * 4) {
        create_collectible(nft, users[u % users.len()], u as u64, 10, "10/100").unwrap();
    }

    claim_token(nft, bob, 1);
    let token_id = claim_token(nft, alice, 1);
    nft_approve(nft, market, alice, token_id, "3");
}

#[test]
fn buy_token_on_market_should_make_transfer() {
    let Sim { nft, mintgate, market, alice, bob, .. } = &init();

    create_collectible(nft, alice, 1, 10, "10/100").unwrap();
    claim_token(nft, bob, 1);
    let token_id = claim_token(nft, alice, 1);
    nft_approve(nft, market, alice, token_id, "3");
    buy_token(market, nft, bob, token_id, "3");
    assert_amount(bob, 1);
    assert_amount(alice, 1);
    assert_amount(mintgate, 1);
}

#[test]
fn nft_approve_and_revoke() {
    let Sim { nft, market, alice, .. } = &init();

    create_collectible(nft, alice, 1, 10, "10/100").unwrap();
    let token_id = claim_token(nft, alice, 1);
    nft_approve(nft, market, alice, token_id, "1");
    nft_revoke(nft, alice, token_id);
}

fn assert_amount(user_account: &UserAccount, _amount: Balance) {
    let account = user_account.account().unwrap();
    println!("{}: N{}", user_account.account_id, account.amount);
}
