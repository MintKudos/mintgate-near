#![deny(warnings)]

use mg_core::Fraction;
use near_env::near_envlog;
use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    collections::{LookupMap, UnorderedMap, UnorderedSet},
    env,
    json_types::{ValidAccountId, U64},
    near_bindgen,
    serde::Serialize,
    AccountId, Balance, PanicOnDefault,
};

#[global_allocator]
static ALLOC: near_sdk::wee_alloc::WeeAlloc<'_> = near_sdk::wee_alloc::WeeAlloc::INIT;

/// Entry point data storage for mintgate core contract.
/// Since the contract needs custom initialization,
/// we use `PanicOnDefault` to avoid default construction.
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    /// Represents a mapping from `GateId` into `Collectible`.
    collectibles: UnorderedMap<GateId, Collectible>,
    collectibles_by_creator: LookupMap<AccountId, UnorderedSet<GateId>>,
    tokens: UnorderedMap<TokenId, Token>,
    tokens_by_owner: LookupMap<AccountId, UnorderedSet<TokenId>>,
    /// Percentage fee to pay back to Mintgate when a `Token` is being sold.
    /// This field can be set up when the contract is deployed.
    mintgate_fee: Fraction,
}

/// The `GateId` type represents the identifier of each `Collectible`.
pub type GateId = String;

/// The `TokenId` type represents the identifier of each `Token`.
type TokenId = u64;

#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[cfg_attr(not(target_arch = "wasm"), derive(Debug))]
#[serde(crate = "near_sdk::serde")]
pub struct Collectible {
    gate_id: GateId,
    creator_id: AccountId,
    title: String,
    description: String,
    pub current_supply: u64,
    gate_url: String,
    minted_tokens: Vec<TokenId>,
    royalty: Fraction,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Token {
    /// The unique identifier for a `Token`.
    /// Any two different tokens, will have different `token_id`s,
    /// even if they belong to different `gate_id`s.
    token_id: TokenId,
    gate_id: GateId,
    /// The owner of this token.
    owner_id: AccountId,
    /// Represents when this `Token` was minted, in nanoseconds.
    /// Once this `Token` is minted, this field remains unchanged.
    pub created_at: u64,
    /// Represents when this `Token` was last modified, in nanoseconds.
    /// Either when created or transferred.
    pub modified_at: u64,
    /// If this `Token` was transferred, this field holds the previous owner.
    /// Otherwise is empty.
    pub sender_id: AccountId,
    /// Holds the list of accounts that can `transfer_token`s on behalf of the token's owner.
    /// It is mapped to the minimum amount that this token should be transfer for.
    #[serde(skip_serializing)]
    pub approvals: UnorderedMap<AccountId, Balance>,
}

#[near_envlog(skip_args, only_pub)]
#[near_bindgen]
impl Contract {
    #[init]
    pub fn init(mintgate_fee: Fraction) -> Self {
        Self {
            collectibles: UnorderedMap::new(vec![b'0']),
            collectibles_by_creator: LookupMap::new(vec![b'1']),
            tokens: UnorderedMap::new(vec![b'2']),
            tokens_by_owner: LookupMap::new(vec![b'3']),
            mintgate_fee,
        }
    }

    pub fn create_collectible(
        &mut self,
        gate_id: String,
        title: String,
        description: String,
        supply: U64,
        gate_url: String,
        royalty: Fraction,
    ) {
        let creator_id = env::predecessor_account_id();

        let collectible = Collectible {
            gate_id,
            creator_id,
            title,
            description,
            current_supply: supply.0,
            gate_url,
            minted_tokens: Vec::new(),
            royalty,
        };
        self.collectibles.insert(&collectible.gate_id, &collectible);

        let mut gids = self
            .collectibles_by_creator
            .get(&collectible.creator_id)
            .unwrap_or_else(|| {
                UnorderedSet::new(get_key_prefix(b'c', &collectible.creator_id.as_bytes()))
            });
        gids.insert(&collectible.gate_id);

        self.collectibles_by_creator
            .insert(&collectible.creator_id, &gids);
    }

    /// Returns the `Collectible` with the given `gate_id`.
    /// Panics otherwise.
    pub fn get_collectible_by_gate_id(&self, gate_id: String) -> Collectible {
        match self.collectibles.get(&gate_id) {
            None => env::panic("Given gate_id was not found".as_bytes()),
            Some(collectible) => {
                assert!(collectible.gate_id == gate_id);
                collectible
            }
        }
    }

