-- ============================================================
-- HELIX STAGE 2A
-- 001 - ACCOUNTING CORE PREFLIGHT
-- READ ONLY - MAKES NO DATABASE CHANGES
-- ============================================================

-- 1. Confirm the key column types we will reference.
select
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'companies' and column_name in (
      'id',
      'name',
      'currency'
    ))
    or
    (table_name = 'profiles' and column_name in (
      'id',
      'company_id',
      'role'
    ))
    or
    (table_name = 'cash_accounts' and column_name in (
      'id',
      'company_id',
      'account_type',
      'currency',
      'opening_balance',
      'status'
    ))
    or
    (table_name = 'cash_ledger' and column_name in (
      'id',
      'company_id',
      'account_id',
      'source_type',
      'source_id',
      'direction',
      'amount',
      'status',
      'reconciled'
    ))
  )
order by table_name, ordinal_position;


-- 2. Existing primary keys / foreign keys / checks.
select
  conrelid::regclass::text as table_name,
  conname as constraint_name,
  case contype
    when 'p' then 'PRIMARY KEY'
    when 'f' then 'FOREIGN KEY'
    when 'u' then 'UNIQUE'
    when 'c' then 'CHECK'
    else contype::text
  end as constraint_type,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.companies'::regclass,
  'public.profiles'::regclass,
  'public.cash_accounts'::regclass,
  'public.cash_ledger'::regclass
)
order by table_name, constraint_type, constraint_name;


-- 3. Confirm Row Level Security status.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'companies',
    'profiles',
    'cash_accounts',
    'cash_ledger'
  )
order by c.relname;


-- 4. Existing RLS policies.
select
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'companies',
    'profiles',
    'cash_accounts',
    'cash_ledger'
  )
order by tablename, policyname;
