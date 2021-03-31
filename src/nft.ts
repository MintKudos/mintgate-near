import { Fraction } from './auxiliary';

export interface Collectible {
  gate_id: string;
  creator_id: string;
  title: string;
  description: string;
  current_supply: number;
  gate_url: string;
  minted_tokens: [];
  royalty: Fraction;
}

export interface Token {
  token_id: number;
  gate_id: string;
  owner_id: string;
  created_at: number;
  modified_at: number;
  sender_id: string;
  approvals: [];
}
