-- Artifact / Router-Tag Spine — Supabase DDL (S1/S2)
-- Spec: build/ARTIFACT_SPINE_SPEC_v1.md §7. Prefix matches live convention (thq_).
-- Apply to Supabase project wxinipsficonhfifjqek. Local JSON store works without this;
-- this table is the best-effort mirror + the production substrate.

-- ── Canonical vault registry (slug-keyed; integers are legacy-compat only) ──
create table if not exists thq_vault_registry (
  slug         text primary key,
  doctrine_no  int  not null,
  display      text not null,
  tier         text not null check (tier in ('core','extended','sovereign')),
  legacy_int   int,
  active       boolean not null default true
);

insert into thq_vault_registry (slug, doctrine_no, display, tier, legacy_int, active) values
  ('brand-assets',      1,  'Brand Assets',          'core',      4,    true),
  ('published-works',   2,  'Published Works',       'core',      1,    true),
  ('proof-of-use',      3,  'Proof of Use',          'core',      2,    true),
  ('commerce-evidence', 4,  'Commerce Evidence',     'core',      3,    true),
  ('creative-drafts',   5,  'Creative Drafts',       'core',      6,    true),
  ('internal-notes',    6,  'Internal Notes',        'core',      7,    true),
  ('legal',             7,  'Legal',                 'core',      5,    true),
  ('investor',          8,  'Investor',              'core',      8,    true),
  ('rnd',               9,  'R&D / Experimental AI', 'extended',  null, true),
  ('compliance',        10, 'Compliance',            'extended',  null, false),
  ('memory',            11, 'Memory',                'sovereign', null, true),
  ('library',           12, 'Library of Toravian',   'sovereign', null, true)
on conflict (slug) do nothing;

-- ── Artifacts (the atomic unit + router-tag) ──
create table if not exists thq_artifacts (
  uuid         uuid primary key,
  brand        text not null,
  vault        text not null references thq_vault_registry(slug),
  switch       int check (switch between 1 and 7),
  title        text not null,
  body         text,
  ref          text,
  source       text not null check (source in ('blume-generated','manual','imported','published','system')),
  version      int  not null default 1 check (version >= 1),
  parent_uuid  uuid,
  hash         text not null,
  timestamp    timestamptz not null,
  updated_at   timestamptz not null,
  metadata     jsonb not null default '{}'::jsonb
);

create index if not exists idx_thq_artifacts_brand_vault   on thq_artifacts (brand, vault);
create index if not exists idx_thq_artifacts_brand_switch  on thq_artifacts (brand, switch);
create index if not exists idx_thq_artifacts_hash          on thq_artifacts (hash);
create index if not exists idx_thq_artifacts_parent        on thq_artifacts (parent_uuid);
