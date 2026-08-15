-- ============================================================
-- HELIX STAGE 2A
-- 007 - ACCOUNTING CORE HARDENING
--
-- Canonical final Stage 2A security and integrity layer.
--
-- This migration is reconstructed from the exact live
-- functions, General Ledger view, RLS policies and privilege
-- state already installed and validated in Supabase.
--
-- Finalizes:
--
--   account hierarchy cycle protection
--   Helix system-account identity protection
--   accounting-period state integrity
--   soft close / reopen / lock controls
--   posted-journal immutability
--   controlled journal reversal
--   final posting engine
--   reversal-aware General Ledger semantics
--   exact authenticated/anonymous privileges
--   final RLS policy state
-- ============================================================

begin;


-- ============================================================
-- 1. FINAL FUNCTION DEFINITIONS
-- ============================================================

-- ------------------------------------------------------------
-- validate_accounting_account_parent
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_accounting_account_parent()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  where aa.id = new.parent_account_id;


  if v_parent_company_id is null then
    raise exception
      'Parent accounting account does not exist.';
  end if;


  if v_parent_company_id <> new.company_id then
    raise exception
      'Parent accounting account must belong to the same company.';
  end if;


  -- ----------------------------------------------------------
  -- Prevent hierarchy cycles
  -- ----------------------------------------------------------

  if exists (

    with recursive ancestors as (

      select
        aa.id,
        aa.parent_account_id

      from public.accounting_accounts as aa
      where aa.id = new.parent_account_id


      union


      select
        parent.id,
        parent.parent_account_id

      from public.accounting_accounts as parent

      join ancestors as a
        on parent.id = a.parent_account_id

    )

    select 1
    from ancestors
    where ancestors.id = new.id

  ) then

    raise exception
      'Accounting account hierarchy cannot contain a cycle.';

  end if;


  return new;

end;
$function$;
-- ------------------------------------------------------------
-- protect_accounting_account_identity
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_accounting_account_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin

  if new.company_id is distinct from old.company_id then
    raise exception
      'An accounting account cannot be moved to another company.';
  end if;


  -- Once assigned, a system_key is permanent.
  if old.system_key is not null
     and new.system_key is distinct from old.system_key then

    raise exception
      'Accounting account system_key is immutable once assigned.';

  end if;


  -- Helix system accounts keep their structural identity.
  if old.is_system = true then

    if new.is_system is distinct from true then
      raise exception
        'A Helix system account cannot be converted into a custom account.';
    end if;


    if new.account_type is distinct from old.account_type then
      raise exception
        'The account type of a Helix system account cannot be changed.';
    end if;


    if new.normal_balance is distinct from old.normal_balance then
      raise exception
        'The normal balance of a Helix system account cannot be changed.';
    end if;


    if new.is_contra is distinct from old.is_contra then
      raise exception
        'The contra status of a Helix system account cannot be changed.';
    end if;

  end if;


  return new;

end;
$function$;
-- ------------------------------------------------------------
-- validate_accounting_period_state
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_accounting_period_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin

  if new.status = 'open' then

    if new.closed_at is not null
       or new.closed_by is not null
       or new.locked_at is not null
       or new.locked_by is not null then

      raise exception
        'Open accounting periods cannot contain close or lock metadata.';

    end if;


  elsif new.status = 'soft_closed' then

    if new.closed_at is null
       or new.closed_by is null then

      raise exception
        'Soft-closed accounting periods require closed_at and closed_by.';

    end if;


    if new.locked_at is not null
       or new.locked_by is not null then

      raise exception
        'Soft-closed accounting periods cannot contain lock metadata.';

    end if;


  elsif new.status = 'locked' then

    if new.closed_at is null
       or new.closed_by is null
       or new.locked_at is null
       or new.locked_by is null then

      raise exception
        'Locked accounting periods require complete close and lock metadata.';

    end if;

  end if;


  return new;

end;
$function$;
-- ------------------------------------------------------------
-- soft_close_accounting_period
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_close_accounting_period(p_period_id uuid)
 RETURNS accounting_periods
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_period public.accounting_periods%rowtype;
begin

  v_user_id := auth.uid();


  if v_user_id is null then
    raise exception
      'Authentication is required.';
  end if;


  select ap.*
  into v_period
  from public.accounting_periods as ap
  where ap.id = p_period_id
  for update;


  if not found then
    raise exception
      'Accounting period does not exist.';
  end if;


  if not exists (
    select 1
    from public.profiles as p
    where p.id = v_user_id
      and p.role = 'admin'::user_role
      and p.company_id = v_period.company_id
  ) then

    raise exception
      'You are not authorised to close this accounting period.';

  end if;


  if v_period.status = 'locked' then
    raise exception
      'A locked accounting period cannot be soft closed.';
  end if;


  if v_period.status = 'soft_closed' then
    return v_period;
  end if;


  update public.accounting_periods as ap
  set
    status = 'soft_closed',
    closed_at = now(),
    closed_by = v_user_id,
    locked_at = null,
    locked_by = null
  where ap.id = p_period_id
  returning ap.*
  into v_period;


  return v_period;

