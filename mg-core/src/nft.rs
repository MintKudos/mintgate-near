use crate::fraction::Fraction;
use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    collections::UnorderedMap,
    ext_contract,
    json_types::{ValidAccountId, U64},
    serde::Serialize,
    AccountId, Balance,
};

/// The `GateId` type represents the identifier of each `Collectible`.
pub type GateId = String;

#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[cfg_attr(not(target_arch = "wasm"), derive(Debug))]
#[serde(crate = "near_sdk::serde")]
pub struct Collectible {
    pub gate_id: GateId,
    pub creator_id: AccountId,
    pub title: String,
    pub description: String,
    pub current_supply: u64,
    pub gate_url: String,
    pub minted_tokens: Vec<TokenId>,
    pub royalty: Fraction,
}

/// The `TokenId` type represents the identifier of each `Token`.
pub type TokenId = u64;

#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Token {
    /// The unique identifier for a `Token`.
    /// Any two different tokens, will have different `token_id`s,
    /// even if they belong to different `gate_id`s.
    pub token_id: TokenId,
    pub gate_id: GateId,
    /// The owner of this token.
    pub owner_id: AccountId,
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

pub trait NonFungibleTokenCore {
    fn nft_transfer(
        &mut self,
        receiver_id: ValidAccountId,
        token_id: TokenId,
        enforce_approval_id: Option<U64>,
        memo: Option<String>,
    );

    fn nft_total_supply(&self) -> U64;

    fn nft_token(&self, token_id: TokenId) -> Token;
}

pub trait NonFungibleToken178ApprovalMgmt {
    fn nft_approve(&mut self, token_id: TokenId, account_id: ValidAccountId, msg: Option<String>);

    fn nft_revoke(&mut self, token_id: TokenId, account_id: ValidAccountId);

    fn nft_revoke_all(&mut self, token_id: TokenId);
}

#[ext_contract(market)]
pub trait NonFungibleTokenApprovalsReceiver {
    fn nft_on_approve(
        &mut self,
        token_id: TokenId,
        owner_id: AccountId,
        approval_id: U64,
        msg: String,
    );
}
