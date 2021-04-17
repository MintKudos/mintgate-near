near_sdk_sim::lazy_static_include::lazy_static_include_bytes! {
    NFT_WASM_BYTES => "../target/wasm32-unknown-unknown/release/mg_nft.wasm",
    MARKET_WASM_BYTES => "../target/wasm32-unknown-unknown/release/mg_market.wasm",
}

use mg_core::{mocked_context::gate_id, Collectible, NftApproveMsg, Token, TokenId};
use mg_market::TokenForSale;
use near_sdk::serde_json;
use near_sdk_sim::view;
use near_sdk_sim::{call, ExecutionResult};
use near_sdk_sim::{deploy, init_simulator, to_yocto, ContractAccount, UserAccount};
use std::convert::TryInto;

pub use mg_market::MarketContractContract as MarketContract;
pub use mg_nft::NftContractContract as NftContract;

pub const NFT_ID: &str = "nft";
pub const MARKET_ID: &str = "market";

pub struct Sim {
    pub root: UserAccount,
    pub nft: ContractAccount<NftContract>,
    pub market: ContractAccount<MarketContract>,
    pub mintgate: UserAccount,
    pub admin: UserAccount,
    pub alice: UserAccount,
    pub bob: UserAccount,
    pub charlie: UserAccount,
}

pub fn init() -> Sim {
    let root = init_simulator(None);
    let mintgate = root.create_user("mintgate".to_string(), to_yocto("20"));
    let admin = root.create_user("admin".to_string(), to_yocto("20"));
    let alice = root.create_user("alice".to_string(), to_yocto("20"));
    let bob = root.create_user("bob".to_string(), to_yocto("20"));
    let charlie = root.create_user("charlie".to_string(), to_yocto("20"));

    let nft = deploy!(
        contract: NftContract,
        contract_id: NFT_ID,
        bytes: &NFT_WASM_BYTES,
        // User deploying the contract,
        signer_account: root,
        // init method
        deposit: near_sdk_sim::STORAGE_AMOUNT * 10,
        gas: near_sdk_sim::DEFAULT_GAS,
        init_method: init(
        admin.valid_account_id(),
        metadata(),
        mg_core::Fraction{num:1,den:100},
        mg_core::Fraction{num:10,den:100},
            mg_core::Fraction{num:5,den:100},
            mintgate.valid_account_id()
        )
    );

    let market = deploy!(
        contract: MarketContract,
        contract_id: MARKET_ID,
        bytes: &MARKET_WASM_BYTES,
        signer_account: root,
        deposit: near_sdk_sim::STORAGE_AMOUNT * 10,
        gas: near_sdk_sim::DEFAULT_GAS,
        init_method: init()
    );

    Sim { root, nft, market, mintgate, admin, alice, bob, charlie }
}

fn metadata() -> mg_core::ContractMetadata {
    mg_core::ContractMetadata {
        spec: "mg-nft-1.0.0".to_string(),
        name: "MintGate App".to_string(),
        symbol: "MG".to_string(),
        icon: None,
        base_uri: Some("https://mintgate.app/t/".to_string()),
        reference: None,
        reference_hash: None,
    }
}

pub fn create_collectible(
    nft: &ContractAccount<NftContract>,
    user: &UserAccount,
    gate_key: u64,
    supply: u64,
    royalty: &str,
) {
    println!(
        "[{}] `{}` creating collectible with supply `{}` and royalty `{}`",
        nft.account_id(),
        user.account_id,
        supply,
        royalty
    );

    tx(call!(
        user,
        nft.create_collectible(
            gate_id(gate_key),
            "My collectible".to_string(),
            "NFT description".to_string(),
            near_sdk::json_types::U64::from(supply),
            "someurl".to_string(),
            royalty.parse().unwrap()
        )
    ));

    let c = get_collectible_by_gate_id(nft, gate_key);
    assert_eq!(c.gate_id, gate_id(gate_key));
    assert_eq!(c.royalty, royalty.parse().unwrap());
}

pub fn get_collectible_by_gate_id(
    nft: &ContractAccount<NftContract>,
    gate_key: u64,
) -> Collectible {
    let result: Option<Collectible> =
        view!(nft.get_collectible_by_gate_id(gate_id(gate_key))).unwrap_json();
    result.unwrap()
}

pub fn claim_token(
    nft: &ContractAccount<NftContract>,
    user: &UserAccount,
    gate_key: u64,
) -> TokenId {
    let gate_id = gate_id(gate_key);
    println!("[{}] `{}` claiming token for `{}`", nft.account_id(), user.account_id, gate_id,);
    let result: Option<TokenId> = tx(call!(user, nft.claim_token(gate_id))).unwrap_json();
    result.unwrap()
}

pub fn get_tokens_by_owner(nft: &ContractAccount<NftContract>, user: &UserAccount) -> Vec<Token> {
    let tokens: Vec<Token> =
        view!(nft.get_tokens_by_owner(user.account_id().try_into().unwrap())).unwrap_json();
    println!("{:?}", tokens);
    tokens
}
pub fn nft_approve(
    nft: &ContractAccount<NftContract>,
    market: &ContractAccount<MarketContract>,
    user: &UserAccount,
    token_id: TokenId,
    amount: &str,
) {
    fn approve_msg(price: u128) -> Option<String> {
        serde_json::to_string(&NftApproveMsg { min_price: price.into() }).ok()
    }

    tx(call!(
        user,
        nft.nft_approve(token_id, MARKET_ID.try_into().unwrap(), approve_msg(to_yocto(amount)))
    ));

    let ts = get_tokens_for_sale(market);
    assert!(ts.into_iter().map(|t| t.token_id).collect::<Vec<TokenId>>().contains(&token_id));
}

pub fn nft_revoke(nft: &ContractAccount<NftContract>, user: &UserAccount, token_id: TokenId) {
    tx(call!(user, nft.nft_revoke(token_id, MARKET_ID.try_into().unwrap())));
}

pub fn get_tokens_for_sale(market: &ContractAccount<MarketContract>) -> Vec<TokenForSale> {
    let ts: Vec<TokenForSale> = view!(market.get_tokens_for_sale()).unwrap_json();
    println!("{:?}", ts);
    ts
}

pub fn buy_token(
    market: &ContractAccount<MarketContract>,
    nft: &ContractAccount<NftContract>,
    user: &UserAccount,
    token_id: TokenId,
    deposit: &str,
) {
    println!(
        "[{}] `{}` buying token `{:?}` for `N {}` ",
        market.account_id(),
        user.account_id,
        token_id,
        deposit
    );
    tx(call!(user, market.buy_token(token_id), deposit = to_yocto(deposit)));

    let tokens = get_tokens_by_owner(nft, user);
    assert!(tokens
        .into_iter()
        .map(|t| t.owner_id)
        .collect::<Vec<near_sdk::AccountId>>()
        .contains(&user.account_id));
}

fn tx(x: ExecutionResult) -> ExecutionResult {
    for line in x.logs() {
        println!("[log :: {}]", line);
    }
    x.assert_success();
    x
}
