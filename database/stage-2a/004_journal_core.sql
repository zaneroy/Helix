-- ============================================================
-- HELIX STAGE 2A
-- 004 - JOURNAL CORE
--
-- Creates:
--
--   journal_entries
--   journal_lines
--
-- This is the structural foundation of the Helix
-- double-entry General Ledger.
--
-- Posting itself is installed later in:
--
--   005_posting_engine.sql
--
-- Final security/integrity hardening is installed in:
--
--   007_accounting_core_hardening.sql
-- ============================================================

begin;


-- ============================================================
-- 1. JOURNAL ENTRIES
-- ============================================================

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null
    references public.companies(id)
    on delete cascade,

  accounting_period_id uuid
    references public.accounting_periods(id)
    on delete restrict,

  entry_number bigint,

  entry_date date not null,

  description text not null,

  reference text,

  source_type text not null default 'manual',

  source_id uuid,

  source_action text,

  base_currency_code text not null,

  status text not null default 'draft',

  reverses_entry_id uuid
    references public.journal_entries(id)
    on delete restrict,

  posted_at timestamptz,

  posted_by uuid
    references public.profiles(id)
    on delete set null,

  reversed_at timestamptz,

  reversed_by uuid
    references public.profiles(id)
    on delete set null,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint journal_entries_description_not_blank
    check (
      length(trim(description)) > 0
    ),

  constraint journal_entries_number_check
    check (
      entry_number is null
      or entry_number > 0
    ),

  constraint journal_entries_status_check
    check (
      status in (
        'draft',
        'posted',
        'reversed'
      )
    ),

  constraint journal_entries_currency_check
    check (
      base_currency_code ~ '^[A-Z]{3}$'
    ),

  constraint journal_entries_source_type_not_blank
    check (
      length(trim(source_type)) > 0
    ),

  constraint journal_entries_not_self_reversal
    check (
      reverses_entry_id is null
      or reverses_entry_id <> id
    )
);


-- ============================================================
-- 2. JOURNAL ENTRY INDEXES
-- ============================================================

-- Journal numbers are unique within each company.
-- Numbers are assigned only when an entry is posted.

create unique index if not exists
  journal_entries_company_number_uidx

on public.journal_entries(
  company_id,
  entry_number
)

where entry_number is not null;


-- One original journal may only have one reversal journal.

create unique index if not exists
  journal_entries_reverses_entry_uidx

on public.journal_entries(
  reverses_entry_id
)

where reverses_entry_id is not null;


create index if not exists
  journal_entries_company_idx

on public.journal_entries(
  company_id
);


create index if not exists
  journal_entries_company_date_idx

on public.journal_entries(
  company_id,
  entry_date
);


create index if not exists
  journal_entries_company_status_idx

on public.journal_entries(
  company_id,
  status
);


create index if not exists
  journal_entries_period_idx

on public.journal_entries(
  accounting_period_id
);


create index if not exists
  journal_entries_source_idx

on public.journal_entries(
  company_id,
  source_type,
  source_id
);


-- ============================================================
-- 3. JOURNAL LINES
--
-- Each journal entry contains two or more lines.
--
-- A line must contain:
--
--   debit > 0 and credit = 0
--
-- OR
--
--   credit > 0 and debit = 0
--
-- Never both.
-- Never neither.
-- ============================================================

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null
    references public.companies(id)
    on delete cascade,

  journal_entry_id uuid not null
    references public.journal_entries(id)
    on delete cascade,

  line_number integer not null,

  account_id uuid not null
    references public.accounting_accounts(id)
    on delete restrict,

  description text,

  debit numeric(20,4) not null default 0,

  credit numeric(20,4) not null default 0,

  currency_code text not null,

  exchange_rate numeric(20,10) not null default 1,

  base_debit numeric(24,4)
    generated always as (
      round(
        debit * exchange_rate,
        4
      )
    ) stored,

  base_credit numeric(24,4)
    generated always as (
      round(
        credit * exchange_rate,
        4
      )
    ) stored,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint journal_lines_number_check
    check (
      line_number > 0
    ),

  constraint journal_lines_amounts_nonnegative
    check (
      debit >= 0
      and credit >= 0
    ),

  constraint journal_lines_one_side_only
    check (

      (
        debit > 0
        and credit = 0
      )

      or

      (
        credit > 0
        and debit = 0
      )

    ),

  constraint journal_lines_currency_check
    check (
      currency_code ~ '^[A-Z]{3}$'
    ),

  constraint journal_lines_exchange_rate_check
    check (
      exchange_rate > 0
    ),

  constraint journal_lines_entry_line_unique
    unique (
      journal_entry_id,
      line_number
    )
);


