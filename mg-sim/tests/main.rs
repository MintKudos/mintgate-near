use mg_core::{gate::ValidGateId, mocked_context::gate_id, MarketApproveMsg, TokenId};
use mg_nft::Panic;
use near_sdk::{
    json_types::{ValidAccountId, U128, U64},
    serde_json,
};
use near_sdk_sim::to_yocto;

mod sim;
use sim::*;

#[test]
fn create_and_claim_collectibles() {
    let Sim { nft, alice, bob, charlie, .. } = &init(0, "1/1000", "70/100", "35/100");
    let users = [alice, bob, charlie];

    create_collectible(nft, alice, gate_id(1), 10, "1/0")
        .failure(mg_core::CorePanics::ZeroDenominatorFraction {}.msg());

    create_collectible(nft, alice, gate_id(1), 10, "2/1")
        .failure(mg_core::CorePanics::FractionGreaterThanOne {}.msg());

    create_collectible(nft, bob, gate_id(1), 10, "0/10").failure(
        mg_nft::Panic::RoyaltyMinThanAllowed {
            royalty: "0/10".parse().unwrap(),
            gate_id: gate_id(1).to_string(),
        }
        .msg(),
    );

    create_collectible(nft, bob, gate_id(1), 10, "8/10").failure(
        mg_nft::Panic::RoyaltyMaxThanAllowed {
            royalty: "8/10".parse().unwrap(),
            gate_id: gate_id(1).to_string(),
        }
        .msg(),
    );

    create_collectible(nft, bob, gate_id(1), 10, "70/100").failure(
        mg_nft::Panic::RoyaltyTooLarge {
            royalty: "70/100".parse().unwrap(),
            mintgate_fee: "35/100".parse().unwrap(),
        }
        .msg(),
    );

    create_collectible(nft, charlie, gate_id(1), 0, "1/10")
        .failure(mg_nft::Panic::ZeroSupplyNotAllowed { gate_id: gate_id(1).to_string() }.msg());

    let n = 4;
    for k in 1..=n {
        create_collectible(nft, alice, gate_id(k), 4, "10/100").unwrap();
        create_collectible(nft, bob, gate_id(k + n), k * 10, "10/100").unwrap();
        create_collectible(nft, charlie, gate_id(k), k * 10, "10/100")
            .failure(mg_nft::Panic::GateIdAlreadyExists { gate_id: gate_id(k).to_string() }.msg());
        create_collectible(nft, charlie, gate_id(k + 2 * n), k * 10, "10/100").unwrap();
        claim_token(nft, users[k as usize % users.len()], 0)
            .failure(mg_nft::Panic::GateIdNotFound { gate_id: gate_id(0).to_string() }.msg());
        loop {
            claim_token(nft, users[k as usize % users.len()], k).unwrap();
            let collectible = get_collectible_by_gate_id(nft, gate_id(k));
            if collectible.current_supply == 0 {
                break;
            }
        }
        claim_token(nft, users[k as usize % users.len()], k)
            .failure(mg_nft::Panic::GateIdExhausted { gate_id: gate_id(k).to_string() }.msg());
    }
}

#[test]
fn nft_approve_and_revoke_tokens() {
    let Sim { nft, markets, fake_market, alice, bob, charlie, .. } =
        &init(2, "1/1000", "30/100", "25/1000");
    let users = [alice, bob, charlie];

    let n = 4;
    for u in 1..=(users.len() * n) {
        create_collectible(nft, users[(u - 1) % users.len()], gate_id(u as u16), 10, "10/100")
            .unwrap();
    }

    let token_id = claim_token(nft, alice, 1).unwrap();
    burn_token(nft, alice, token_id).unwrap();
    nft_approve(nft, &markets[0], alice, token_id, "1")
        .failure(Panic::TokenIdNotFound { token_id }.msg());

    let mut tokens = Vec::new();
    for u in 1..=(users.len() * n) {
        let token_id = claim_token(nft, alice, u as u16).unwrap();
        tokens.push(token_id);
    }

    for token_id in &tokens {
        nft_approve(nft, &markets[0], alice, *token_id, "1").unwrap();
    }

    for token_id in &tokens {
        let tokens = get_tokens_for_sale(&markets[0]);
        assert!(tokens.iter().map(|t| t.token_id).collect::<Vec<TokenId>>().contains(token_id));

        if token_id.0 % 2 == 0 {
            nft_revoke(nft, &markets[0], alice, *token_id).unwrap();
        } else {
            burn_token(nft, alice, *token_id).unwrap();
        }

        let tokens = get_tokens_for_sale(&markets[0]);
        assert!(!tokens.iter().map(|t| t.token_id).collect::<Vec<TokenId>>().contains(token_id));
    }

    let token_id = claim_token(nft, alice, 1).unwrap();
    nft_on_approve(
        &markets[0],
        &nft.user_account,
        token_id,
        alice.valid_account_id(),
        1.into(),
        approve_msg(10, gate_id(3), charlie.valid_account_id()),
    )
    .unwrap();

    nft_approve(nft, &fake_market, alice, token_id, "1")
        .failure("cannot find contract code for account".to_string());
    nft_revoke(nft, &fake_market, alice, token_id)
        .failure("cannot find contract code for account".to_string());
}

