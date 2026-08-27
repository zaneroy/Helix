begin;

-- ============================================================
-- HELIX STAGE 2D
-- Operational Financial Accounts -> General Ledger Mapping
-- ============================================================

alter table public.cash_accounts
add column if not exists accounting_account_id uuid;


-- ------------------------------------------------------------
-- FK: cash account -> GL account
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_accounts_accounting_account_id_fkey'
      and conrelid = 'public.cash_accounts'::regclass
  ) then
    alter table public.cash_accounts
    add constraint cash_accounts_accounting_account_id_fkey
    foreign key (accounting_account_id)
    references public.accounting_accounts(id)
    on delete restrict;
  end if;
end
$$;


-- ------------------------------------------------------------
-- One GL account may belong to only one operational account
-- ------------------------------------------------------------

create unique index if not exists
  cash_accounts_accounting_account_id_unique
on public.cash_accounts(accounting_account_id)
where accounting_account_id is not null;


-- ============================================================
-- Same-company link protection
-- ============================================================

create or replace function public.validate_cash_account_gl_link()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_gl_company_id uuid;
begin
  if new.accounting_account_id is null then
    return new;
  end if;

  select aa.company_id
  into v_gl_company_id
  from public.accounting_accounts aa
  where aa.id = new.accounting_account_id;

  if v_gl_company_id is null then
    raise exception
      'The linked General Ledger account does not exist.';
  end if;

  if v_gl_company_id <> new.company_id then
    raise exception
      'A financial account cannot be linked to a General Ledger account from another company.';
  end if;

  return new;
end;
$$;


drop trigger if exists
  trg_validate_cash_account_gl_link
on public.cash_accounts;

create trigger trg_validate_cash_account_gl_link
before insert or update of
  accounting_account_id,
  company_id
on public.cash_accounts
for each row
execute function public.validate_cash_account_gl_link();


-- ============================================================
-- Create / return the GL account linked to a cash account
-- ============================================================