end;
$function$;
-- ------------------------------------------------------------
-- reopen_accounting_period
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reopen_accounting_period(p_period_id uuid)
 RETURNS accounting_periods
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_period public.accounting_periods%rowtype;
begin

  v_user_id := auth.uid();


  if v_user_id is null then
    raise exception
      'Authentication is required.';
  end if;


  select ap.*
  into v_period
  from public.accounting_periods as ap
  where ap.id = p_period_id
  for update;


  if not found then
    raise exception
      'Accounting period does not exist.';
  end if;


  if not exists (
    select 1
    from public.profiles as p
    where p.id = v_user_id
      and p.role = 'admin'::user_role
      and p.company_id = v_period.company_id
  ) then

    raise exception
      'You are not authorised to reopen this accounting period.';

  end if;


  if v_period.status = 'locked' then
    raise exception
      'A locked accounting period cannot be reopened.';
  end if;


  if v_period.status = 'open' then
    return v_period;
  end if;


  update public.accounting_periods as ap
  set
    status = 'open',
    closed_at = null,
    closed_by = null,
    locked_at = null,
    locked_by = null
  where ap.id = p_period_id
  returning ap.*
  into v_period;


  return v_period;

end;
$function$;
-- ------------------------------------------------------------
-- lock_accounting_period
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lock_accounting_period(p_period_id uuid)
 RETURNS accounting_periods
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_period public.accounting_periods%rowtype;
begin

  v_user_id := auth.uid();


  if v_user_id is null then
    raise exception
      'Authentication is required.';
  end if;


  select ap.*
  into v_period
  from public.accounting_periods as ap
  where ap.id = p_period_id
  for update;


  if not found then
    raise exception
      'Accounting period does not exist.';
  end if;


  if not exists (
    select 1
    from public.profiles as p
    where p.id = v_user_id
      and p.role = 'admin'::user_role
      and p.company_id = v_period.company_id
  ) then

    raise exception
      'You are not authorised to lock this accounting period.';

  end if;


  if v_period.status = 'locked' then
    return v_period;
  end if;


  update public.accounting_periods as ap
  set
    status = 'locked',

    closed_at =
      coalesce(ap.closed_at, now()),

    closed_by =
      coalesce(ap.closed_by, v_user_id),

    locked_at = now(),

    locked_by = v_user_id

  where ap.id = p_period_id
  returning ap.*
  into v_period;


  return v_period;

end;
$function$;
-- ------------------------------------------------------------
-- prevent_posted_journal_entry_delete
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_posted_journal_entry_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin

  if old.status <> 'draft' then
    raise exception
      'Posted or reversed journal entries cannot be deleted.';
  end if;

  return old;
end;
$function$;
-- ------------------------------------------------------------
-- prevent_posted_journal_line_delete
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_posted_journal_line_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  parent_status text;
begin

  select status
  into parent_status
  from public.journal_entries
  where id = old.journal_entry_id;

  if parent_status is null then
    return old;
  end if;

  if parent_status <> 'draft' then
    raise exception
      'Lines belonging to posted or reversed journal entries cannot be deleted.';
  end if;

  return old;
end;
$function$;
-- ------------------------------------------------------------
-- protect_posted_journal_entry
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_posted_journal_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin

  -- ----------------------------------------------------------
  -- Reversed entries are permanently immutable.
  -- ----------------------------------------------------------

  if old.status = 'reversed' then
    raise exception
      'Reversed journal entries are immutable.';
  end if;


  -- ----------------------------------------------------------
  -- Posted entries may only transition to REVERSED.
  --
  -- All original journal facts must remain identical.
  -- ----------------------------------------------------------

  if old.status = 'posted' then

    if new.status <> 'reversed' then
      raise exception
        'Posted journal entries are immutable. Use a controlled reversal.';
    end if;


    if new.company_id
         is distinct from old.company_id

       or new.accounting_period_id
         is distinct from old.accounting_period_id

       or new.entry_number
         is distinct from old.entry_number

       or new.entry_date
         is distinct from old.entry_date

       or new.description
         is distinct from old.description

       or new.reference
         is distinct from old.reference

       or new.source_type
         is distinct from old.source_type

       or new.source_id
         is distinct from old.source_id

       or new.source_action
         is distinct from old.source_action

       or new.base_currency_code
         is distinct from old.base_currency_code

       or new.reverses_entry_id
         is distinct from old.reverses_entry_id

       or new.posted_at
         is distinct from old.posted_at

       or new.posted_by
         is distinct from old.posted_by

       or new.created_by
         is distinct from old.created_by

       or new.created_at
         is distinct from old.created_at then

      raise exception
        'A journal reversal cannot modify the original posted accounting facts.';

    end if;


    if new.reversed_at is null
       or new.reversed_by is null then

      raise exception
        'A reversed journal entry requires reversed_at and reversed_by.';

    end if;


    return new;

  end if;


  -- Draft entries continue through normal RLS/privileges.

  return new;