-- ============================================================
-- 4. JOURNAL LINE INDEXES
-- ============================================================

create index if not exists
  journal_lines_company_idx

on public.journal_lines(
  company_id
);


create index if not exists
  journal_lines_entry_idx

on public.journal_lines(
  journal_entry_id
);


create index if not exists
  journal_lines_account_idx

on public.journal_lines(
  account_id
);


create index if not exists
  journal_lines_company_account_idx

on public.journal_lines(
  company_id,
  account_id
);


-- ============================================================
-- 5. JOURNAL ENTRY UPDATED_AT
-- ============================================================

create or replace function
public.set_journal_entry_updated_at()
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
  trg_journal_entries_updated_at
on public.journal_entries;


create trigger
  trg_journal_entries_updated_at

before update
on public.journal_entries

for each row

execute function
  public.set_journal_entry_updated_at();


-- ============================================================
-- 6. JOURNAL LINE UPDATED_AT
-- ============================================================

create or replace function
public.set_journal_line_updated_at()
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
  trg_journal_lines_updated_at
on public.journal_lines;


create trigger
  trg_journal_lines_updated_at

before update
on public.journal_lines

for each row

execute function
  public.set_journal_line_updated_at();


-- ============================================================
-- 7. PREPARE JOURNAL ENTRY BASE CURRENCY
--
-- If base_currency_code is omitted from a draft, use the
-- company's configured currency.
--
-- Example:
--
-- Company currency:
--   CAD
--
-- Journal base currency:
--   CAD
--
-- The posting engine later verifies that these match.
-- ============================================================

create or replace function
public.prepare_journal_entry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_currency text;
begin

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
    new.company_id;


  if v_company_currency is null then

    raise exception
      'Journal entry company does not exist.';

  end if;


  if new.base_currency_code is null
     or trim(new.base_currency_code) = '' then

    new.base_currency_code :=
      v_company_currency;

  else

    new.base_currency_code :=
      upper(
        trim(
          new.base_currency_code
        )
      );

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_prepare_journal_entry
on public.journal_entries;


create trigger
  trg_prepare_journal_entry

before insert or update of
  company_id,
  base_currency_code

on public.journal_entries

for each row

execute function
  public.prepare_journal_entry();


-- ============================================================
-- 8. VALIDATE JOURNAL ENTRY PERIOD
--
-- Draft entries may temporarily have no accounting period.
--
-- When a period is explicitly selected:
--
--   - period must exist
--   - period must belong to same company
--   - entry date must fall inside the period
--
-- 005 requires a valid period before posting.
-- ============================================================

create or replace function
public.validate_journal_entry_period()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_period_company_id uuid;
  v_period_start date;
  v_period_end date;
begin

  if new.accounting_period_id is null then
    return new;
  end if;


  select
    ap.company_id,
    ap.start_date,
    ap.end_date

  into
    v_period_company_id,
    v_period_start,
    v_period_end

  from public.accounting_periods as ap

  where ap.id =
    new.accounting_period_id;


  if v_period_company_id is null then

    raise exception
      'Accounting period does not exist.';

  end if;


  if v_period_company_id <>
     new.company_id then

    raise exception
      'Accounting period must belong to the same company.';

  end if;


  if new.entry_date < v_period_start
     or new.entry_date > v_period_end then

    raise exception
      'Journal entry date must fall inside the selected accounting period.';

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_validate_journal_entry_period
on public.journal_entries;


