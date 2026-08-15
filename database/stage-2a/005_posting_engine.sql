-- ============================================================
-- HELIX STAGE 2A
-- 005 - JOURNAL POSTING ENGINE
--
-- Converts valid draft journals into immutable posted
-- accounting history.
--
-- Enforces:
--
--   authenticated company Admin
--   draft-only posting
--   company base currency
--   valid accounting period
--   period lock rules
--   minimum two journal lines
--   debit = credit in base currency
--   active accounting accounts
--   manual control-account restrictions
--   safe sequential journal numbering
--
-- Creates:
--
--   accounting_journal_counters
--   post_journal_entry(uuid)
--   general_ledger_view
--
-- Reversal support and final integrity hardening are installed
-- later in:
--
--   007_accounting_core_hardening.sql
-- ============================================================

begin;


-- ============================================================
-- 1. COMPANY JOURNAL NUMBER COUNTER
--
-- Each company receives its own journal sequence:
--
-- Company A:
--   JE 1
--   JE 2
--   JE 3
--
-- Company B:
--   JE 1
--   JE 2
--
-- A dedicated counter avoids unsafe:
--
--   max(entry_number) + 1
--
-- behaviour during concurrent postings.
-- ============================================================

create table if not exists
public.accounting_journal_counters (
  company_id uuid primary key
    references public.companies(id)
    on delete cascade,

  next_number bigint not null default 1,

  updated_at timestamptz not null default now(),

  constraint accounting_journal_counters_next_number_check
    check (
      next_number > 0
    )
);


alter table public.accounting_journal_counters
enable row level security;


-- Internal accounting infrastructure.
-- Application users never manipulate this table directly.

revoke all
on public.accounting_journal_counters
from anon, authenticated;


comment on table public.accounting_journal_counters is
  'Internal Helix counter used to allocate sequential General Ledger journal numbers safely per company.';


comment on column public.accounting_journal_counters.next_number is
  'Next journal entry number available for this company.';


-- ============================================================
-- 2. PROTECT POSTED JOURNAL HEADERS
--
-- At this stage:
--
-- draft
--   may be edited
--
-- posted
--   immutable
--
-- reversed
--   immutable
--
-- 007 later replaces this trigger with reversal-aware logic
-- that permits only the controlled:
--
--   posted -> reversed
--
-- state transition.
-- ============================================================

create or replace function
public.protect_posted_journal_entry()
returns trigger
language plpgsql
set search_path = public
as $$
begin

  if old.status in (
    'posted',
    'reversed'
  ) then

    raise exception
      'Posted or reversed journal entries are immutable. Use a controlled reversal instead.';

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_protect_posted_journal_entry
on public.journal_entries;


create trigger
  trg_protect_posted_journal_entry

before update
on public.journal_entries

for each row

execute function
  public.protect_posted_journal_entry();


-- ============================================================
-- 3. PREVENT DELETE OF POSTED JOURNAL HEADERS
--
-- Draft journals may be deleted.
--
-- Posted accounting history must never disappear.
-- ============================================================

create or replace function
public.prevent_posted_journal_entry_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin

  if old.status <> 'draft' then

    raise exception
      'Posted or reversed journal entries cannot be deleted.';

  end if;


  return old;

end;
$$;


drop trigger if exists
  trg_prevent_posted_journal_entry_delete
on public.journal_entries;


create trigger
  trg_prevent_posted_journal_entry_delete

before delete
on public.journal_entries

for each row

execute function
  public.prevent_posted_journal_entry_delete();


-- ============================================================
-- 4. CONTROLLED POSTING FUNCTION
--
-- This is the authoritative Helix function for converting a
-- draft journal into posted General Ledger history.
--
-- Example draft:
--
--   Accounts Receivable       Dr 1,130
--   Sales Revenue                        Cr 1,000
--   Sales Tax Payable                    Cr   130
--
-- Base debits:
--   1,130
--
-- Base credits:
--   1,130
--
-- Result:
--   POSTED
-- ============================================================

