near_sdk_sim::lazy_static_include::lazy_static_include_bytes! {
    NFT_WASM_BYTES => "../target/wasm32-unknown-unknown/release/mg_nft.wasm",
    MARKET_WASM_BYTES => "../target/wasm32-unknown-unknown/release/mg_market.wasm"
}

use near_sdk_sim::call;
use near_sdk_sim::view;
use near_sdk_sim::{deploy, init_simulator, to_yocto, ContractAccount, UserAccount};

use mg_market::MarketContractContract as MarketContract;
use mg_nft::NftContractContract as NftContract;

const NFT_ID: &str = "nft";
const MARKET_ID: &str = "market";

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

pub fn init(
) -> (UserAccount, ContractAccount<NftContract>, ContractAccount<MarketContract>, UserAccount) {
    let root = init_simulator(None);
    let alice = root.create_user("alice".to_string(), to_yocto("100"));
    let admin = root.create_user("admin".to_string(), to_yocto("100"));
    let mintgate = root.create_user("mintgate".to_string(), to_yocto("100"));
    // uses default values for deposit and gas
    let ft = deploy!(
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
        mg_core::Fraction{num:10,den:100}
        )
    );
    // register_user(&alice);

    let defi = deploy!(
        contract: MarketContract,
        contract_id: MARKET_ID,
        bytes: &MARKET_WASM_BYTES,
        signer_account: root,
        deposit: near_sdk_sim::STORAGE_AMOUNT * 10,
        gas: near_sdk_sim::DEFAULT_GAS,
        init_method: init(
            mg_core::Fraction{num:1,den:100},
            mintgate.valid_account_id()
        )
    );

    (root, ft, defi, alice)
}

#[test]
fn payouts() {
    let (_root, contract, _alice, a) = init();

    call!(
        a,
        contract.create_collectible(
            "123".into(),
            "My collectible".to_string(),
            "NFT description".to_string(),
            near_sdk::json_types::U64::from(10),
            "someurl".to_string(),
            "5/100".parse().unwrap()
        )
    );

    let actual: Option<mg_core::Collectible> =
        view!(contract.get_collectible_by_gate_id("123".to_string())).unwrap_json();
    assert!(actual.is_some());
    println!("{:?}", actual);


    let tid: Option<mg_core::TokenId> = call!(a, contract.claim_token("123".into())).unwrap_json();
    println!("{:?}", tid.unwrap());

    let tid: Option<mg_core::TokenId> = call!(a, contract.claim_token("123".into())).unwrap_json();
    println!("{:?}", tid.unwrap());

    // assert_eq!("expected", actual);
}
