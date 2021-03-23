use near_env::near_envlog;
use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    collections::{LookupMap, UnorderedMap, UnorderedSet},
    env,
    json_types::U64,
    near_bindgen,
    serde::{Deserialize, Serialize},
    AccountId,
};

#[global_allocator]
static ALLOC: near_sdk::wee_alloc::WeeAlloc<'_> = near_sdk::wee_alloc::WeeAlloc::INIT;

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct Contract {
    collectibles: UnorderedMap<TokenId, Collectible>,
    collectibles_by_creator: LookupMap<AccountId, UnorderedSet<TokenId>>,
    tokens_by_owner: LookupMap<AccountId, UnorderedSet<u128>>,
}

pub type TokenId = String;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Collectible {
    owner_id: AccountId,
    title: String,
    description: String,
    supply: u64,
    gate_url: String,
}

impl Default for Contract {
    fn default() -> Self {
        Self {
            collectibles: UnorderedMap::new(vec![b'0']),
            collectibles_by_creator: LookupMap::new(vec![b'1']),
            tokens_by_owner: LookupMap::new(vec![b'2']),
        }
    }
}

#[near_envlog(skip_args, only_pub)]
#[near_bindgen]
impl Contract {
    pub fn create_collectible(
        &mut self,
        gate_id: String,
        title: String,
        description: String,
        supply: U64,
        gate_url: String,
    ) {
        let owner_id = env::predecessor_account_id();

        let collectible = Collectible {
            owner_id,
            title,
            description,
            supply: supply.0,
            gate_url,
        };
        self.collectibles.insert(&gate_id, &collectible);

        let mut gids = self
            .collectibles_by_creator
            .get(&collectible.owner_id)
            .unwrap_or_else(|| UnorderedSet::new(get_key_prefix(b'c', &collectible.owner_id)));
        gids.insert(&gate_id);

        self.collectibles_by_creator
            .insert(&collectible.owner_id, &gids);
    }

    pub fn claim_token(&mut self, gate_id: String) -> i32 {
        0
    }
}

fn get_key_prefix(prefix: u8, key: &String) -> Vec<u8> {
    let mut key_prefix = Vec::with_capacity(33);
    key_prefix.push(prefix);
    key_prefix.extend(env::sha256(key.as_bytes()));
    key_prefix
}
