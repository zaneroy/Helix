-- ============================================================
-- HELIX STAGE 2A
-- 002 - ACCOUNTING ACCOUNTS / CHART OF ACCOUNTS
--
-- Creates the General Ledger Chart of Accounts foundation.
--
-- IMPORTANT:
-- accounting_accounts is NOT the same as cash_accounts.
--
-- cash_accounts:
--   Operational locations where money physically sits.
--
-- accounting_accounts:
--   General Ledger classification accounts.
-- ============================================================

begin;


-- ============================================================
-- 1. ACCOUNTING ACCOUNTS
-- ============================================================

create table if not exists public.accounting_accounts (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null
    references public.companies(id)
    on delete cascade,

  code text not null,

  name text not null,

  account_type text not null,

  account_subtype text,

  normal_balance text not null,

  system_key text,

  parent_account_id uuid
    references public.accounting_accounts(id)
    on delete restrict,

  description text,

  currency_code text,

  is_system boolean not null default false,

  is_contra boolean not null default false,

  allow_manual_posting boolean not null default true,

  status text not null default 'active',

  sort_order integer not null default 0,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint accounting_accounts_code_not_blank
    check (
      length(trim(code)) > 0
    ),

  constraint accounting_accounts_name_not_blank
    check (
      length(trim(name)) > 0
    ),

  constraint accounting_accounts_type_check
    check (
      account_type in (
        'asset',
        'liability',
        'equity',
        'revenue',
        'cost_of_sales',
        'expense'
      )
    ),

  constraint accounting_accounts_normal_balance_check
    check (
      normal_balance in (
        'debit',
        'credit'
      )
    ),

  constraint accounting_accounts_status_check
    check (
      status in (
        'active',
        'archived'
      )
    ),

  constraint accounting_accounts_currency_check
    check (
      currency_code is null
      or currency_code ~ '^[A-Z]{3}$'
    ),

  constraint accounting_accounts_parent_not_self
    check (
      parent_account_id is null
      or parent_account_id <> id
    ),

  constraint accounting_accounts_company_code_unique
    unique (
      company_id,
      code
    )
);


-- ============================================================
-- 2. UPGRADE COMPATIBILITY
--
-- is_contra was introduced while Stage 2A was being developed.
-- Keeping this here makes the canonical migration safe against
-- an earlier Stage 2A accounting_accounts installation.
-- ============================================================

alter table public.accounting_accounts
add column if not exists is_contra boolean
not null
default false;


-- ============================================================
-- 3. NORMAL BALANCE / CONTRA ACCOUNT RULES
--
-- Standard accounts:
--
-- Asset          = Debit
-- Cost of Sales  = Debit
-- Expense        = Debit
--
-- Liability      = Credit
-- Equity         = Credit
-- Revenue        = Credit
--
-- Contra accounts have the opposite normal balance.
--
-- Examples:
--
-- Accumulated Depreciation
--   Asset + Contra = Credit
--
-- Sales Returns
--   Revenue + Contra = Debit
--
-- Treasury Shares
--   Equity + Contra = Debit
-- ============================================================

alter table public.accounting_accounts
drop constraint if exists
  accounting_accounts_type_balance_check;


alter table public.accounting_accounts
add constraint accounting_accounts_type_balance_check
check (

  (
    is_contra = false

    and (

      (
        account_type in (
          'asset',
          'cost_of_sales',
          'expense'
        )
        and normal_balance = 'debit'
      )

      or

      (
        account_type in (
          'liability',
          'equity',
          'revenue'
        )
        and normal_balance = 'credit'
      )

    )
  )

  or

  (
    is_contra = true

    and (

      (
        account_type in (
          'asset',
          'cost_of_sales',
          'expense'
        )
        and normal_balance = 'credit'
      )

      or

      (
        account_type in (
          'liability',
          'equity',
          'revenue'
        )
        and normal_balance = 'debit'
      )

    )
  )

);


-- ============================================================
-- 4. PERMANENT HELIX SYSTEM KEY
--
-- Account codes and names may later be customized.
--
-- system_key is the permanent internal identifier used by
-- Helix automatic posting.
--
-- Example:
--
-- code:
--   1100
--
-- name:
--   Accounts Receivable
--
-- system_key:
--   accounts_receivable
-- ============================================================

create unique index if not exists
  accounting_accounts_company_system_key_uidx

on public.accounting_accounts (
  company_id,
  system_key
)

where system_key is not null;


-- ============================================================
-- 5. PERFORMANCE INDEXES
-- ============================================================

create index if not exists
  accounting_accounts_company_idx

on public.accounting_accounts(
  company_id
);


create index if not exists
  accounting_accounts_company_type_idx

on public.accounting_accounts(
  company_id,
  account_type
);


create index if not exists
  accounting_accounts_company_status_idx

on public.accounting_accounts(
  company_id,
  status
);


create index if not exists
  accounting_accounts_parent_idx

