-- Broker CSV imports are idempotent: the fingerprint is a canonical description of
-- the imported row, so re-importing the same file cannot create duplicate ledger
-- entries. Manually entered transactions leave it null.
alter table public.transactions
  add column if not exists import_fingerprint text;

create unique index if not exists transactions_user_import_fingerprint_idx
  on public.transactions (user_id, import_fingerprint)
  where import_fingerprint is not null;