end;
$function$;
-- ------------------------------------------------------------
-- post_journal_entry
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_journal_entry(p_journal_entry_id uuid)
 RETURNS TABLE(journal_entry_id uuid, entry_number bigint, status text, total_debit numeric, total_credit numeric, posted_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- ----------------------------------------------------------
  -- Authentication
  -- ----------------------------------------------------------

  v_user_id := auth.uid();


  if v_user_id is null then
    raise exception
      'Authentication is required to post a journal entry.';
  end if;


  -- ----------------------------------------------------------
  -- Lock draft
  -- ----------------------------------------------------------

  select je.*
  into v_entry
  from public.journal_entries as je
  where je.id = p_journal_entry_id
  for update;


  if not found then
    raise exception
      'Journal entry does not exist.';
  end if;


  -- ----------------------------------------------------------
  -- Company Admin authorization
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from public.profiles as p
    where p.id = v_user_id
      and p.role = 'admin'::user_role
      and p.company_id = v_entry.company_id
  ) then

    raise exception
      'You are not authorised to post this journal entry.';

  end if;


  -- ----------------------------------------------------------
  -- Draft only
  -- ----------------------------------------------------------

  if v_entry.status <> 'draft' then
    raise exception
      'Only draft journal entries can be posted.';
  end if;


  if v_entry.entry_number is not null then
    raise exception
      'Draft journal entry already has a journal number.';
  end if;


  -- ----------------------------------------------------------
  -- Base currency
  -- ----------------------------------------------------------

  select upper(coalesce(c.currency, 'USD'))
  into v_company_currency
  from public.companies as c
  where c.id = v_entry.company_id;


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


  -- ----------------------------------------------------------
  -- Accounting period
  -- ----------------------------------------------------------

  v_period_id :=
    v_entry.accounting_period_id;


  if v_period_id is null then

    select ap.id
    into v_period_id
    from public.accounting_periods as ap
    where ap.company_id = v_entry.company_id
      and ap.is_adjustment_period = false
      and v_entry.entry_date
        between ap.start_date and ap.end_date
    order by ap.start_date desc
    limit 1;


    if v_period_id is null then
      raise exception
        'No accounting period exists for journal date %.',
        v_entry.entry_date;
    end if;

  end if;


  select
    ap.status,
    ap.is_adjustment_period

  into
    v_period_status,
    v_is_adjustment_period

  from public.accounting_periods as ap

  where ap.id = v_period_id
    and ap.company_id = v_entry.company_id
    and v_entry.entry_date
      between ap.start_date and ap.end_date;


  if not found then
    raise exception
      'The selected accounting period is invalid for this journal entry.';
  end if;


  if v_period_status = 'locked' then
    raise exception
      'The accounting period is locked and cannot accept postings.';
  end if;


  if v_period_status = 'soft_closed'
     and not v_is_adjustment_period then

    raise exception
      'The accounting period is soft closed. Use an open adjustment period for accounting adjustments.';

  end if;


  -- ----------------------------------------------------------
  -- Lines + balancing
  -- ----------------------------------------------------------

  select
    count(*),
    coalesce(sum(jl.base_debit), 0),
    coalesce(sum(jl.base_credit), 0)

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


  if v_total_debit <> v_total_credit then

    raise exception
      'Journal entry is not balanced. Debits: %, Credits: %.',
      v_total_debit,
      v_total_credit;

  end if;


  -- ----------------------------------------------------------
  -- Account status validation
  -- ----------------------------------------------------------

  select count(*)
  into v_invalid_account_count

  from public.journal_lines as jl

  join public.accounting_accounts as aa
    on aa.id = jl.account_id

  where jl.journal_entry_id =
    v_entry.id

    and (
      aa.company_id <>
        v_entry.company_id

      or aa.status <> 'active'
    );


  if v_invalid_account_count > 0 then
    raise exception
      'Journal entry contains an inactive or invalid accounting account.';
  end if;


  -- ----------------------------------------------------------
  -- Manual control-account protection
  -- ----------------------------------------------------------

  if v_entry.source_type = 'manual' then

    select count(*)
    into v_manual_block_count

    from public.journal_lines as jl

    join public.accounting_accounts as aa
      on aa.id = jl.account_id

    where jl.journal_entry_id =
      v_entry.id

      and aa.allow_manual_posting = false;


    if v_manual_block_count > 0 then
      raise exception
        'One or more accounts do not allow manual journal posting.';
    end if;

  end if;


  -- ----------------------------------------------------------
  -- Sequential journal number
  -- ----------------------------------------------------------

  insert into public.accounting_journal_counters (
    company_id,
    next_number
  )
  values (
    v_entry.company_id,
    2
  )

  on conflict (company_id)
  do update

  set
    next_number =
      public.accounting_journal_counters.next_number + 1,

    updated_at = now()

  returning next_number - 1
  into v_entry_number;


  -- ----------------------------------------------------------
  -- Post
  -- ----------------------------------------------------------

  v_posted_at := now();


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


  return query
  select
    v_entry.id,
    v_entry_number,
    'posted'::text,
    v_total_debit,
    v_total_credit,
    v_posted_at;