    pub fn get_collectibles_by_creator(&self, creator_id: ValidAccountId) -> Vec<Collectible> {
        match self.collectibles_by_creator.get(creator_id.as_ref()) {
            None => Vec::new(),
            Some(list) => list
                .iter()
                .map(|gate_id| {
                    let collectible = self
                        .collectibles
                        .get(&gate_id)
                        .expect("Collectible not found");
                    assert!(collectible.gate_id == gate_id);
                    assert!(&collectible.creator_id == creator_id.as_ref());
                    collectible
                })
                .collect(),
        }
    }

    pub fn claim_token(&mut self, gate_id: String) -> U64 {
        match self.collectibles.get(&gate_id) {
            None => env::panic(b"Gate id not found"),
            Some(mut collectible) => {
                if collectible.current_supply == 0 {
                    env::panic(b"All tokens for this gate id have been claimed");
                }

                let owner_id = env::predecessor_account_id();
                let now = env::block_timestamp();

                let token_id = self.tokens.len();
                let token = Token {
                    token_id,
                    gate_id: gate_id.clone(),
                    owner_id,
                    created_at: now,
                    modified_at: now,
                    sender_id: "".to_string(),
                    approvals: UnorderedMap::new(get_key_prefix(b'a', &token_id.to_ne_bytes())),
                };
                self.insert_token(&token);

                collectible.current_supply -= 1;
                self.collectibles.insert(&gate_id, &collectible);

                U64::from(token_id)
            }
        }
    }

    /// Returns
    pub fn get_tokens_by_owner(&self, owner_id: ValidAccountId) -> Vec<Token> {
        match self.tokens_by_owner.get(owner_id.as_ref()) {
            None => Vec::new(),
            Some(list) => list
                .iter()
                .map(|token_id| {
                    let token = self.tokens.get(&token_id).expect("Token not found");
                    assert!(token.token_id == token_id);
                    assert!(&token.owner_id == owner_id.as_ref());
                    token
                })
                .collect(),
        }
    }

    /// Transfer the Corgi with the given `id` to `receiver`.
    /// Only the `owner` of the corgi can make such a transfer.
    pub fn transfer_token(&mut self, receiver: ValidAccountId, token_id: TokenId) {
        let sender_id = env::predecessor_account_id();
        if sender_id == *receiver.as_ref() {
            env::panic("Self transfers are not allowed".as_bytes());
        }

        let mut token = self.get_token(token_id);

        if sender_id != token.owner_id {
            env::panic("Sender must own Corgi".as_bytes());
        }

        self.delete_token_from(token_id, &sender_id);

        token.owner_id = receiver.as_ref().to_string();
        token.sender_id = sender_id;
        token.modified_at = env::block_timestamp();
        self.insert_token(&token);
    }

    /// Gets the `Token` with given `token_id`.
    /// Panics otherwise.
    fn get_token(&self, token_id: TokenId) -> Token {
        match self.tokens.get(&token_id) {
            None => panic!("The token id `{}` was not found", token_id),
            Some(token) => {
                assert!(token.token_id == token_id);
                token
            }
        }
    }

    /// Inserts the given `Token` into `tokens` and `tokens_by_owner`.
    fn insert_token(&mut self, token: &Token) {
        self.tokens.insert(&token.token_id, token);

        let mut tids = self
            .tokens_by_owner
            .get(&token.owner_id)
            .unwrap_or_else(|| UnorderedSet::new(get_key_prefix(b't', &token.owner_id.as_bytes())));
        tids.insert(&token.token_id);

        self.tokens_by_owner.insert(&token.owner_id, &tids);
    }

    /// Internal method to delete the corgi with `id` owned by `owner`.
    /// Panics if `owner` does not own the corgi with `id`.
    fn delete_token_from(&mut self, token_id: TokenId, owner_id: &AccountId) {
        match self.tokens_by_owner.get(&owner_id) {
            None => panic!("Could not delete token `{}` since account `{}` does not have tokens to delete from", token_id, owner_id),
            Some(mut list) => {
                if !list.remove(&token_id) {
                    panic!("Token `{}` does not belong to account `{}`", token_id, owner_id);
                }
                self.tokens_by_owner.insert(&owner_id, &list);

                let was_removed = self.tokens.remove(&token_id);
                assert!(was_removed.is_some());
            }
        }
    }
}

fn get_key_prefix(prefix: u8, key: &[u8]) -> Vec<u8> {
    let mut key_prefix = Vec::with_capacity(33);
    key_prefix.push(prefix);
    key_prefix.extend(env::sha256(key));
    key_prefix
}