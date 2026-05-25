export interface BrandProfile {
  slug: string;
  name: string;
  domain: string;
  tagline: string;
  voice: {
    archetype: string;
    tone: string;
    personality: string;
    do: string[];
    dont: string[];
    sample_phrases: string[];
  };
  aida: {
    attention_hook: string;
    interest: string;
    desire: string;
    action: string;
  };
  platforms: string[];
  [key: string]: unknown;
}