create or replace function public.post_journal_entry(
  p_journal_entry_id uuid
)
returns table (
  journal_entry_id uuid,
  entry_number bigint,
  status text,
  total_debit numeric,
  total_credit numeric,
  posted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;

  v_entry public.journal_entries%rowtype;

  v_company_currency text;

  v_period_id uuid;
  v_period_status text;
  v_is_adjustment_period boolean;

  v_line_count integer;

  v_total_debit numeric(24,4);
  v_total_credit numeric(24,4);

  v_invalid_account_count integer;
  v_manual_block_count integer;

  v_entry_number bigint;
  v_posted_at timestamptz;
begin

  -- ==========================================================
  -- 4.1 AUTHENTICATION
  -- ==========================================================

  v_user_id := auth.uid();


  if v_user_id is null then

    raise exception
      'Authentication is required to post a journal entry.';

  end if;


  -- ==========================================================
  -- 4.2 LOCK JOURNAL
  --
  -- Prevent two simultaneous requests from posting the same
  -- draft.
  -- ==========================================================

  select je.*

  into v_entry

  from public.journal_entries as je

  where je.id =
    p_journal_entry_id

  for update;


  if not found then

    raise exception
      'Journal entry does not exist.';

  end if;


  -- ==========================================================
  -- 4.3 ADMIN / COMPANY AUTHORIZATION
  -- ==========================================================

  if not exists (

    select 1

    from public.profiles as p

    where p.id =
      v_user_id

      and p.role =
        'admin'::user_role

      and p.company_id =
        v_entry.company_id

  ) then

    raise exception
      'You are not authorised to post this journal entry.';

  end if;


  -- ==========================================================
  -- 4.4 DRAFT STATUS
  -- ==========================================================

  if v_entry.status <> 'draft' then

    raise exception
      'Only draft journal entries can be posted.';

  end if;


  if v_entry.entry_number is not null then

    raise exception
      'Draft journal entry already has a journal number.';

  end if;


  if v_entry.posted_at is not null
     or v_entry.posted_by is not null then

    raise exception
      'Draft journal entry contains invalid posting metadata.';

  end if;


  -- ==========================================================
  -- 4.5 COMPANY BASE CURRENCY
  -- ==========================================================

  select
    upper(
      coalesce(
        c.currency,
        'USD'
      )
    )

  into
    v_company_currency

  from public.companies as c

  where c.id =
    v_entry.company_id;


  if v_company_currency is null then

    raise exception
      'Journal entry company does not exist.';

  end if;


  if upper(v_entry.base_currency_code)
     <> v_company_currency then

    raise exception
      'Journal base currency (%) does not match company base currency (%).',
      v_entry.base_currency_code,
      v_company_currency;

  end if;


  -- ==========================================================
  -- 4.6 ACCOUNTING PERIOD
  --
  -- If the draft has no accounting period selected, Helix
  -- automatically locates the normal period containing the
  -- journal date.
  -- ==========================================================

  v_period_id :=
    v_entry.accounting_period_id;


  if v_period_id is null then

    select ap.id

    into v_period_id

    from public.accounting_periods as ap

    where ap.company_id =
      v_entry.company_id

      and ap.is_adjustment_period =
        false

      and v_entry.entry_date
        between ap.start_date and ap.end_date

    order by
      ap.start_date desc,
      ap.id

    limit 1;


    if v_period_id is null then

      raise exception
        'No accounting period exists for journal date %.',
        v_entry.entry_date;

    end if;

  end if;


  -- Explicit aliases are important here because the function
  -- RETURNS TABLE includes an output field named "status".
  --
  -- Using simply:
  --
  --   select status
  --
  -- would be ambiguous inside PL/pgSQL.

  select
    ap.status,
    ap.is_adjustment_period

  into
    v_period_status,
    v_is_adjustment_period

  from public.accounting_periods as ap

  where ap.id =
    v_period_id

    and ap.company_id =
      v_entry.company_id

    and v_entry.entry_date
      between ap.start_date and ap.end_date;


  if not found then

    raise exception
      'The selected accounting period is invalid for this journal entry.';

  end if;


  -- ==========================================================
  -- 4.7 PERIOD STATE
  -- ==========================================================

  if v_period_status = 'locked' then

    raise exception
      'The accounting period is locked and cannot accept postings.';

  end if;


  -- Ordinary soft-closed periods reject new postings.
  --
  -- A soft-closed adjustment period remains available for
  -- controlled year-end/accountant adjustments.

  if v_period_status = 'soft_closed'
     and v_is_adjustment_period = false then

    raise exception
      'The accounting period is soft closed. Use an open adjustment period for accounting adjustments.';

  end if;


  -- ==========================================================
  -- 4.8 LINE COUNT + DOUBLE-ENTRY BALANCING
  --
  -- Balance is checked in COMPANY BASE CURRENCY.
  --
  -- This means foreign-currency lines can use different
  -- transaction currencies/exchange rates as long as the
  -- resulting base-currency journal is balanced.
  -- ==========================================================

  select
    count(*),

    coalesce(
      sum(jl.base_debit),
      0
    ),

    coalesce(
      sum(jl.base_credit),
      0
    )

  into
    v_line_count,
    v_total_debit,
    v_total_credit

  from public.journal_lines as jl

  where jl.journal_entry_id =
    v_entry.id

    and jl.company_id =
      v_entry.company_id;


  if v_line_count < 2 then

    raise exception
      'A journal entry requires at least two journal lines.';

  end if;


  if v_total_debit <= 0
     or v_total_credit <= 0 then

    raise exception
      'Journal entry must contain both debit and credit values.';

  end if;


  if v_total_debit <>
     v_total_credit then

    raise exception
      'Journal entry is not balanced. Debits: %, Credits: %.',
      v_total_debit,
      v_total_credit;

  end if;


  -- ==========================================================
  -- 4.9 ACTIVE ACCOUNT VALIDATION
  -- ==========================================================

  select count(*)

  into
    v_invalid_account_count

  from public.journal_lines as jl

  join public.accounting_accounts as aa
    on aa.id =
      jl.account_id

  where jl.journal_entry_id =
    v_entry.id

    and (

      aa.company_id <>
        v_entry.company_id

      or aa.status <>
        'active'

    );


  if v_invalid_account_count > 0 then

    raise exception
      'Journal entry contains an inactive or invalid accounting account.';

  end if;


  -- ==========================================================
  -- 4.10 MANUAL CONTROL-ACCOUNT PROTECTION
  --
  -- Example system-controlled accounts:
  --
  --   Accounts Receivable
  --   Accounts Payable
  --   Inventory
  --   Sales Tax Payable
  --   Share Capital
  --
  -- Manual journal entries cannot post directly to accounts
  -- where:
  --
  --   allow_manual_posting = false
  --
  -- Automated Helix source modules may post to these accounts.
  -- ==========================================================

  if v_entry.source_type = 'manual' then

    select count(*)

    into
      v_manual_block_count

    from public.journal_lines as jl

    join public.accounting_accounts as aa
      on aa.id =
        jl.account_id

    where jl.journal_entry_id =
      v_entry.id

      and aa.allow_manual_posting =
        false;


    if v_manual_block_count > 0 then

      raise exception
        'One or more accounts do not allow manual journal posting.';

    end if;

  end if;


  -- ==========================================================
  -- 4.11 SAFE SEQUENTIAL JOURNAL NUMBER
  --
  -- First installation:
  --
  --   existing max = 0
  --   assigned     = 1
  --   next_number  = 2
  --
  -- Normal subsequent posting:
  --
  --   counter next_number = 5
  --   assigned            = 5
  --   stored next_number  = 6
  --
  -- The GREATEST() logic also protects a database where a
  -- counter is unexpectedly behind already-posted journals.
  -- ==========================================================

  insert into public.accounting_journal_counters (
    company_id,
    next_number
  )

  select
    v_entry.company_id,

    coalesce(
      max(je.entry_number),
      0
    ) + 2

  from public.journal_entries as je

  where je.company_id =
    v_entry.company_id


  on conflict (company_id)
  do update

  set
    next_number =
      greatest(

        public.accounting_journal_counters.next_number + 1,

        excluded.next_number

      ),

    updated_at =
      now()


  returning
    public.accounting_journal_counters.next_number - 1

  into
    v_entry_number;


  -- ==========================================================
  -- 4.12 POST JOURNAL
  --
  -- The immutability trigger examines OLD.status.
  --
  -- OLD:
  --   draft
  --
  -- NEW:
  --   posted
  --
  -- Therefore this controlled transition is permitted.
  --
  -- Once the row is posted, future ordinary updates are
  -- blocked.
  -- ==========================================================

  v_posted_at :=
    now();


  update public.journal_entries as je

  set
    accounting_period_id =
      v_period_id,

    entry_number =
      v_entry_number,

    status =
      'posted',

    posted_at =
      v_posted_at,

    posted_by =
      v_user_id

  where je.id =
    v_entry.id;


  -- ==========================================================
  -- 4.13 VERIFY UPDATE
  -- ==========================================================

  if not found then

    raise exception
      'Journal entry could not be posted.';

  end if;


  -- ==========================================================
  -- 4.14 RETURN RESULT
  -- ==========================================================

  return query

  select
    v_entry.id,
    v_entry_number,
    'posted'::text,
    v_total_debit,
    v_total_credit,
    v_posted_at;

end;
$$;


-- ============================================================
-- 5. POSTING FUNCTION SECURITY
--
-- SECURITY DEFINER allows the function to assign protected
-- posting metadata, but the function itself performs explicit:
--
--   auth.uid()
--   Admin role
--   company ownership
--
-- checks before doing so.
-- ============================================================

revoke all
on function public.post_journal_entry(uuid)
from public;


revoke all
on function public.post_journal_entry(uuid)
from anon;


grant execute
on function public.post_journal_entry(uuid)
to authenticated;


comment on function public.post_journal_entry(uuid) is
  'Controlled Helix double-entry posting engine. Validates company authorization, accounting periods, active accounts, manual-posting restrictions and balanced base-currency debits/credits before converting a draft journal into immutable posted accounting history.';


-- ============================================================
-- 6. GENERAL LEDGER VIEW
--
-- At this stage the General Ledger contains POSTED journals.
--
-- Draft journals never affect financial statements.
--
-- 007 later extends this view so original entries marked
-- REVERSED also remain visible alongside their separate
-- offsetting reversal journals.
-- ============================================================

create or replace view public.general_ledger_view
with (
  security_invoker = true
)
as

select
  je.company_id,

  je.id as journal_entry_id,

  je.entry_number,

  je.entry_date,

  je.description as journal_description,

  je.reference,

  je.source_type,

  je.source_id,

  je.source_action,

  je.accounting_period_id,

  jl.id as journal_line_id,

  jl.line_number,

  aa.id as account_id,

  aa.code as account_code,

  aa.name as account_name,

  aa.account_type,

  aa.account_subtype,

  aa.normal_balance,

  aa.system_key,

  aa.is_contra,

  jl.description as line_description,

  jl.currency_code,

  jl.exchange_rate,

  jl.debit,

  jl.credit,

  jl.base_debit,

  jl.base_credit,

  je.base_currency_code,

  je.status as journal_status,

  je.posted_at,

  je.posted_by,

  je.reverses_entry_id,

  je.reversed_at,

  je.reversed_by

from public.journal_entries as je

join public.journal_lines as jl

  on jl.journal_entry_id =
    je.id

  and jl.company_id =
    je.company_id


join public.accounting_accounts as aa

  on aa.id =
    jl.account_id

  and aa.company_id =
    je.company_id


where je.status =
  'posted';


-- ============================================================
-- 7. GENERAL LEDGER VIEW SECURITY
--
-- security_invoker = true means the underlying journal/account
-- RLS policies continue to apply to the caller.
-- ============================================================

revoke all
on public.general_ledger_view
from anon, authenticated;


grant select
on public.general_ledger_view
to authenticated;


comment on view public.general_ledger_view is
  'Authoritative posted Helix General Ledger. Draft journals are excluded from financial reporting. Reversal-aware historical semantics are finalized in Stage 2A migration 007.';


-- ============================================================
-- 8. DOCUMENTATION
-- ============================================================

comment on column public.journal_entries.status is
  'Journal lifecycle state: draft, posted or reversed. Only posted/reversed accounting history belongs to the authoritative General Ledger after final Stage 2A hardening.';


comment on column public.journal_entries.posted_at is
  'Timestamp when the journal successfully passed the Helix posting engine.';


comment on column public.journal_entries.posted_by is
  'Admin who successfully posted the journal entry.';


comment on column public.journal_entries.entry_number is
  'Sequential company-specific journal number allocated atomically by the Helix posting engine.';


-- ============================================================
-- 9. REASSERT ROW LEVEL SECURITY
-- ============================================================

alter table public.accounting_journal_counters
enable row level security;


alter table public.journal_entries
enable row level security;


alter table public.journal_lines
enable row level security;


commit;


-- ============================================================
-- END
-- ============================================================