end;
$function$;
-- ------------------------------------------------------------
-- reverse_journal_entry
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_journal_entry(p_journal_entry_id uuid, p_reversal_date date, p_reason text)
 RETURNS TABLE(original_journal_entry_id uuid, reversal_journal_entry_id uuid, reversal_entry_number bigint, original_status text, reversal_status text, effective_reversal_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;

  v_original public.journal_entries%rowtype;

  v_period_id uuid;

  v_reversal_entry_id uuid;
  v_reversal_entry_number bigint;

  v_reason text;

  v_original_line_count integer;
  v_reversal_line_count integer;

  v_original_debit numeric(24,4);
  v_original_credit numeric(24,4);

  v_reversal_debit numeric(24,4);
  v_reversal_credit numeric(24,4);
begin

  -- ==========================================================
  -- 2. AUTHENTICATION
  -- ==========================================================

  v_user_id := auth.uid();


  if v_user_id is null then
    raise exception
      'Authentication is required to reverse a journal entry.';
  end if;


  -- ==========================================================
  -- 3. INPUT VALIDATION
  -- ==========================================================

  if p_journal_entry_id is null then
    raise exception
      'Journal entry ID is required.';
  end if;


  if p_reversal_date is null then
    raise exception
      'Reversal date is required.';
  end if;


  v_reason := trim(coalesce(p_reason, ''));


  if length(v_reason) = 0 then
    raise exception
      'A reversal reason is required.';
  end if;


  -- ==========================================================
  -- 4. LOCK ORIGINAL JOURNAL
  --
  -- Prevents two reversal requests from processing the same
  -- posted journal simultaneously.
  -- ==========================================================

  select je.*
  into v_original

  from public.journal_entries as je

  where je.id =
    p_journal_entry_id

  for update;


  if not found then
    raise exception
      'Journal entry does not exist.';
  end if;


  -- ==========================================================
  -- 5. COMPANY ADMIN AUTHORIZATION
  -- ==========================================================

  if not exists (
    select 1

    from public.profiles as p

    where p.id = v_user_id

      and p.role =
        'admin'::user_role

      and p.company_id =
        v_original.company_id
  ) then

    raise exception
      'You are not authorised to reverse this journal entry.';

  end if;


  -- ==========================================================
  -- 6. ORIGINAL STATUS
  -- ==========================================================

  if v_original.status = 'draft' then
    raise exception
      'Draft journal entries cannot be reversed. Delete or edit the draft instead.';
  end if;


  if v_original.status = 'reversed' then
    raise exception
      'This journal entry has already been reversed.';
  end if;


  if v_original.status <> 'posted' then
    raise exception
      'Only posted journal entries can be reversed.';
  end if;


  -- ==========================================================
  -- 7. PREVENT DUPLICATE REVERSALS
  --
  -- There is also a unique database index protecting this.
  -- This check provides a clearer error message.
  -- ==========================================================

  if exists (
    select 1

    from public.journal_entries as existing

    where existing.reverses_entry_id =
      v_original.id
  ) then

    raise exception
      'A reversal journal already exists for this journal entry.';

  end if;


  -- ==========================================================
  -- 8. FIND ELIGIBLE REVERSAL PERIOD
  --
  -- Preference:
  --
  -- 1. Open normal accounting period
  -- 2. Open adjustment period
  -- 3. Soft-closed adjustment period
  --
  -- Locked periods are never eligible.
  -- ==========================================================

  select ap.id
  into v_period_id

  from public.accounting_periods as ap

  where ap.company_id =
    v_original.company_id

    and p_reversal_date
      between ap.start_date and ap.end_date

    and (
      (
        ap.is_adjustment_period = false
        and ap.status = 'open'
      )

      or

      (
        ap.is_adjustment_period = true
        and ap.status in (
          'open',
          'soft_closed'
        )
      )
    )

  order by

    case

      when ap.is_adjustment_period = false
        and ap.status = 'open'
      then 1

      when ap.is_adjustment_period = true
        and ap.status = 'open'
      then 2

      else 3

    end,

    ap.start_date,

    ap.id

  limit 1;


  if v_period_id is null then
    raise exception
      'No eligible accounting period exists for reversal date %.',
      p_reversal_date;
  end if;


  -- ==========================================================
  -- 9. VERIFY ORIGINAL JOURNAL LINES
  -- ==========================================================

  select
    count(*),
    coalesce(sum(jl.base_debit), 0),
    coalesce(sum(jl.base_credit), 0)

  into
    v_original_line_count,
    v_original_debit,
    v_original_credit

  from public.journal_lines as jl

  where jl.journal_entry_id =
    v_original.id

    and jl.company_id =
      v_original.company_id;


  if v_original_line_count < 2 then
    raise exception
      'Original posted journal does not contain enough journal lines.';
  end if;


  if v_original_debit <>
     v_original_credit then

    raise exception
      'Original posted journal is not balanced. Reversal aborted.';

  end if;


  -- ==========================================================
  -- 10. CREATE REVERSAL JOURNAL HEADER
  -- ==========================================================

  insert into public.journal_entries (
    company_id,

    accounting_period_id,

    entry_date,

    description,

    reference,

    source_type,

    source_id,

    source_action,

    base_currency_code,

    status,

    reverses_entry_id,

    created_by
  )

  values (
    v_original.company_id,

    v_period_id,

    p_reversal_date,

    'Reversal of JE '
      || coalesce(
           v_original.entry_number::text,
           v_original.id::text
         )
      || ': '
      || v_reason,

    'REV-JE-'
      || coalesce(
           v_original.entry_number::text,
           left(v_original.id::text, 8)
         ),

    'reversal',

    v_original.id,

    'reverse',

    v_original.base_currency_code,

    'draft',

    v_original.id,

    v_user_id
  )

  returning id
  into v_reversal_entry_id;


  -- ==========================================================
  -- 11. COPY ORIGINAL LINES IN REVERSE
  --
  -- Original debit becomes reversal credit.
  -- Original credit becomes reversal debit.
  --
  -- Transaction currency and exchange rate are preserved.
  -- ==========================================================

  insert into public.journal_lines (
    company_id,

    journal_entry_id,

    line_number,

    account_id,

    description,

    debit,

    credit,

    currency_code,

    exchange_rate,

    created_by
  )

  select
    jl.company_id,

    v_reversal_entry_id,

    jl.line_number,

    jl.account_id,

    case

      when jl.description is null
        or trim(jl.description) = ''
      then
        'Reversal'

      else
        'Reversal: ' || jl.description

    end,

    jl.credit,

    jl.debit,

    jl.currency_code,

    jl.exchange_rate,

    v_user_id

  from public.journal_lines as jl

  where jl.journal_entry_id =
    v_original.id

  order by jl.line_number;


  -- ==========================================================
  -- 12. VERIFY REVERSAL MIRRORS ORIGINAL
  -- ==========================================================

  select
    count(*),
    coalesce(sum(jl.base_debit), 0),
    coalesce(sum(jl.base_credit), 0)

  into
    v_reversal_line_count,
    v_reversal_debit,
    v_reversal_credit

  from public.journal_lines as jl

  where jl.journal_entry_id =
    v_reversal_entry_id;


  if v_reversal_line_count <>
     v_original_line_count then

    raise exception
      'Reversal line count does not match original journal.';

  end if;


  if v_reversal_debit <>
     v_original_credit then

    raise exception
      'Reversal debit total does not match original credit total.';

  end if;


  if v_reversal_credit <>
     v_original_debit then

    raise exception
      'Reversal credit total does not match original debit total.';

  end if;


  if v_reversal_debit <>
     v_reversal_credit then

    raise exception
      'Generated reversal journal is not balanced.';

  end if;


  -- ==========================================================
  -- 13. POST REVERSAL
  --
  -- Uses the same controlled double-entry posting engine as
  -- every other Helix journal.
  -- ==========================================================

  select result.entry_number
  into v_reversal_entry_number

  from public.post_journal_entry(
    v_reversal_entry_id
  ) as result;


  if v_reversal_entry_number is null then
    raise exception
      'Reversal journal failed to receive a journal number.';
  end if;


  -- ==========================================================
  -- 14. MARK ORIGINAL AS REVERSED
  --
  -- We do NOT delete it.
  -- We do NOT modify its lines.
  -- We do NOT remove it from the General Ledger.
  -- ==========================================================

  update public.journal_entries as je

  set
    status = 'reversed',

    reversed_at = now(),

    reversed_by = v_user_id

  where je.id =
    v_original.id;


  -- ==========================================================
  -- 15. FINAL INTEGRITY CHECK
  -- ==========================================================

  if not exists (
    select 1

    from public.journal_entries as original

    where original.id =
      v_original.id

      and original.status =
        'reversed'

      and original.reversed_at
        is not null

      and original.reversed_by =
        v_user_id
  ) then

    raise exception
      'Original journal was not correctly marked as reversed.';
  end if;


  if not exists (
    select 1

    from public.journal_entries as reversal

    where reversal.id =
      v_reversal_entry_id

      and reversal.status =
        'posted'

      and reversal.reverses_entry_id =
        v_original.id

      and reversal.entry_number =
        v_reversal_entry_number
  ) then

    raise exception
      'Reversal journal posting metadata is invalid.';
  end if;


  -- ==========================================================
  -- 16. RETURN
  -- ==========================================================

  return query

  select
    v_original.id,
    v_reversal_entry_id,
    v_reversal_entry_number,
    'reversed'::text,
    'posted'::text,
    p_reversal_date;

end;
$function$;


-- ============================================================
-- 2. FINAL TRIGGER WIRING
-- ============================================================

-- Account hierarchy validation, including cycle prevention.

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


-- Protect permanent Helix/system-account identity.

drop trigger if exists
  trg_protect_accounting_account_identity
on public.accounting_accounts;

create trigger
  trg_protect_accounting_account_identity
before update
on public.accounting_accounts
for each row
execute function
  public.protect_accounting_account_identity();


-- Enforce valid open / soft_closed / locked metadata.

drop trigger if exists
  trg_validate_accounting_period_state
on public.accounting_periods;

create trigger
  trg_validate_accounting_period_state
before insert or update
on public.accounting_periods
for each row
execute function
  public.validate_accounting_period_state();


-- Protect posted/reversed journal headers.
-- The final function permits only the controlled posted ->
-- reversed transition while preserving original facts.

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


-- Posted/reversed journal headers cannot be deleted.

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


-- Posted/reversed journal lines cannot be deleted.

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
-- 3. FINAL ROW LEVEL SECURITY STATE
-- ============================================================

alter table public.accounting_accounts
enable row level security;

alter table public.accounting_periods
enable row level security;

alter table public.accounting_journal_counters
enable row level security;

alter table public.journal_entries
enable row level security;

alter table public.journal_lines
enable row level security;


-- Remove the earlier period-update policy before installing
-- the hardened live policy set.

drop policy if exists
  "Admins can update accounting periods"
on public.accounting_periods;


drop policy if exists "Admins can create accounting accounts" on public.accounting_accounts;

create policy "Admins can create accounting accounts"
on public.accounting_accounts
as permissive
for INSERT
to authenticated
with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = accounting_accounts.company_id)))) AND ((created_by IS NULL) OR (created_by = auth.uid()))));
drop policy if exists "Admins can read accounting accounts" on public.accounting_accounts;