create or replace function public.ensure_cash_account_gl_mapping(
  p_cash_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cash public.cash_accounts%rowtype;

  v_parent_id uuid;
  v_parent_code text;

  v_parent_system_key text;
  v_account_type text;
  v_account_subtype text;
  v_normal_balance text;

  v_gl_code text;
  v_gl_id uuid;

  v_authorized boolean;
begin
  select *
  into v_cash
  from public.cash_accounts
  where id = p_cash_account_id
  for update;

  if not found then
    raise exception
      'Financial account % was not found.',
      p_cash_account_id;
  end if;


  -- ----------------------------------------------------------
  -- Security
  --
  -- SQL migrations run with auth.uid() = null.
  -- Normal app calls must belong to the same company.
  -- ----------------------------------------------------------

  if auth.uid() is not null then
    select exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = v_cash.company_id
    )
    into v_authorized;

    if not coalesce(v_authorized, false) then
      raise exception
        'You do not have access to this financial account.';
    end if;
  end if;


  -- ----------------------------------------------------------
  -- Already mapped -> idempotent return
  -- ----------------------------------------------------------

  if v_cash.accounting_account_id is not null then
    return v_cash.accounting_account_id;
  end if;


  -- ----------------------------------------------------------
  -- Determine GL parent and accounting behaviour
  -- ----------------------------------------------------------

  case v_cash.account_type

    when 'credit_card' then
      v_parent_system_key := 'credit_card_payable';
      v_account_type := 'liability';
      v_account_subtype := 'credit_card';
      v_normal_balance := 'credit';

    when 'loan' then
      v_parent_system_key := 'short_term_loans';
      v_account_type := 'liability';
      v_account_subtype := 'short_term_debt';
      v_normal_balance := 'credit';

    when 'bank' then
      v_parent_system_key := 'cash_and_cash_equivalents';
      v_account_type := 'asset';
      v_account_subtype := 'bank';
      v_normal_balance := 'debit';

    when 'cash' then
      v_parent_system_key := 'cash_and_cash_equivalents';
      v_account_type := 'asset';
      v_account_subtype := 'cash';
      v_normal_balance := 'debit';

    when 'petty_cash' then
      v_parent_system_key := 'cash_and_cash_equivalents';
      v_account_type := 'asset';
      v_account_subtype := 'petty_cash';
      v_normal_balance := 'debit';

    when 'payment_processor' then
      v_parent_system_key := 'cash_and_cash_equivalents';
      v_account_type := 'asset';
      v_account_subtype := 'payment_processor';
      v_normal_balance := 'debit';

    when 'other' then
      v_parent_system_key := 'cash_and_cash_equivalents';
      v_account_type := 'asset';
      v_account_subtype := 'other_cash';
      v_normal_balance := 'debit';

    else
      raise exception
        'Unsupported financial account type: %',
        v_cash.account_type;

  end case;


  -- ----------------------------------------------------------
  -- Find protected system parent
  -- ----------------------------------------------------------

  select
    aa.id,
    aa.code
  into
    v_parent_id,
    v_parent_code
  from public.accounting_accounts aa
  where aa.company_id = v_cash.company_id
    and aa.system_key = v_parent_system_key
    and aa.status = 'active'
  limit 1;

  if v_parent_id is null then
    raise exception
      'Required General Ledger parent account "%" is not configured.',
      v_parent_system_key;
  end if;


  -- ----------------------------------------------------------
  -- Stable unique child code
  --
  -- Examples:
  -- 1000.A1B2C3D4E5F6
  -- 2200.123456789ABC
  -- ----------------------------------------------------------

  v_gl_code :=
    v_parent_code
    || '.'
    || upper(
      substring(
        replace(v_cash.id::text, '-', '')
        from 1 for 12
      )
    );


  -- ----------------------------------------------------------
  -- Create linked GL account
  -- ----------------------------------------------------------

  insert into public.accounting_accounts (
    company_id,
    code,
    name,
    account_type,
    account_subtype,
    normal_balance,
    parent_account_id,
    description,
    currency_code,
    is_contra,
    allow_manual_posting,
    status,
    sort_order,
    created_by
  )
  values (
    v_cash.company_id,
    v_gl_code,
    v_cash.name,
    v_account_type,
    v_account_subtype,
    v_normal_balance,
    v_parent_id,
    'Operational financial account linked to cash_accounts.',
    upper(v_cash.currency),
    false,
    true,
    case
      when v_cash.status = 'active'
        then 'active'
      else 'archived'
    end,
    900000,
    v_cash.created_by
  )
  returning id
  into v_gl_id;


  -- ----------------------------------------------------------
  -- Persist permanent link
  -- ----------------------------------------------------------

  update public.cash_accounts
  set accounting_account_id = v_gl_id
  where id = v_cash.id;


  return v_gl_id;
end;
$$;


revoke all
on function public.ensure_cash_account_gl_mapping(uuid)
from public;

grant execute
on function public.ensure_cash_account_gl_mapping(uuid)
to authenticated;


-- ============================================================
-- Backfill every existing operational financial account
-- ============================================================

do $$
declare
  v_account record;
begin
  for v_account in
    select ca.id
    from public.cash_accounts ca
    where ca.accounting_account_id is null
    order by ca.created_at nulls last, ca.id
  loop
    perform public.ensure_cash_account_gl_mapping(
      v_account.id
    );
  end loop;
end
$$;


commit;


-- ============================================================
-- Verification
-- ============================================================

select
  ca.name as operational_account,
  ca.account_type,
  ca.currency,
  ca.opening_balance,
  aa.code as gl_code,
  aa.name as gl_account,
  aa.account_type as gl_type,
  parent.code as parent_code,
  parent.name as parent_account
from public.cash_accounts ca
left join public.accounting_accounts aa
  on aa.id = ca.accounting_account_id
left join public.accounting_accounts parent
  on parent.id = aa.parent_account_id
order by
  ca.company_id,
  ca.created_at nulls last,
  ca.name;