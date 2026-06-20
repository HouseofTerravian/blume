-- Proof-of-Use: allow the `publish-confirmed` source on thq_artifacts.
-- Confirmed external publication is distinct from publish INTENT ('published').
-- Idempotent: drops the existing source CHECK (if present) and re-adds the widened set.

alter table thq_artifacts drop constraint if exists thq_artifacts_source_check;

alter table thq_artifacts
  add constraint thq_artifacts_source_check
  check (source in ('blume-generated','manual','imported','published','publish-confirmed','system'));
