import { Fraction } from './auxiliary';

export interface TokenMetadata {
  title?: string;
  description?: string;
  media?: string;
  media_hash?: string;
  copies?: string;
  issued_at?: string;
  expires_at?: string;
  starts_at?: string;
  updated_at?: string;
  extra?: string;
  reference?: string;
  reference_hash?: string;
}

export interface Collectible {
  gate_id: string;
  creator_id: string;
  current_supply: string;
  gate_url: string;
  minted_tokens: [];
  royalty: Fraction;
  metadata: TokenMetadata;
}

export interface Token {
  token_id: string;
  gate_id: string;
  owner_id: string;
  created_at: number;
  modified_at: number;
  sender_id: string;
  approvals: [];
}