create trigger
  trg_validate_journal_entry_period

before insert or update of
  company_id,
  accounting_period_id,
  entry_date

on public.journal_entries

for each row

execute function
  public.validate_journal_entry_period();


-- ============================================================
-- 9. VALIDATE JOURNAL LINE RELATIONSHIPS
--
-- Enforces:
--
--   line.company_id
--       =
--   journal.company_id
--
-- and:
--
--   account.company_id
--       =
--   journal.company_id
--
-- Journal lines may only be inserted/updated while the parent
-- journal remains a draft.
--
-- Transaction currency is normalized to uppercase.
--
-- If transaction currency equals company base currency:
--
--   exchange_rate = 1
-- ============================================================

create or replace function
public.validate_journal_line()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_entry_company_id uuid;
  v_entry_status text;
  v_entry_base_currency text;

  v_account_company_id uuid;
begin

  select
    je.company_id,
    je.status,
    je.base_currency_code

  into
    v_entry_company_id,
    v_entry_status,
    v_entry_base_currency

  from public.journal_entries as je

  where je.id =
    new.journal_entry_id;


  if v_entry_company_id is null then

    raise exception
      'Journal entry does not exist.';

  end if;


  if v_entry_company_id <>
     new.company_id then

    raise exception
      'Journal line company must match journal entry company.';

  end if;


  if v_entry_status <> 'draft' then

    raise exception
      'Journal lines can only be changed while the journal entry is draft.';

  end if;


  select
    aa.company_id

  into
    v_account_company_id

  from public.accounting_accounts as aa

  where aa.id =
    new.account_id;


  if v_account_company_id is null then

    raise exception
      'Accounting account does not exist.';

  end if;


  if v_account_company_id <>
     new.company_id then

    raise exception
      'Accounting account must belong to the same company as the journal entry.';

  end if;


  if new.currency_code is null
     or trim(new.currency_code) = '' then

    new.currency_code :=
      v_entry_base_currency;

  else

    new.currency_code :=
      upper(
        trim(
          new.currency_code
        )
      );

  end if;


  if new.currency_code =
     v_entry_base_currency then

    new.exchange_rate := 1;

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_validate_journal_line
on public.journal_lines;


create trigger
  trg_validate_journal_line

before insert or update
on public.journal_lines

for each row

execute function
  public.validate_journal_line();


-- ============================================================
-- 10. PREVENT DELETE OF POSTED JOURNAL LINES
--
-- Draft journal lines may be deleted.
--
-- Once a journal is posted or reversed, its lines become
-- historical accounting records.
-- ============================================================

create or replace function
public.prevent_posted_journal_line_delete()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent_status text;
begin

  select
    je.status

  into
    v_parent_status

  from public.journal_entries as je

  where je.id =
    old.journal_entry_id;


  -- Parent may already be disappearing through a cascading
  -- database delete. In that situation, allow the cascade.
  if v_parent_status is null then
    return old;
  end if;


  if v_parent_status <> 'draft' then

    raise exception
      'Lines belonging to posted or reversed journal entries cannot be deleted.';

  end if;


  return old;

end;
$$;


drop trigger if exists
  trg_prevent_posted_journal_line_delete
on public.journal_lines;


create trigger
  trg_prevent_posted_journal_line_delete

before delete
on public.journal_lines

for each row

execute function
  public.prevent_posted_journal_line_delete();


-- ============================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================

alter table public.journal_entries
enable row level security;


alter table public.journal_lines
enable row level security;


-- ============================================================
-- 12. JOURNAL ENTRIES - READ
-- ============================================================

drop policy if exists
  "Admins can read journal entries"
on public.journal_entries;


create policy
  "Admins can read journal entries"

on public.journal_entries

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
        journal_entries.company_id

  )

);