on public.accounting_accounts(
  parent_account_id
);


create index if not exists
  accounting_accounts_company_sort_idx

on public.accounting_accounts(
  company_id,
  sort_order,
  code
);


-- ============================================================
-- 6. UPDATED_AT TRIGGER
-- ============================================================

create or replace function
public.set_accounting_account_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin

  new.updated_at := now();

  return new;

end;
$$;


drop trigger if exists
  trg_accounting_accounts_updated_at
on public.accounting_accounts;


create trigger
  trg_accounting_accounts_updated_at

before update
on public.accounting_accounts

for each row

execute function
  public.set_accounting_account_updated_at();


-- ============================================================
-- 7. PARENT ACCOUNT COMPANY VALIDATION
--
-- Full hierarchy cycle protection is applied later in
-- 007_accounting_core_hardening.sql.
--
-- This base rule prevents:
--
-- - self-parenting
-- - missing parent accounts
-- - cross-company account hierarchy
-- ============================================================

create or replace function
public.validate_accounting_account_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent_company_id uuid;
begin

  if new.parent_account_id is null then
    return new;
  end if;


  if new.parent_account_id = new.id then

    raise exception
      'An accounting account cannot be its own parent.';

  end if;


  select aa.company_id

  into v_parent_company_id

  from public.accounting_accounts as aa

  where aa.id =
    new.parent_account_id;


  if v_parent_company_id is null then

    raise exception
      'Parent accounting account does not exist.';

  end if;


  if v_parent_company_id <>
     new.company_id then

    raise exception
      'Parent accounting account must belong to the same company.';

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_validate_accounting_account_parent
on public.accounting_accounts;


create trigger
  trg_validate_accounting_account_parent

before insert or update of
  parent_account_id,
  company_id

on public.accounting_accounts

for each row

execute function
  public.validate_accounting_account_parent();


-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================

alter table public.accounting_accounts
enable row level security;


-- ------------------------------------------------------------
-- READ
-- ------------------------------------------------------------

drop policy if exists
  "Admins can read accounting accounts"
on public.accounting_accounts;


create policy
  "Admins can read accounting accounts"

on public.accounting_accounts

for select

to authenticated

using (

  exists (

    select 1

    from public.profiles as p

    where p.id =
      auth.uid()

      and p.role =
        'admin'::user_role

      and p.company_id =
        accounting_accounts.company_id

  )

);


-- ------------------------------------------------------------
-- INSERT
-- ------------------------------------------------------------

drop policy if exists
  "Admins can create accounting accounts"
on public.accounting_accounts;


create policy
  "Admins can create accounting accounts"

on public.accounting_accounts

for insert

to authenticated

with check (

  exists (

    select 1

    from public.profiles as p

    where p.id =
      auth.uid()

      and p.role =
        'admin'::user_role

      and p.company_id =
        accounting_accounts.company_id

  )

  and (

    accounting_accounts.created_by is null

    or accounting_accounts.created_by =
      auth.uid()

  )

);


-- ------------------------------------------------------------
-- UPDATE
-- ------------------------------------------------------------

drop policy if exists
  "Admins can update accounting accounts"
on public.accounting_accounts;


create policy
  "Admins can update accounting accounts"

on public.accounting_accounts

for update

to authenticated

using (

  exists (

    select 1

    from public.profiles as p

    where p.id =
      auth.uid()

      and p.role =
        'admin'::user_role

      and p.company_id =
        accounting_accounts.company_id

  )

)

with check (

  exists (

    select 1

    from public.profiles as p

    where p.id =
      auth.uid()

      and p.role =
        'admin'::user_role

      and p.company_id =
        accounting_accounts.company_id

  )

);


-- ------------------------------------------------------------
-- DELETE
-- ------------------------------------------------------------
--
-- Deliberately no DELETE policy.
--
-- Accounting accounts should be archived instead of
-- physically removed from accounting history.
-- ============================================================


-- ============================================================
-- 9. DOCUMENTATION
-- ============================================================

comment on table public.accounting_accounts is
  'Helix General Ledger Chart of Accounts. Separate from operational cash_accounts.';


comment on column public.accounting_accounts.code is
  'Company-visible General Ledger account code.';


comment on column public.accounting_accounts.system_key is
  'Permanent Helix internal identifier used by automatic accounting posting.';


comment on column public.accounting_accounts.is_system is
  'True when the account belongs to the Helix default Chart of Accounts.';


comment on column public.accounting_accounts.is_contra is
  'True when the account uses the opposite normal balance from its primary account type.';


comment on column public.accounting_accounts.allow_manual_posting is
  'Controls whether manual journal entries may post directly to this account.';


comment on column public.accounting_accounts.parent_account_id is
  'Optional parent account used to construct a hierarchical Chart of Accounts.';


comment on column public.accounting_accounts.sort_order is
  'Stable display ordering for Chart of Accounts and financial reporting.';


commit;


-- ============================================================
-- END
-- ============================================================
