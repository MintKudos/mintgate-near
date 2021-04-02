import { Fraction } from './auxiliary';
export interface Collectible {
    gate_id: string;
    creator_id: string;
    title: string;
    description: string;
    current_supply: string;
    gate_url: string;
    minted_tokens: [];
    royalty: Fraction;
}
