near_sdk_sim::lazy_static_include::lazy_static_include_bytes! {
    NFT_WASM_BYTES => "../target/wasm32-unknown-unknown/release/mg_nft.wasm",
    MARKET_WASM_BYTES => "../target/wasm32-unknown-unknown/release/mg_market.wasm",
}

use ansi_term::{Colour, Style};
use mg_core::{mocked_context::gate_id, Collectible, NftApproveMsg, Token, TokenId, ValidGateId};
use mg_market::TokenForSale;
use near_sdk::{
    json_types::{ValidAccountId, U128, U64},
    serde_json, Balance,
};
use near_sdk_sim::{
    call,
    errors::{ActionError, ActionErrorKind, TxExecutionError},
    transaction::ExecutionStatus,
    ContractAccount, ExecutionResult,
};
use near_sdk_sim::{deploy, init_simulator, to_yocto, UserAccount};
use near_sdk_sim::{transaction::ExecutionOutcome, view, DEFAULT_GAS, STORAGE_AMOUNT};
use std::{convert::TryInto, fmt::Debug};

pub use mg_market::MarketContractContract as MarketContract;
pub use mg_nft::NftContractContract as NftContract;

const NFT_ID: &str = "nft";
const MARKET_ID: &str = "market";

pub trait BalanceChecker {
    fn balance(&self) -> Balance;
    fn check_amount(&self, expected_amount: Balance);
}

impl BalanceChecker for UserAccount {
    fn balance(&self) -> Balance {
        let account = self.account().unwrap();
        account.amount
    }

    fn check_amount(&self, expected_amount: Balance) {
        let account = self.account().unwrap();
        eprint!("Check balance for {}: N{} ", self.account_id, account.amount);
        let delta = if account.amount > expected_amount {
            account.amount - expected_amount
        } else {
            expected_amount - account.amount
        };
        eprint!("|{:.6}|", delta as f64 / 1e24);
        assert!(
            delta <= to_yocto("0.01"),
            "Balance check failed: delta is {} {}",
            delta,
            expected_amount
        );
        println!(" [OK]");
    }
}

pub struct Sim {
    pub root: UserAccount,
    pub nft: ContractAccount<NftContract>,
    pub markets: Vec<ContractAccount<MarketContract>>,
    pub fake_market: ContractAccount<MarketContract>,
    pub mids: Vec<String>,
    pub mintgate: UserAccount,
    pub admin: UserAccount,
    pub alice: UserAccount,
    pub bob: UserAccount,
    pub charlie: UserAccount,
}

pub fn init(n: usize, min_royalty: &str, max_royalty: &str, mintgate_fee: &str) -> Sim {
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
        signer_account: root,
        deposit: STORAGE_AMOUNT * 10,
        gas: DEFAULT_GAS,
        init_method: init(
            admin.valid_account_id(),
            metadata(),
            min_royalty.parse().unwrap(),
            max_royalty.parse().unwrap(),
            mintgate_fee.parse().unwrap(),
            mintgate.valid_account_id()
        )
    );

    let mut markets = Vec::new();
    let mut mids = Vec::new();
    for i in 0..n {
        let mid = format!("{}{}", MARKET_ID, i);
        let market = deploy!(
            contract: MarketContract,
            contract_id: mid.clone(),
            bytes: &MARKET_WASM_BYTES,
            signer_account: root,
            deposit: near_sdk_sim::STORAGE_AMOUNT * 10,
            gas: near_sdk_sim::DEFAULT_GAS,
            init_method: init()
        );
        mids.push(mid);
        markets.push(market);
    }

    let fake_market = ContractAccount {
        user_account: root.create_user("fake_market_account".to_string(), to_yocto("20")),
        contract: MarketContract { account_id: "fake_market".to_string() },
    };

    Sim { root, nft, markets, fake_market, mids, mintgate, admin, alice, bob, charlie }
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
    gate_id: ValidGateId,
    supply: u64,
    royalty: &str,
) -> Result<(), String> {
    println!(
        "[{}] `{}` creating collectible `{}` with supply `{}` and royalty `{}`",
        nft.account_id(),
        user.account_id,
        gate_id,
        supply,
        royalty
    );

    let title = lipsum::lipsum(2);
    let description = lipsum::lipsum(10);
    let url = lipsum::lipsum(5);
    match tx(call!(
        user,
        nft.create_collectible(
            gate_id.clone(),
            title.to_string(),
            description.to_string(),
            U64::from(supply),
            url.to_string(),
            royalty.parse().unwrap()
        ),
        0,
        DEFAULT_GAS
    )) {
        Ok(_) => {
            let collectible = get_collectible_by_gate_id(nft, gate_id.clone());
            print!("Checking `{}`", collectible.gate_id);
            assert_eq!(collectible.gate_id, gate_id.to_string());
            assert_eq!(collectible.metadata.title.unwrap(), title.to_string());
            assert_eq!(collectible.metadata.description.unwrap(), description.to_string());
            assert_eq!(collectible.current_supply, U64(supply));
            assert_eq!(collectible.gate_url, url.to_string());
            assert_eq!(collectible.royalty, royalty.parse().unwrap());
            println!(" [OK]");
            Ok(())
        }
        Err(msg) => Err(msg),
    }
}

