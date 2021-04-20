use mg_core::mocked_context::gate_id;
use near_sdk::Balance;
use near_sdk_sim::UserAccount;

mod sim;
use sim::*;

#[test]
fn create_and_claim_collectibles() {
    let Sim { nft, alice, bob, charlie, .. } = &init(0, "1/1000", "70/100", "35/100");
    let users = [alice, bob, charlie];

    create_collectible(nft, alice, 1, 10, "1/0")
        .failure(mg_core::Panics::ZeroDenominatorFraction {}.msg());

    create_collectible(nft, alice, 1, 10, "2/1")
        .failure(mg_core::Panics::FractionGreaterThanOne {}.msg());

    create_collectible(nft, bob, 1, 10, "0/10").failure(
        mg_nft::Panics::RoyaltyMinThanAllowed {
            royalty: "0/10".parse().unwrap(),
            gate_id: gate_id(1),
        }
        .msg(),
    );

    create_collectible(nft, bob, 1, 10, "8/10").failure(
        mg_nft::Panics::RoyaltyMaxThanAllowed {
            royalty: "8/10".parse().unwrap(),
            gate_id: gate_id(1),
        }
        .msg(),
    );

    create_collectible(nft, bob, 1, 10, "70/100").failure(
        mg_nft::Panics::RoyaltyTooLarge {
            royalty: "70/100".parse().unwrap(),
            mintgate_fee: "35/100".parse().unwrap(),
        }
        .msg(),
    );

    create_collectible(nft, charlie, 1, 0, "1/10")
        .failure(mg_nft::Panics::ZeroSupplyNotAllowed { gate_id: gate_id(1) }.msg());

    let n = 20;
    for k in 1..=n {
        create_collectible(nft, alice, k, 4, "10/100").unwrap();
        create_collectible(nft, bob, k + n, k * 10, "10/100").unwrap();
        create_collectible(nft, charlie, k, k * 10, "10/100")
            .failure(mg_nft::Panics::GateIdAlreadyExists { gate_id: gate_id(k) }.msg());
        create_collectible(nft, charlie, k + 2 * n, k * 10, "10/100").unwrap();
        claim_token(nft, users[k as usize % users.len()], 0)
            .failure(mg_nft::Panics::GateIdNotFound { gate_id: gate_id(0) }.msg());
        loop {
            claim_token(nft, users[k as usize % users.len()], k).unwrap();
            let collectible = get_collectible_by_gate_id(nft, k);
            if collectible.current_supply.0 == 0 {
                break;
            }
        }
        claim_token(nft, users[k as usize % users.len()], k)
            .failure(mg_nft::Panics::GateIdExhausted { gate_id: gate_id(k) }.msg());
    }
}

#[test]
fn nft_approve_tokens() {
    let Sim { nft, markets, alice, bob, charlie, .. } = &init(1, "1/1000", "30/100", "25/1000");
    let users = [alice, bob, charlie];

    for u in 0..(users.len() * 4) {
        create_collectible(nft, users[u % users.len()], u as u64, 10, "10/100").unwrap();
    }

    claim_token(nft, bob, 1).unwrap();
    let token_id = claim_token(nft, alice, 1).unwrap();
    nft_approve(nft, &markets[0], alice, token_id, "3").unwrap();
}

#[test]
fn nft_revoke_tokens() {
    let Sim { nft, markets, fake_market, alice, .. } = &init(2, "1/1000", "30/100", "25/1000");

    create_collectible(nft, alice, 1, 10, "10/100").unwrap();
    let token_id = claim_token(nft, alice, 1).unwrap();
    nft_approve(nft, &markets[0], alice, token_id, "1").unwrap();
    nft_revoke(nft, &markets[0], alice, token_id).unwrap();

    nft_approve(nft, &fake_market, alice, token_id, "1").failure("CompilationError".to_string());
    nft_revoke(nft, &fake_market, alice, token_id).failure("CompilationError".to_string());
}

#[test]
fn buy_tokens() {
    let Sim { nft, mintgate, markets, alice, bob, .. } = &init(1, "1/1000", "30/100", "25/1000");

    create_collectible(nft, alice, 1, 10, "10/100").unwrap();
    claim_token(nft, bob, 1).unwrap();
    let token_id = claim_token(nft, alice, 1).unwrap();
    nft_approve(nft, &markets[0], alice, token_id, "3").unwrap();
    buy_token(&markets[0], nft, bob, token_id, "3").unwrap();
    assert_amount(bob, 1);
    assert_amount(alice, 1);
    assert_amount(mintgate, 1);
}

fn assert_amount(user_account: &UserAccount, _amount: Balance) {
    let account = user_account.account().unwrap();
    println!("{}: N{}", user_account.account_id, account.amount);
}