-- ============================================================
-- 13. JOURNAL ENTRIES - INSERT DRAFTS
--
-- Direct inserts may only create drafts.
--
-- Posting later occurs through:
--
--   post_journal_entry(...)
-- ============================================================

drop policy if exists
  "Admins can create draft journal entries"
on public.journal_entries;


create policy
  "Admins can create draft journal entries"

on public.journal_entries

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
        journal_entries.company_id

  )

  and journal_entries.status =
    'draft'

  and journal_entries.entry_number
    is null

  and journal_entries.posted_at
    is null

  and journal_entries.posted_by
    is null

  and journal_entries.reversed_at
    is null

  and journal_entries.reversed_by
    is null

  and journal_entries.reverses_entry_id
    is null

  and (

    journal_entries.created_by is null

    or journal_entries.created_by =
      auth.uid()

  )

);


-- ============================================================
-- 14. JOURNAL ENTRIES - UPDATE DRAFTS
-- ============================================================

drop policy if exists
  "Admins can update draft journal entries"
on public.journal_entries;


create policy
  "Admins can update draft journal entries"

on public.journal_entries

for update

to authenticated

using (

  journal_entries.status =
    'draft'

  and exists (

    select 1

    from public.profiles as p

    where p.id =
      auth.uid()

      and p.role =
        'admin'::user_role

      and p.company_id =
        journal_entries.company_id

  )

)

with check (

  journal_entries.status =
    'draft'

  and journal_entries.entry_number
    is null

  and journal_entries.posted_at
    is null

  and journal_entries.posted_by
    is null

  and journal_entries.reversed_at
    is null

  and journal_entries.reversed_by
    is null

  and journal_entries.reverses_entry_id
    is null

  and exists (

    select 1

    from public.profiles as p

    where p.id =
      auth.uid()

      and p.role =
        'admin'::user_role

      and p.company_id =
        journal_entries.company_id

  )

);


-- ============================================================
-- 15. JOURNAL ENTRIES - DELETE DRAFTS
-- ============================================================

drop policy if exists
  "Admins can delete draft journal entries"
on public.journal_entries;


create policy
  "Admins can delete draft journal entries"

on public.journal_entries

for delete

to authenticated

using (

  journal_entries.status =
    'draft'

  and exists (

    select 1

    from public.profiles as p

    where p.id =
      auth.uid()

      and p.role =
        'admin'::user_role

      and p.company_id =
        journal_entries.company_id

  )

);


-- ============================================================
-- 16. JOURNAL LINES - READ
-- ============================================================

drop policy if exists
  "Admins can read journal lines"
on public.journal_lines;


create policy
  "Admins can read journal lines"

on public.journal_lines

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
        journal_lines.company_id

  )

);


-- ============================================================
-- 17. JOURNAL LINES - INSERT
-- ============================================================

drop policy if exists
  "Admins can create journal lines"
on public.journal_lines;


create policy
  "Admins can create journal lines"

on public.journal_lines

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
        journal_lines.company_id

  )

  and (

    journal_lines.created_by is null

    or journal_lines.created_by =
      auth.uid()

  )

  and exists (

    select 1

    from public.journal_entries as je

    where je.id =
      journal_lines.journal_entry_id

      and je.company_id =
        journal_lines.company_id

      and je.status =
        'draft'

  )

);


-- ============================================================
-- 18. JOURNAL LINES - UPDATE DRAFTS
-- ============================================================

drop policy if exists
  "Admins can update draft journal lines"
on public.journal_lines;


create policy
  "Admins can update draft journal lines"

on public.journal_lines

for update

to authenticated

using (

  exists (

    select 1

    from public.journal_entries as je

    where je.id =
      journal_lines.journal_entry_id

      and je.status =
        'draft'

  )

  and exists (

    select 1

    from public.profiles as p

    where p.id =
      auth.uid()

      and p.role =
        'admin'::user_role

      and p.company_id =
        journal_lines.company_id

  )

)