pub fn get_collectible_by_gate_id(
    nft: &ContractAccount<NftContract>,
    gate_id: ValidGateId,
) -> Collectible {
    let result: Option<Collectible> = view!(nft.get_collectible_by_gate_id(gate_id)).unwrap_json();
    result.unwrap()
}

pub fn claim_token(
    nft: &ContractAccount<NftContract>,
    user: &UserAccount,
    gate_key: u64,
) -> Result<TokenId, String> {
    let gate_id = gate_id(gate_key);
    println!("[{}] `{}` claiming token for `{}`", nft.account_id(), user.account_id, gate_id,);
    match tx(call!(user, nft.claim_token(gate_id))) {
        Ok(x) => {
            let result: Option<TokenId> = x.unwrap_json();
            Ok(result.unwrap())
        }
        Err(msg) => Err(msg),
    }
}

pub fn burn_token(
    nft: &ContractAccount<NftContract>,
    user: &UserAccount,
    token_id: TokenId,
) -> Result<(), String> {
    println!("[{}] `{}` burning token `{:?}`", nft.account_id(), user.account_id, token_id);
    match tx(call!(user, nft.burn_token(token_id))) {
        Ok(_) => {
            let tokens = get_tokens_by_owner(nft, user);
            assert!(!tokens
                .into_iter()
                .map(|t| t.token_id)
                .collect::<Vec<TokenId>>()
                .contains(&token_id));
            Ok(())
        }
        Err(msg) => Err(msg),
    }
}

pub fn get_tokens_by_owner(nft: &ContractAccount<NftContract>, user: &UserAccount) -> Vec<Token> {
    let tokens: Vec<Token> =
        view!(nft.get_tokens_by_owner(user.account_id().try_into().unwrap())).unwrap_json();
    println!("{:?}", tokens);
    tokens
}

fn assert_token_in_collection(tokens: Vec<TokenForSale>, token_id: TokenId) {
    assert!(tokens.into_iter().map(|t| t.token_id).collect::<Vec<TokenId>>().contains(&token_id));
}

pub fn nft_approve(
    nft: &ContractAccount<NftContract>,
    market: &ContractAccount<MarketContract>,
    user: &UserAccount,
    token_id: TokenId,
    amount: &str,
) -> Result<(), String> {
    println!(
        "[{}] `{}` approving token `{:?}` in `{}` for N`{}`",
        nft.account_id(),
        user.account_id,
        token_id,
        market.account_id(),
        amount
    );

    fn approve_msg(price: u128) -> Option<String> {
        serde_json::to_string(&NftApproveMsg { min_price: price.into() }).ok()
    }

    match tx(call!(
        user,
        nft.nft_approve(token_id, market.valid_account_id(), approve_msg(to_yocto(amount)))
    )) {
        Ok(_) => {
            assert_token_in_collection(get_tokens_for_sale(market), token_id);
            assert_token_in_collection(
                get_tokens_by_owner_id(market, user.valid_account_id()),
                token_id,
            );
            Ok(())
        }
        Err(msg) => Err(msg),
    }
}