create policy "Admins can read accounting accounts"
on public.accounting_accounts
as permissive
for SELECT
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = accounting_accounts.company_id)))));
drop policy if exists "Admins can update accounting accounts" on public.accounting_accounts;

create policy "Admins can update accounting accounts"
on public.accounting_accounts
as permissive
for UPDATE
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = accounting_accounts.company_id)))))
with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = accounting_accounts.company_id)))));
drop policy if exists "Admins can create accounting periods" on public.accounting_periods;

create policy "Admins can create accounting periods"
on public.accounting_periods
as permissive
for INSERT
to authenticated
with check (((status = 'open'::text) AND (closed_at IS NULL) AND (closed_by IS NULL) AND (locked_at IS NULL) AND (locked_by IS NULL) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::user_role) AND (p.company_id = accounting_periods.company_id)))) AND ((created_by IS NULL) OR (created_by = auth.uid()))));
drop policy if exists "Admins can read accounting periods" on public.accounting_periods;

create policy "Admins can read accounting periods"
on public.accounting_periods
as permissive
for SELECT
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = accounting_periods.company_id)))));
drop policy if exists "Admins can update open accounting periods" on public.accounting_periods;

create policy "Admins can update open accounting periods"
on public.accounting_periods
as permissive
for UPDATE
to authenticated
using (((status = 'open'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::user_role) AND (p.company_id = accounting_periods.company_id))))))
with check (((status = 'open'::text) AND (closed_at IS NULL) AND (closed_by IS NULL) AND (locked_at IS NULL) AND (locked_by IS NULL) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::user_role) AND (p.company_id = accounting_periods.company_id))))));
drop policy if exists "Admins can create draft journal entries" on public.journal_entries;

