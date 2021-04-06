#![deny(warnings)]

use std::{cmp::Ordering, collections::HashMap, convert::TryInto};

use mg_core::{
    fraction::Fraction,
    nft::{
        ApproveMsg, Collectible, ContractMetadata, GateId, NonFungibleTokenApprovalMgmt,
        NonFungibleTokenCore, Token, TokenApproval, TokenId, TokenMetadata,
    },
};
use near_env::near_envlog;
use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    collections::{LookupMap, UnorderedMap, UnorderedSet},
    env, ext_contract,
    json_types::{ValidAccountId, U64},
    log, near_bindgen, setup_alloc, AccountId, PanicOnDefault,
};

setup_alloc!();

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
    /// Admin account is only account allowed to make certain calls.
    admin_id: AccountId,
    /// Metadata describing this NFT contract
    metadata: ContractMetadata,
    /// Indicates the minimum allowed `royalty` to be set on a `Collectible` when an Artist creates it.
    min_royalty: Fraction,
    /// Indicates the minimum allowed `royalty` to be set on a `Collectible` when an Artist creates it.
    max_royalty: Fraction,
}

#[near_envlog(skip_args, only_pub)]
#[near_bindgen]
impl Contract {
    #[init]
    pub fn init(
        admin_id: ValidAccountId,
        metadata: ContractMetadata,
        min_royalty: Fraction,
        max_royalty: Fraction,
    ) -> Self {
        Self {
            collectibles: UnorderedMap::new(vec![b'0']),
            collectibles_by_creator: LookupMap::new(vec![b'1']),
            tokens: UnorderedMap::new(vec![b'2']),
            tokens_by_owner: LookupMap::new(vec![b'3']),
            admin_id: admin_id.as_ref().to_string(),
            metadata,
            min_royalty,
            max_royalty,
        }
    }

