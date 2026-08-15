-- ============================================================
-- HELIX STAGE 2A
-- 003 - ACCOUNTING PERIODS
--
-- Creates fiscal accounting periods used by the General Ledger.
--
-- Period states:
--
-- open
--   Normal accounting activity is permitted.
--
-- soft_closed
--   Normal posting is restricted.
--   Controlled adjustment activity may still be permitted.
--
-- locked
--   Period is final and cannot accept normal accounting activity.
--
-- Full controlled close / reopen / lock functions are installed
-- later in 007_accounting_core_hardening.sql.
-- ============================================================

begin;


-- ============================================================
-- 1. ACCOUNTING PERIODS
-- ============================================================

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null
    references public.companies(id)
    on delete cascade,

  fiscal_year_label text not null,

  period_number smallint not null,

  name text not null,

  start_date date not null,

  end_date date not null,

  status text not null default 'open',

  is_adjustment_period boolean not null default false,

  closed_at timestamptz,

  closed_by uuid
    references public.profiles(id)
    on delete set null,

  locked_at timestamptz,

  locked_by uuid
    references public.profiles(id)
    on delete set null,

  notes text,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint accounting_periods_fiscal_year_label_not_blank
    check (
      length(trim(fiscal_year_label)) > 0
    ),

  constraint accounting_periods_name_not_blank
    check (
      length(trim(name)) > 0
    ),

  constraint accounting_periods_number_check
    check (
      period_number between 1 and 53
    ),

  constraint accounting_periods_date_check
    check (
      start_date <= end_date
    ),

  constraint accounting_periods_status_check
    check (
      status in (
        'open',
        'soft_closed',
        'locked'
      )
    ),

  constraint accounting_periods_company_period_unique
    unique (
      company_id,
      fiscal_year_label,
      period_number
    )
);


-- ============================================================
-- 2. INDEXES
-- ============================================================

create index if not exists
  accounting_periods_company_idx

on public.accounting_periods(
  company_id
);


create index if not exists
  accounting_periods_company_dates_idx

on public.accounting_periods(
  company_id,
  start_date,
  end_date
);


create index if not exists
  accounting_periods_company_status_idx

on public.accounting_periods(
  company_id,
  status
);


create index if not exists
  accounting_periods_fiscal_year_idx

on public.accounting_periods(
  company_id,
  fiscal_year_label
);


create index if not exists
  accounting_periods_adjustment_idx

on public.accounting_periods(
  company_id,
  is_adjustment_period,
  status
);


-- ============================================================
-- 3. UPDATED_AT TRIGGER
-- ============================================================

create or replace function
public.set_accounting_period_updated_at()
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
  trg_accounting_periods_updated_at
on public.accounting_periods;


create trigger
  trg_accounting_periods_updated_at

before update
on public.accounting_periods

for each row

execute function
  public.set_accounting_period_updated_at();


-- ============================================================
-- 4. PREVENT OVERLAPPING NORMAL PERIODS
--
-- Example that is NOT allowed:
--
-- Period 1:
--   Jan 1 - Jan 31
--
-- Period 2:
--   Jan 15 - Feb 15
--
-- Adjustment periods are intentionally permitted to overlap
-- ordinary periods because year-end adjustments may need their
-- own controlled posting window.
-- ============================================================

create or replace function
public.validate_accounting_period_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
begin

  -- Adjustment periods may overlap ordinary periods.
  if new.is_adjustment_period = true then
    return new;
  end if;


  if exists (

    select 1

    from public.accounting_periods as existing

    where existing.company_id =
      new.company_id

      and existing.id <>
        new.id

      and existing.is_adjustment_period =
        false

      and daterange(
        existing.start_date,
        existing.end_date,
        '[]'
      )

      && daterange(
        new.start_date,
        new.end_date,
        '[]'
      )

  ) then

    raise exception
      'Accounting period overlaps an existing period for this company.';

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_validate_accounting_period_overlap
on public.accounting_periods;


create trigger
  trg_validate_accounting_period_overlap

before insert or update of
  company_id,
  start_date,
  end_date,
  is_adjustment_period

on public.accounting_periods

for each row

execute function
  public.validate_accounting_period_overlap();


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

alter table public.accounting_periods
enable row level security;


-- ------------------------------------------------------------
-- READ
-- ------------------------------------------------------------

drop policy if exists
  "Admins can read accounting periods"
on public.accounting_periods;


create policy
  "Admins can read accounting periods"

on public.accounting_periods

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
        accounting_periods.company_id

  )

);


-- ------------------------------------------------------------
-- INSERT
--
-- Base Stage 2A rule.
--
-- 007 later hardens this so application-created periods must
-- begin OPEN with no close/lock metadata.
-- ------------------------------------------------------------

drop policy if exists
  "Admins can create accounting periods"
on public.accounting_periods;


create policy
  "Admins can create accounting periods"

on public.accounting_periods

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
        accounting_periods.company_id

  )

  and (

    accounting_periods.created_by is null

    or accounting_periods.created_by =
      auth.uid()

  )

);


-- ------------------------------------------------------------
-- UPDATE
--
-- Base Stage 2A rule.
--
-- 007 replaces this with controlled state-transition rules.
-- ------------------------------------------------------------

drop policy if exists
  "Admins can update accounting periods"
on public.accounting_periods;


create policy
  "Admins can update accounting periods"

on public.accounting_periods

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
        accounting_periods.company_id

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
        accounting_periods.company_id

  )

);


-- ------------------------------------------------------------
-- DELETE
-- ------------------------------------------------------------
--
-- Deliberately no DELETE policy.
--
-- Historical accounting periods should not be physically
-- removed from the accounting system.
-- ============================================================


-- ============================================================
-- 6. DOCUMENTATION
-- ============================================================

comment on table public.accounting_periods is
  'Helix fiscal accounting periods used by the General Ledger for posting control, financial reporting and period locking.';


comment on column public.accounting_periods.fiscal_year_label is
  'Human-readable fiscal year identifier such as FY2026.';


comment on column public.accounting_periods.period_number is
  'Period sequence within the fiscal year. Values 1-53 support monthly, weekly and adjustment-period accounting structures.';


comment on column public.accounting_periods.start_date is
  'Inclusive first accounting date belonging to the period.';


comment on column public.accounting_periods.end_date is
  'Inclusive final accounting date belonging to the period.';


comment on column public.accounting_periods.status is
  'Accounting period state: open, soft_closed or locked.';


comment on column public.accounting_periods.is_adjustment_period is
  'True for special accounting adjustment periods that may overlap ordinary fiscal periods.';


comment on column public.accounting_periods.closed_at is
  'Timestamp when the period was soft closed or closed as part of locking.';


comment on column public.accounting_periods.closed_by is
  'Admin who performed the period close operation.';


comment on column public.accounting_periods.locked_at is
  'Timestamp when the accounting period was permanently locked through the normal Helix application workflow.';


comment on column public.accounting_periods.locked_by is
  'Admin who performed the accounting period lock operation.';


commit;


-- ============================================================
-- END
-- ============================================================