pub fn batch_approve(
    nft: &ContractAccount<NftContract>,
    market: &ContractAccount<MarketContract>,
    user: &UserAccount,
    tokens: Vec<(TokenId, U128)>,
) -> Result<(), String> {
    println!(
        "[{}] `{}` approving tokens `{:?}` in `{}`",
        nft.account_id(),
        user.account_id,
        tokens,
        market.account_id(),
    );
    match tx(call!(user, nft.batch_approve(tokens.clone(), market.valid_account_id()))) {
        Ok(_) => {
            for (token_id, _) in tokens {
                assert_token_in_collection(get_tokens_for_sale(market), token_id);
                assert_token_in_collection(
                    get_tokens_by_owner_id(market, user.valid_account_id()),
                    token_id,
                );
            }
            Ok(())
        }
        Err(msg) => {
            if let Ok(mg_nft::Panic::Errors { panics }) =
                serde_json::from_str::<mg_nft::Panic>(&msg)
            {
                for (token_id, _) in tokens {
                    if !panics
                        .0
                        .iter()
                        .map(|(t, _)| *t)
                        .collect::<Vec<TokenId>>()
                        .contains(&token_id)
                    {
                        assert_token_in_collection(get_tokens_for_sale(market), token_id);
                        assert_token_in_collection(
                            get_tokens_by_owner_id(market, user.valid_account_id()),
                            token_id,
                        );
                    }
                }
            }
            Err(msg)
        }
    }
}

pub fn nft_revoke(
    nft: &ContractAccount<NftContract>,
    market: &ContractAccount<MarketContract>,
    user: &UserAccount,
    token_id: TokenId,
) -> Result<(), String> {
    match tx(call!(user, nft.nft_revoke(token_id, market.valid_account_id()))) {
        Ok(_) => Ok(()),
        Err(msg) => Err(msg),
    }
}

pub fn nft_on_approve(
    market: &ContractAccount<MarketContract>,
    user: &UserAccount,
    token_id: TokenId,
    owner_id: ValidAccountId,
    approval_id: U64,
    msg: String,
) -> Result<(), String> {
    println!("[{}] `{}` on approving token `{:?}`", market.account_id(), user.account_id, token_id,);
    match tx(call!(user, market.nft_on_approve(token_id, owner_id, approval_id, msg))) {
        Ok(_) => Ok(()),
        Err(msg) => Err(msg),
    }
}

pub fn get_tokens_for_sale(market: &ContractAccount<MarketContract>) -> Vec<TokenForSale> {
    let ts: Vec<TokenForSale> = view!(market.get_tokens_for_sale()).unwrap_json();
    ts
}

pub fn get_tokens_by_owner_id(
    market: &ContractAccount<MarketContract>,
    owner: ValidAccountId,
) -> Vec<TokenForSale> {
    let ts: Vec<TokenForSale> = view!(market.get_tokens_by_owner_id(owner)).unwrap_json();
    ts
}

pub fn buy_token(
    market: &ContractAccount<MarketContract>,
    nft: &ContractAccount<NftContract>,
    user: &UserAccount,
    token_id: TokenId,
    deposit: &str,
) -> Result<(), String> {
    println!(
        "[{}] `{}` buying token `{:?}` for `N {}` ",
        market.account_id(),
        user.account_id,
        token_id,
        deposit
    );
    match tx(call!(
        user,
        market.buy_token(nft.valid_account_id(), token_id),
        deposit = to_yocto(deposit)
    )) {
        Ok(_) => {
            let tokens = get_tokens_by_owner(nft, user);
            assert!(tokens
                .into_iter()
                .map(|t| t.owner_id)
                .collect::<Vec<near_sdk::AccountId>>()
                .contains(&user.account_id));
            Ok(())
        }
        Err(msg) => Err(msg),
    }
}

pub trait CheckResult {
    fn failure(self, msg: String);
}

impl<T: Debug> CheckResult for Result<T, String> {
    fn failure(self, msg: String) {
        eprint!("Expecting failure: {}", ansi_term::Color::Purple.paint(&msg));
        let err_msg = self.unwrap_err();
        assert!(err_msg.contains(msg.as_str()), " but got {}", err_msg);
        eprintln!(" [OK]");
    }
}

fn tx(x: ExecutionResult) -> Result<ExecutionResult, String> {
    for line in x.logs() {
        println!("{}", Style::new().dimmed().paint(format!("[log :: {}]", line)));
    }

    println!(
        "{}",
        Colour::Cyan.paint(format!("[tokens burnt: {}]", x.tokens_burnt() as f64 / 1e24))
    );

    if x.is_ok() {
        Ok(x)
    } else {
        if let ExecutionOutcome {
            status:
                ExecutionStatus::Failure(TxExecutionError::ActionError(ActionError {
                    kind:
                        ActionErrorKind::FunctionCallError(
                            near_vm_errors::FunctionCallError::HostError(
                                near_vm_errors::HostError::GuestPanic { panic_msg },
                            ),
                        ),
                    ..
                })),
            ..
        } = x.outcome()
        {
            Err(format!("{}", panic_msg))
        } else {
            Err(format!("{:?}", x.outcome()))
        }
    }
}