    /// Creates a new `Collectible`, identified by `gate_id`.
    /// The `supply` indicates maximum supply for this collectible.
    /// The `royalty` indicates the royalty (as percentage) paid to the creator (`predecessor_account_id`).
    /// This royalty is paid when any `Token` is being resold in any marketplace.
    pub fn create_collectible(
        &mut self,
        gate_id: String,
        title: String,
        description: String,
        supply: U64,
        gate_url: String,
        royalty: Fraction,
    ) {
        if royalty.cmp(&self.min_royalty) == Ordering::Less {
            panic!("Royalty `{}` of `{}` is less than min", royalty, gate_id);
        }
        if royalty.cmp(&self.max_royalty) == Ordering::Greater {
            panic!("Royalty `{}` of `{}` is greater than max", royalty, gate_id);
        }
        if self.collectibles.get(&gate_id).is_some() {
            panic!("Gate ID `{}` already exists", gate_id);
        }
        if supply.0 == 0 {
            panic!("Gate ID `{}` must have a positive supply", gate_id);
        }

        let creator_id = env::predecessor_account_id();

        let collectible = Collectible {
            gate_id,
            creator_id,
            current_supply: supply,
            gate_url,
            minted_tokens: Vec::new(),
            royalty,
            metadata: TokenMetadata {
                title: Some(title),
                description: Some(description),
                media: None,
                media_hash: None,
                copies: Some(supply),
                issued_at: None,
                expires_at: None,
                starts_at: None,
                updated_at: None,
                extra: None,
                reference: None,
                reference_hash: None,
            },
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
            None => panic!("Gate ID `{}` was not found", gate_id),
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

    pub fn claim_token(&mut self, gate_id: String) -> TokenId {
        match self.collectibles.get(&gate_id) {
            None => env::panic(b"Gate id not found"),
            Some(mut collectible) => {
                if collectible.current_supply.0 == 0 {
                    env::panic(b"All tokens for this gate id have been claimed");
                }

                let owner_id = env::predecessor_account_id();
                let now = env::block_timestamp();

                let token_id = self.tokens.len();
                let token = Token {
                    token_id: U64::from(token_id),
                    gate_id: gate_id.clone(),
                    owner_id,
                    created_at: now,
                    modified_at: now,
                    sender_id: "".to_string(),
                    approvals: HashMap::new(),
                    approval_counter: U64::from(0),
                };
                self.insert_token(&token);

                collectible.current_supply.0 = collectible.current_supply.0 - 1;
                self.collectibles.insert(&gate_id, &collectible);

                U64::from(token_id)
            }
        }
    }

    /// Returns all `Token`s owned by `owner_id`.
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

    /// Gets the `Token` with given `token_id`.
    /// Panics otherwise.
    fn get_token(&self, token_id: TokenId) -> Token {
        match self.tokens.get(&token_id) {
            None => panic!("The token id `{}` was not found", token_id.0),
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
            None => panic!("Could not delete token `{}` since account `{}` does not have tokens to delete from", token_id.0, owner_id),
            Some(mut list) => {
                if !list.remove(&token_id) {
                    panic!("Token `{}` does not belong to account `{}`", token_id.0, owner_id);
                }
                self.tokens_by_owner.insert(&owner_id, &list);

                let was_removed = self.tokens.remove(&token_id);
                assert!(was_removed.is_some());
            }
        }
    }
}

#[near_envlog(skip_args, only_pub)]
#[near_bindgen]
impl NonFungibleTokenCore for Contract {
    fn nft_metadata(&self) -> ContractMetadata {
        self.metadata.clone()
    }

    fn nft_transfer(
        &mut self,
        receiver_id: ValidAccountId,
        token_id: TokenId,
        enforce_approval_id: Option<U64>,
        memo: Option<String>,
    ) {
        let sender_id = env::predecessor_account_id();
        let mut token = self.get_token(token_id);

        if sender_id != token.owner_id && token.approvals.get(&sender_id).is_none() {
            panic!("Sender `{}` is not authorized to make transfer", sender_id);
        }

        if &token.owner_id == receiver_id.as_ref() {
            panic!("The token owner and the receiver should be different");
        }

        if let Some(enforce_approval_id) = enforce_approval_id {
            let TokenApproval {
                approval_id,
                min_price: _,
            } = token
                .approvals
                .get(receiver_id.as_ref())
                .expect("Receiver not an approver of this token.");
            if approval_id != &enforce_approval_id {
                panic!("The approval_id is different from enforce_approval_id");
            }
        }

        if let Some(memo) = memo {
            log!("Memo: {}", memo);
        }

        self.delete_token_from(token_id, &token.owner_id);

        token.owner_id = receiver_id.as_ref().to_string();
        token.sender_id = sender_id;
        token.modified_at = env::block_timestamp();
        self.insert_token(&token);
    }

    fn nft_total_supply(&self) -> U64 {
        U64::from(self.tokens.len())
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.get(&token_id)
    }
}

#[ext_contract(market)]
pub trait NonFungibleTokenApprovalsReceiver {
    fn nft_on_approve(
        &mut self,
        token_id: TokenId,
        owner_id: ValidAccountId,
        approval_id: U64,
        msg: String,
    );
}

#[near_envlog(skip_args, only_pub)]
#[near_bindgen]
impl NonFungibleTokenApprovalMgmt for Contract {
    fn nft_approve(&mut self, token_id: TokenId, account_id: ValidAccountId, msg: Option<String>) {
        let min_price = {
            if let Some(msg) = msg.clone() {
                let approve_msg = near_sdk::serde_json::from_str::<ApproveMsg>(&msg)
                    .expect("Could not find min_price in msg");
                approve_msg.min_price
            } else {
                panic!("The msg argument must contain the minimum price");
            }
        };

        let owner_id = env::predecessor_account_id();

        let mut token = self.get_token(token_id);

        if &owner_id != &token.owner_id {
            panic!("Account `{}` does not own token `{}`", owner_id, token_id.0);
        }

        token.approval_counter.0 = token.approval_counter.0 + 1;
        token.approvals.insert(
            account_id.clone().into(),
            TokenApproval {
                approval_id: token.approval_counter,
                min_price,
            },
        );
        self.tokens.insert(&token_id, &token);

        market::nft_on_approve(
            token_id,
            owner_id.try_into().unwrap(),
            U64::from(token.approval_counter),
            msg.unwrap(),
            account_id.as_ref(),
            0,
            env::prepaid_gas() / 3,
        );
    }

    fn nft_revoke(&mut self, token_id: TokenId, account_id: ValidAccountId) {
        let owner_id = env::predecessor_account_id();
        let mut token = self.get_token(token_id);
        if &owner_id != &token.owner_id {
            panic!("Account `{}` does not own token `{}`", owner_id, token_id.0);
        }
        if token.approvals.remove(account_id.as_ref()).is_none() {
            panic!("Could not revoke approval for `{}`", account_id.as_ref());
        }
        self.tokens.insert(&token_id, &token);
    }

    fn nft_revoke_all(&mut self, token_id: TokenId) {
        let owner_id = env::predecessor_account_id();
        let mut token = self.get_token(token_id);
        if &owner_id != &token.owner_id {
            panic!("Account `{}` does not own token `{}`", owner_id, token_id.0);
        }
        token.approvals.clear();
        self.tokens.insert(&token_id, &token);
    }
}

fn get_key_prefix(prefix: u8, key: &[u8]) -> Vec<u8> {
    let mut key_prefix = Vec::with_capacity(33);
    key_prefix.push(prefix);
    key_prefix.extend(env::sha256(key));
    key_prefix
}