create policy "Admins can create draft journal entries"
on public.journal_entries
as permissive
for INSERT
to authenticated
with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = journal_entries.company_id)))) AND (status = 'draft'::text) AND (entry_number IS NULL) AND (posted_at IS NULL) AND (posted_by IS NULL) AND (reversed_at IS NULL) AND (reversed_by IS NULL) AND (reverses_entry_id IS NULL) AND ((created_by IS NULL) OR (created_by = auth.uid()))));
drop policy if exists "Admins can delete draft journal entries" on public.journal_entries;

create policy "Admins can delete draft journal entries"
on public.journal_entries
as permissive
for DELETE
to authenticated
using (((status = 'draft'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = journal_entries.company_id))))));
drop policy if exists "Admins can read journal entries" on public.journal_entries;

create policy "Admins can read journal entries"
on public.journal_entries
as permissive
for SELECT
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = journal_entries.company_id)))));
drop policy if exists "Admins can update draft journal entries" on public.journal_entries;

create policy "Admins can update draft journal entries"
on public.journal_entries
as permissive
for UPDATE
to authenticated
using (((status = 'draft'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = journal_entries.company_id))))))
with check (((status = 'draft'::text) AND (entry_number IS NULL) AND (posted_at IS NULL) AND (posted_by IS NULL) AND (reversed_at IS NULL) AND (reversed_by IS NULL) AND (reverses_entry_id IS NULL) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = journal_entries.company_id))))));
drop policy if exists "Admins can create journal lines" on public.journal_lines;