#[test]
fn batch_approve_a_few_tokens() {
    let Sim { nft, markets, alice, bob, charlie, .. } = &init(2, "1/1000", "30/100", "25/1000");
    let users = [alice, bob, charlie];

    let n = 5;
    for u in 1..=(users.len() * n) {
        create_collectible(nft, users[(u - 1) % users.len()], gate_id(u as u16), 10, "10/100")
            .unwrap();
    }

    let mut tokens = Vec::new();
    for u in 1..=(users.len() * n) {
        let token_id = claim_token(nft, alice, u as u16).unwrap();
        tokens.push((token_id, U128(u as u128 * 1000)));
    }

    batch_approve(nft, &markets[0], alice, tokens.clone()).unwrap();

    tokens.push((U64(1_111_111_111), U128(1)));
    batch_approve(nft, &markets[0], bob, tokens.clone()).failure(format!(
        "{} error(s) detected, see `panics` fields for a full list of errors",
        tokens.len()
    ));

    let mut tokens = Vec::new();
    for u in 1..=(users.len() * n) {
        let token_id = claim_token(nft, users[u % users.len()], u as u16).unwrap();
        tokens.push((token_id, U128(u as u128 * 1_000_000)));
    }

    batch_approve(nft, &markets[0], bob, tokens.clone()).failure(format!(
        "{} error(s) detected, see `panics` fields for a full list of errors",
        tokens.len() - tokens.len() / users.len()
    ));
}

#[test]
fn buy_a_few_tokens() {
    let Sim { nft, mintgate, markets, alice, bob, .. } = &init(1, "1/1000", "30/100", "25/1000");

    create_collectible(nft, alice, gate_id(1), 10, "10/100").unwrap();
    claim_token(nft, bob, 1).unwrap();

    let token_id = claim_token(nft, alice, 1).unwrap();
    nft_approve(nft, &markets[0], alice, token_id, "3").unwrap();

    buy_token(&markets[0], nft, bob, token_id, "2")
        .failure(mg_market::Panics::NotEnoughDepositToBuyToken.msg());

    let bob_balance = bob.balance();
    let alice_balance = alice.balance();
    let mintgate_balance = mintgate.balance();
    buy_token(&markets[0], nft, bob, token_id, "3").unwrap();
    bob.check_amount(bob_balance - to_yocto("3"));
    alice.check_amount(alice_balance + to_yocto("3") - to_yocto("0.075"));
    mintgate.check_amount(mintgate_balance + to_yocto("0.075"));

    let token_id = claim_token(nft, alice, 1).unwrap();
    nft_approve(nft, &markets[0], alice, token_id, "5").unwrap();
    let bob_balance = bob.balance();
    let alice_balance = alice.balance();
    let mintgate_balance = mintgate.balance();
    buy_token(&markets[0], nft, bob, token_id, "7").unwrap();
    bob.check_amount(bob_balance - to_yocto("7"));
    alice.check_amount(alice_balance + to_yocto("7") - to_yocto("0.175"));
    mintgate.check_amount(mintgate_balance + to_yocto("0.175"));
}

fn approve_msg(price: u128, gate_id: ValidGateId, creator_id: ValidAccountId) -> String {
    serde_json::to_string(&MarketApproveMsg {
        min_price: price.into(),
        gate_id: Some(gate_id),
        creator_id: Some(creator_id.to_string()),
    })
    .unwrap()
}