with check (

  exists (

    select 1

    from public.journal_entries as je

    where je.id =
      journal_lines.journal_entry_id

      and je.company_id =
        journal_lines.company_id

      and je.status =
        'draft'

  )

  and exists (

    select 1

    from public.profiles as p

    where p.id =
      auth.uid()

      and p.role =
        'admin'::user_role

      and p.company_id =
        journal_lines.company_id

  )

);


-- ============================================================
-- 19. JOURNAL LINES - DELETE DRAFTS
-- ============================================================

drop policy if exists
  "Admins can delete draft journal lines"
on public.journal_lines;


create policy
  "Admins can delete draft journal lines"

on public.journal_lines

for delete

to authenticated

using (

  exists (

    select 1

    from public.journal_entries as je

    where je.id =
      journal_lines.journal_entry_id

      and je.status =
        'draft'

  )

  and exists (

    select 1

    from public.profiles as p

    where p.id =
      auth.uid()

      and p.role =
        'admin'::user_role

      and p.company_id =
        journal_lines.company_id

  )

);


-- ============================================================
-- 20. BASE DATABASE PRIVILEGES
--
-- Remove broad anonymous/authenticated defaults first.
--
-- Final privilege hardening across the entire accounting
-- subsystem is performed again in 007.
-- ============================================================

revoke all
on public.journal_entries
from anon, authenticated;


revoke all
on public.journal_lines
from anon, authenticated;


-- ------------------------------------------------------------
-- JOURNAL ENTRY PRIVILEGES
-- ------------------------------------------------------------

grant select, insert, delete
on public.journal_entries
to authenticated;


grant update (
  accounting_period_id,
  entry_date,
  description,
  reference,
  source_type,
  source_id,
  source_action
)
on public.journal_entries
to authenticated;


-- ------------------------------------------------------------
-- JOURNAL LINE PRIVILEGES
-- ------------------------------------------------------------

grant select, insert, delete
on public.journal_lines
to authenticated;


grant update (
  line_number,
  account_id,
  description,
  debit,
  credit,
  currency_code,
  exchange_rate
)
on public.journal_lines
to authenticated;


-- ============================================================
-- 21. DOCUMENTATION
-- ============================================================

comment on table public.journal_entries is
  'Helix General Ledger journal entry headers. Draft entries become posted accounting history through the controlled posting engine.';


comment on table public.journal_lines is
  'Double-entry debit and credit lines belonging to Helix General Ledger journal entries.';


comment on column public.journal_entries.entry_number is
  'Sequential company-specific journal number assigned only when a draft journal is successfully posted.';


comment on column public.journal_entries.entry_date is
  'Accounting date used to determine the fiscal accounting period.';


comment on column public.journal_entries.source_type is
  'Originating Helix module such as manual, sale, invoice, expense, bill, inventory, banking, investor, corporate_action or reversal.';


comment on column public.journal_entries.source_id is
  'UUID of the originating operational record when the journal was created automatically by another Helix module.';


comment on column public.journal_entries.source_action is
  'Specific financial event within the source module such as issued, paid, refunded, adjusted or reversed.';


comment on column public.journal_entries.base_currency_code is
  'Company reporting currency used for General Ledger balancing and financial statements.';


comment on column public.journal_entries.reverses_entry_id is
  'Original posted journal entry that this journal reverses. Only one reversal journal may reference a given original journal.';


comment on column public.journal_lines.debit is
  'Debit amount in the journal line transaction currency.';


comment on column public.journal_lines.credit is
  'Credit amount in the journal line transaction currency.';


comment on column public.journal_lines.currency_code is
  'Transaction currency for this journal line.';


comment on column public.journal_lines.exchange_rate is
  'Base-currency units per one unit of transaction currency. Example: if base currency is CAD and 1 USD equals 1.36 CAD, exchange_rate is 1.36.';


comment on column public.journal_lines.base_debit is
  'Generated debit amount expressed in the company base currency.';


comment on column public.journal_lines.base_credit is
  'Generated credit amount expressed in the company base currency.';


commit;


-- ============================================================
-- END
-- ============================================================