create policy "Admins can create journal lines"
on public.journal_lines
as permissive
for INSERT
to authenticated
with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = journal_lines.company_id)))) AND ((created_by IS NULL) OR (created_by = auth.uid())) AND (EXISTS ( SELECT 1
   FROM journal_entries
  WHERE ((journal_entries.id = journal_lines.journal_entry_id) AND (journal_entries.company_id = journal_lines.company_id) AND (journal_entries.status = 'draft'::text))))));
drop policy if exists "Admins can delete draft journal lines" on public.journal_lines;

create policy "Admins can delete draft journal lines"
on public.journal_lines
as permissive
for DELETE
to authenticated
using (((EXISTS ( SELECT 1
   FROM journal_entries
  WHERE ((journal_entries.id = journal_lines.journal_entry_id) AND (journal_entries.status = 'draft'::text)))) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = journal_lines.company_id))))));
drop policy if exists "Admins can read journal lines" on public.journal_lines;

create policy "Admins can read journal lines"
on public.journal_lines
as permissive
for SELECT
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = journal_lines.company_id)))));
drop policy if exists "Admins can update draft journal lines" on public.journal_lines;

create policy "Admins can update draft journal lines"
on public.journal_lines
as permissive
for UPDATE
to authenticated
using (((EXISTS ( SELECT 1
   FROM journal_entries
  WHERE ((journal_entries.id = journal_lines.journal_entry_id) AND (journal_entries.status = 'draft'::text)))) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = journal_lines.company_id))))))
with check (((EXISTS ( SELECT 1
   FROM journal_entries
  WHERE ((journal_entries.id = journal_lines.journal_entry_id) AND (journal_entries.company_id = journal_lines.company_id) AND (journal_entries.status = 'draft'::text)))) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role) AND (profiles.company_id = journal_lines.company_id))))));


-- accounting_journal_counters intentionally has no direct
-- authenticated RLS policy. It is internal posting-engine state.


-- ============================================================
-- 4. EXACT FINAL TABLE/COLUMN PRIVILEGES
--
-- These grants reproduce the compact privilege export from the
-- validated live database.
-- ============================================================

-- ------------------------------------------------------------
-- accounting_accounts
-- ------------------------------------------------------------

revoke all
on public.accounting_accounts
from anon, authenticated;

grant select
on public.accounting_accounts
to authenticated;

