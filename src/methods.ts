export const NftMethods = {
  viewMethods: [
    'get_collectible_by_gate_id',
    'get_collectibles_by_creator',
    'nft_metadata',
    'nft_total_supply',
    'nft_token',
    'get_tokens_by_owner',
  ],
  changeMethods: [
    'init',
    'create_collectible',
    'claim_token',
    'nft_transfer',
    'nft_approve',
    'nft_revoke',
    'nft_revoke_all',
  ],
};

export const MarketMethods = {
  viewMethods: ['get_tokens_for_sale'],
  changeMethods: ['init', 'nft_on_approve'],
};