grant insert (
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
on public.accounting_accounts
to authenticated;

grant update (
  code,
  name,
  account_subtype,
  parent_account_id,
  description,
  currency_code,
  allow_manual_posting,
  status,
  sort_order
)
on public.accounting_accounts
to authenticated;


-- ------------------------------------------------------------
-- accounting_periods
-- ------------------------------------------------------------

revoke all
on public.accounting_periods
from anon, authenticated;

grant select
on public.accounting_periods
to authenticated;

grant insert (
  company_id,
  fiscal_year_label,
  period_number,
  name,
  start_date,
  end_date,
  is_adjustment_period,
  notes,
  created_by
)
on public.accounting_periods
to authenticated;

grant update (
  fiscal_year_label,
  period_number,
  name,
  start_date,
  end_date,
  is_adjustment_period,
  notes
)
on public.accounting_periods
to authenticated;


-- ------------------------------------------------------------
-- accounting_journal_counters
-- ------------------------------------------------------------

revoke all
on public.accounting_journal_counters
from anon, authenticated;


-- ------------------------------------------------------------
-- journal_entries
-- ------------------------------------------------------------

revoke all
on public.journal_entries
from anon, authenticated;

grant select, delete
on public.journal_entries
to authenticated;

grant insert (
  company_id,
  accounting_period_id,
  entry_date,
  description,
  reference,
  source_type,
  source_id,
  source_action,
  base_currency_code,
  created_by
)
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
-- journal_lines
-- ------------------------------------------------------------

revoke all
on public.journal_lines
from anon, authenticated;

grant select, delete
on public.journal_lines
to authenticated;

grant insert (
  company_id,
  journal_entry_id,
  line_number,
  account_id,
  description,
  debit,
  credit,
  currency_code,
  exchange_rate,
  created_by
)
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
-- 5. CONTROLLED FUNCTION EXECUTION
-- ============================================================

revoke all
on function public.post_journal_entry(uuid)
from public, anon;

grant execute
on function public.post_journal_entry(uuid)
to authenticated;


revoke all
on function public.reverse_journal_entry(uuid, date, text)
from public, anon;

grant execute
on function public.reverse_journal_entry(uuid, date, text)
to authenticated;


revoke all
on function public.soft_close_accounting_period(uuid)
from public, anon;

grant execute
on function public.soft_close_accounting_period(uuid)
to authenticated;


revoke all
on function public.reopen_accounting_period(uuid)
from public, anon;

grant execute
on function public.reopen_accounting_period(uuid)
to authenticated;


revoke all
on function public.lock_accounting_period(uuid)
from public, anon;

grant execute
on function public.lock_accounting_period(uuid)
to authenticated;


-- ============================================================
-- 6. FINAL REVERSAL-AWARE GENERAL LEDGER VIEW
--
-- DROP + CREATE is intentional. Earlier Stage 2A development
-- versions used a slightly different view column layout.
-- Recreating the view guarantees a fresh migration chain ends
-- with the exact validated live definition.
-- ============================================================

drop view if exists public.general_ledger_view;

create view public.general_ledger_view
with (
  security_invoker = true
)
as
SELECT je.company_id,
    je.id AS journal_entry_id,
    je.entry_number,
    je.entry_date,
    je.description AS journal_description,
    je.reference,
    je.source_type,
    je.source_id,
    je.source_action,
    je.accounting_period_id,
    jl.id AS journal_line_id,
    jl.line_number,
    aa.id AS account_id,
    aa.code AS account_code,
    aa.name AS account_name,
    aa.account_type,
    aa.account_subtype,
    aa.normal_balance,
    aa.system_key,
    jl.description AS line_description,
    jl.currency_code,
    jl.exchange_rate,
    jl.debit,
    jl.credit,
    jl.base_debit,
    jl.base_credit,
    je.base_currency_code,
    je.posted_at,
    je.posted_by,
    je.status AS journal_status,
    je.reverses_entry_id,
    je.reversed_at,
    je.reversed_by
   FROM journal_entries je
     JOIN journal_lines jl ON jl.journal_entry_id = je.id AND jl.company_id = je.company_id
     JOIN accounting_accounts aa ON aa.id = jl.account_id AND aa.company_id = je.company_id
  WHERE je.status = ANY (ARRAY['posted'::text, 'reversed'::text]);


revoke all
on public.general_ledger_view
from anon, authenticated;

grant select
on public.general_ledger_view
to authenticated;


comment on view public.general_ledger_view is
  'Authoritative Helix General Ledger. Includes posted journals and original journals marked reversed so controlled reversal journals offset the original accounting history without destructive deletion.';


-- ============================================================
-- 7. DOCUMENTATION
-- ============================================================

comment on function public.reverse_journal_entry(uuid, date, text) is
  'Creates and posts a separate reversing journal, then marks the original posted journal as reversed while preserving both records in the General Ledger.';

comment on function public.soft_close_accounting_period(uuid) is
  'Controlled admin operation that soft closes an accounting period and stamps close metadata.';

comment on function public.reopen_accounting_period(uuid) is
  'Controlled admin operation that reopens a soft-closed accounting period. Locked periods cannot be reopened.';

comment on function public.lock_accounting_period(uuid) is
  'Controlled admin operation that permanently locks an accounting period through the ordinary Helix accounting workflow.';


commit;


-- ============================================================
-- END
-- ============================================================
