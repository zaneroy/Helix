-- ============================================================
-- HELIX STAGE 2A
-- 008 - ACCOUNTING CORE INTEGRITY TESTS
--
-- Rollback-safe integration test suite for the final Stage 2A
-- accounting foundation.
--
-- IMPORTANT:
--   - Run after migrations 001-007.
--   - Requires at least one existing Admin profile with a
--     company_id.
--   - All temporary test data is rolled back.
--   - The script intentionally tests expected failures.
--
-- Coverage: 35 checks
-- ============================================================

begin;

do $$
declare
  v_test_count integer := 0;

  v_admin_id uuid;
  v_company_id uuid;
  v_currency text;

  v_year integer;
  v_period_start date;
  v_period_end date;

  v_normal_period_id uuid := gen_random_uuid();
  v_adjustment_period_id uuid := gen_random_uuid();
  v_locked_period_id uuid := gen_random_uuid();
  v_reversal_period_id uuid := gen_random_uuid();

  v_debit_account_id uuid := gen_random_uuid();
  v_credit_account_id uuid := gen_random_uuid();
  v_parent_account_id uuid := gen_random_uuid();
  v_child_account_id uuid := gen_random_uuid();

  v_system_account_id uuid;
  v_control_account_id uuid;

  v_unbalanced_journal_id uuid := gen_random_uuid();
  v_balanced_journal_id uuid := gen_random_uuid();
  v_control_journal_id uuid := gen_random_uuid();
  v_draft_journal_id uuid := gen_random_uuid();
  v_soft_closed_journal_id uuid := gen_random_uuid();
  v_locked_journal_id uuid := gen_random_uuid();
  v_reversal_original_id uuid := gen_random_uuid();

  v_reversal_journal_id uuid;

  v_entry_number bigint;
  v_reversal_entry_number bigint;

  v_count integer;
  v_created integer;

  v_debit numeric;
  v_credit numeric;

  v_failed boolean;

  v_tag text := replace(left(gen_random_uuid()::text, 8), '-', '');
  v_fiscal_label text;
begin

  -- ==========================================================
  -- TEST 1
  -- Admin/company exists
  -- ==========================================================

  select
    p.id,
    p.company_id

  into
    v_admin_id,
    v_company_id

  from public.profiles as p

  join public.companies as c
    on c.id = p.company_id

  where p.role = 'admin'::user_role
    and p.company_id is not null

  order by p.id

  limit 1;


  if v_admin_id is null
     or v_company_id is null then

    raise exception
      'TEST 1 FAILED: No Admin profile with a company was found.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 2
  -- Simulated authenticated Admin context
  -- ==========================================================

  perform set_config(
    'request.jwt.claim.sub',
    v_admin_id::text,
    true
  );


  if auth.uid() is distinct from v_admin_id then

    raise exception
      'TEST 2 FAILED: auth.uid() did not resolve to the selected Admin.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 3
  -- Company base currency
  -- ==========================================================

  select
    upper(coalesce(c.currency, 'USD'))

  into
    v_currency

  from public.companies as c

  where c.id = v_company_id;


  if v_currency is null
     or v_currency !~ '^[A-Z]{3}$' then

    raise exception
      'TEST 3 FAILED: Company base currency is invalid: %.',
      v_currency;

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 4
  -- Exactly 66 required Helix system accounts
  -- ==========================================================

  select count(*)

  into v_count

  from public.accounting_accounts as aa

  where aa.company_id = v_company_id
    and aa.is_system = true
    and aa.system_key in (
      select t.system_key
      from public.helix_default_chart_of_accounts_template() as t
    );


  if v_count <> 66 then

    raise exception
      'TEST 4 FAILED: Expected 66 Helix system accounts, found %.',
      v_count;

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 5
  -- Critical permanent system mappings
  -- ==========================================================

  select count(*)

  into v_count

  from public.accounting_accounts as aa

  where aa.company_id = v_company_id
    and (
      (aa.system_key = 'cash_and_cash_equivalents' and aa.code = '1000')
      or
      (aa.system_key = 'accounts_receivable' and aa.code = '1100')
      or
      (aa.system_key = 'accounts_payable' and aa.code = '2000')
      or
      (aa.system_key = 'retained_earnings' and aa.code = '3100')
      or
      (aa.system_key = 'sales_revenue' and aa.code = '4000')
      or
      (aa.system_key = 'cost_of_goods_sold' and aa.code = '5000')
    );


  if v_count <> 6 then

    raise exception
      'TEST 5 FAILED: One or more critical Helix system mappings are missing.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 6
  -- Default COA seeding is idempotent
  -- ==========================================================

  select public.seed_default_chart_of_accounts(v_company_id)
  into v_created;


  if v_created <> 0 then

    raise exception
      'TEST 6 FAILED: Idempotent seed unexpectedly created % accounts.',
      v_created;

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 7
  -- RLS enabled on all five accounting tables
  -- ==========================================================

  select count(*)

  into v_count

  from pg_class as c

  join pg_namespace as n
    on n.oid = c.relnamespace

  where n.nspname = 'public'
    and c.relname in (
      'accounting_accounts',
      'accounting_periods',
      'accounting_journal_counters',
      'journal_entries',
      'journal_lines'
    )
    and c.relrowsecurity = true;


  if v_count <> 5 then

    raise exception
      'TEST 7 FAILED: Expected RLS on all five accounting tables; found %.',
      v_count;

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 8
  -- Critical protected columns are not directly writable
  -- ==========================================================

  if
    has_column_privilege(
      'authenticated',
      'public.accounting_accounts',
      'system_key',
      'UPDATE'
    )
    or
    has_column_privilege(
      'authenticated',
      'public.accounting_accounts',
      'is_system',
      'UPDATE'
    )
    or
    has_column_privilege(
      'authenticated',
      'public.journal_entries',
      'entry_number',
      'UPDATE'
    )
    or
    has_column_privilege(
      'authenticated',
      'public.journal_entries',
      'status',
      'UPDATE'
    )
    or
    has_column_privilege(
      'authenticated',
      'public.journal_entries',
      'posted_at',
      'UPDATE'
    )
    or
    has_column_privilege(
      'authenticated',
      'public.accounting_periods',
      'status',
      'UPDATE'
    )
  then

    raise exception
      'TEST 8 FAILED: One or more protected accounting columns are directly writable by authenticated.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- Find a clean future test year
  -- ==========================================================

  select y

  into v_year

  from generate_series(2200, 2299) as y

  where not exists (
    select 1

    from public.accounting_periods as ap

    where ap.company_id = v_company_id
      and ap.is_adjustment_period = false
      and daterange(
        ap.start_date,
        ap.end_date,
        '[]'
      ) && daterange(
        make_date(y, 1, 1),
        make_date(y, 3, 31),
        '[]'
      )
  )

  order by y

  limit 1;


  if v_year is null then

    raise exception
      'Unable to find an isolated future year for Stage 2A tests.';

  end if;


  v_fiscal_label :=
    'HELIX-TEST-' || v_year::text || '-' || v_tag;


  -- ==========================================================
  -- TEST 9
  -- Temporary adjustment period
  -- ==========================================================

  insert into public.accounting_periods (
    id,
    company_id,
    fiscal_year_label,
    period_number,
    name,
    start_date,
    end_date,
    status,
    is_adjustment_period,
    created_by
  )
  values (
    v_adjustment_period_id,
    v_company_id,
    v_fiscal_label,
    53,
    'Helix Test Adjustment Period',
    make_date(v_year, 1, 1),
    make_date(v_year, 1, 31),
    'open',
    true,
    v_admin_id
  );


  if not exists (
    select 1
    from public.accounting_periods as ap
    where ap.id = v_adjustment_period_id
      and ap.status = 'open'
      and ap.is_adjustment_period = true
  ) then

    raise exception
      'TEST 9 FAILED: Adjustment period was not created correctly.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 10
  -- Isolated normal accounting period
  -- ==========================================================

  v_period_start := make_date(v_year, 1, 1);
  v_period_end := make_date(v_year, 1, 31);


  insert into public.accounting_periods (
    id,
    company_id,
    fiscal_year_label,
    period_number,
    name,
    start_date,
    end_date,
    status,
    is_adjustment_period,
    created_by
  )
  values (
    v_normal_period_id,
    v_company_id,
    v_fiscal_label,
    1,
    'Helix Test Normal Period',
    v_period_start,
    v_period_end,
    'open',
    false,
    v_admin_id
  );


  if not exists (
    select 1
    from public.accounting_periods as ap
    where ap.id = v_normal_period_id
      and ap.status = 'open'
      and ap.is_adjustment_period = false
  ) then

    raise exception
      'TEST 10 FAILED: Normal accounting period was not created correctly.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 11
  -- Custom accounting accounts
  -- ==========================================================

  insert into public.accounting_accounts (
    id,
    company_id,
    code,
    name,
    account_type,
    account_subtype,
    normal_balance,
    description,
    currency_code,
    is_system,
    is_contra,
    allow_manual_posting,
    status,
    sort_order,
    created_by
  )
  values
  (
    v_debit_account_id,
    v_company_id,
    'TST-D-' || v_tag,
    'Helix Test Debit Account',
    'asset',
    'test_asset',
    'debit',
    'Temporary Stage 2A integrity-test account.',
    v_currency,
    false,
    false,
    true,
    'active',
    990001,
    v_admin_id
  ),
  (
    v_credit_account_id,
    v_company_id,
    'TST-C-' || v_tag,
    'Helix Test Credit Account',
    'revenue',
    'test_revenue',
    'credit',
    'Temporary Stage 2A integrity-test account.',
    v_currency,
    false,
    false,
    true,
    'active',
    990002,
    v_admin_id
  ),
  (
    v_parent_account_id,
    v_company_id,
    'TST-P-' || v_tag,
    'Helix Test Parent',
    'asset',
    'test_parent',
    'debit',
    'Temporary hierarchy test account.',
    v_currency,
    false,
    false,
    true,
    'active',
    990003,
    v_admin_id
  ),
  (
    v_child_account_id,
    v_company_id,
    'TST-CH-' || v_tag,
    'Helix Test Child',
    'asset',
    'test_child',
    'debit',
    'Temporary hierarchy test account.',
    v_currency,
    false,
    false,
    true,
    'active',
    990004,
    v_admin_id
  );


  update public.accounting_accounts
  set parent_account_id = v_parent_account_id
  where id = v_child_account_id;


  select count(*)
  into v_count
  from public.accounting_accounts as aa
  where aa.id in (
    v_debit_account_id,
    v_credit_account_id,
    v_parent_account_id,
    v_child_account_id
  )
    and aa.company_id = v_company_id
    and aa.is_system = false;


  if v_count <> 4 then

    raise exception
      'TEST 11 FAILED: Custom test accounts were not created correctly.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 12
  -- Hierarchy-cycle rejection
  -- ==========================================================

  v_failed := false;

  begin

    update public.accounting_accounts
    set parent_account_id = v_child_account_id
    where id = v_parent_account_id;

  exception
    when others then
      v_failed := true;
  end;


  if not v_failed then

    raise exception
      'TEST 12 FAILED: Accounting account hierarchy cycle was accepted.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 13
  -- system_key immutability
  -- ==========================================================

  select aa.id
  into v_system_account_id
  from public.accounting_accounts as aa
  where aa.company_id = v_company_id
    and aa.system_key = 'cash_and_cash_equivalents'
  limit 1;


  if v_system_account_id is null then

    raise exception
      'TEST 13 FAILED: Required system account was not found.';

  end if;


  v_failed := false;

  begin

    update public.accounting_accounts
    set system_key = 'illegal_test_change_' || v_tag
    where id = v_system_account_id;

  exception
    when others then
      v_failed := true;
  end;


  if not v_failed then

    raise exception
      'TEST 13 FAILED: system_key mutation was accepted.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 14
  -- Unbalanced journal is rejected
  -- ==========================================================

  insert into public.journal_entries (
    id,
    company_id,
    accounting_period_id,
    entry_date,
    description,
    source_type,
    base_currency_code,
    status,
    created_by
  )
  values (
    v_unbalanced_journal_id,
    v_company_id,
    v_normal_period_id,
    v_period_start,
    'Helix Test Unbalanced Journal',
    'manual',
    v_currency,
    'draft',
    v_admin_id
  );


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
  values
  (
    v_company_id,
    v_unbalanced_journal_id,
    1,
    v_debit_account_id,
    'Unbalanced debit',
    100,
    0,
    v_currency,
    1,
    v_admin_id
  ),
  (
    v_company_id,
    v_unbalanced_journal_id,
    2,
    v_credit_account_id,
    'Unbalanced credit',
    0,
    90,
    v_currency,
    1,
    v_admin_id
  );


  v_failed := false;

  begin

    perform *
    from public.post_journal_entry(v_unbalanced_journal_id);

  exception
    when others then
      v_failed := true;
  end;


  if not v_failed then

    raise exception
      'TEST 14 FAILED: Unbalanced journal was posted.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 15
  -- Balanced journal posts successfully
  -- ==========================================================

  insert into public.journal_entries (
    id,
    company_id,
    accounting_period_id,
    entry_date,
    description,
    source_type,
    base_currency_code,
    status,
    created_by
  )
  values (
    v_balanced_journal_id,
    v_company_id,
    v_normal_period_id,
    v_period_start,
    'Helix Test Balanced Journal',
    'manual',
    v_currency,
    'draft',
    v_admin_id
  );


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
  values
  (
    v_company_id,
    v_balanced_journal_id,
    1,
    v_debit_account_id,
    'Balanced debit',
    100,
    0,
    v_currency,
    1,
    v_admin_id
  ),
  (
    v_company_id,
    v_balanced_journal_id,
    2,
    v_credit_account_id,
    'Balanced credit',
    0,
    100,
    v_currency,
    1,
    v_admin_id
  );


  select result.entry_number
  into v_entry_number
  from public.post_journal_entry(v_balanced_journal_id) as result;


  if v_entry_number is null
     or not exists (
       select 1
       from public.journal_entries as je
       where je.id = v_balanced_journal_id
         and je.status = 'posted'
         and je.entry_number = v_entry_number
         and je.posted_at is not null
         and je.posted_by = v_admin_id
     ) then

    raise exception
      'TEST 15 FAILED: Balanced journal did not post correctly.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 16
  -- Posted journal appears correctly in General Ledger
  -- ==========================================================

  select
    count(*),
    coalesce(sum(gl.base_debit), 0),
    coalesce(sum(gl.base_credit), 0)

  into
    v_count,
    v_debit,
    v_credit

  from public.general_ledger_view as gl

  where gl.journal_entry_id = v_balanced_journal_id;


  if v_count <> 2
     or v_debit <> 100
     or v_credit <> 100 then

    raise exception
      'TEST 16 FAILED: General Ledger totals are incorrect. Lines %, debit %, credit %.',
      v_count,
      v_debit,
      v_credit;

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 17
  -- Posted journal header is immutable
  -- ==========================================================

  v_failed := false;

  begin

    update public.journal_entries
    set description = 'ILLEGAL POSTED EDIT'
    where id = v_balanced_journal_id;

  exception
    when others then
      v_failed := true;
  end;


  if not v_failed then

    raise exception
      'TEST 17 FAILED: Posted journal header was editable.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 18
  -- Posted journal lines are immutable
  -- ==========================================================

  v_failed := false;

  begin

    update public.journal_lines
    set description = 'ILLEGAL POSTED LINE EDIT'
    where journal_entry_id = v_balanced_journal_id
      and line_number = 1;

  exception
    when others then
      v_failed := true;
  end;


  if not v_failed then

    raise exception
      'TEST 18 FAILED: Posted journal line was editable.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 19
  -- Manual posting to a protected control account is rejected
  -- ==========================================================

  select aa.id
  into v_control_account_id
  from public.accounting_accounts as aa
  where aa.company_id = v_company_id
    and aa.allow_manual_posting = false
    and aa.status = 'active'
  order by aa.code
  limit 1;


  if v_control_account_id is null then

    raise exception
      'TEST 19 FAILED: No protected control account was found.';

  end if;


  insert into public.journal_entries (
    id,
    company_id,
    accounting_period_id,
    entry_date,
    description,
    source_type,
    base_currency_code,
    status,
    created_by
  )
  values (
    v_control_journal_id,
    v_company_id,
    v_normal_period_id,
    v_period_start,
    'Helix Test Control Account Journal',
    'manual',
    v_currency,
    'draft',
    v_admin_id
  );


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
  values
  (
    v_company_id,
    v_control_journal_id,
    1,
    v_control_account_id,
    'Protected control account',
    50,
    0,
    v_currency,
    1,
    v_admin_id
  ),
  (
    v_company_id,
    v_control_journal_id,
    2,
    v_credit_account_id,
    'Balancing account',
    0,
    50,
    v_currency,
    1,
    v_admin_id
  );


  v_failed := false;

  begin

    perform *
    from public.post_journal_entry(v_control_journal_id);

  exception
    when others then
      v_failed := true;
  end;


  if not v_failed then

    raise exception
      'TEST 19 FAILED: Manual posting to a protected control account was accepted.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 20
  -- Drafts are excluded from General Ledger
  -- ==========================================================

  insert into public.journal_entries (
    id,
    company_id,
    accounting_period_id,
    entry_date,
    description,
    source_type,
    base_currency_code,
    status,
    created_by
  )
  values (
    v_draft_journal_id,
    v_company_id,
    v_normal_period_id,
    v_period_start,
    'Helix Test Draft GL Exclusion',
    'manual',
    v_currency,
    'draft',
    v_admin_id
  );


  insert into public.journal_lines (
    company_id,
    journal_entry_id,
    line_number,
    account_id,
    debit,
    credit,
    currency_code,
    exchange_rate,
    created_by
  )
  values
  (
    v_company_id,
    v_draft_journal_id,
    1,
    v_debit_account_id,
    25,
    0,
    v_currency,
    1,
    v_admin_id
  ),
  (
    v_company_id,
    v_draft_journal_id,
    2,
    v_credit_account_id,
    0,
    25,
    v_currency,
    1,
    v_admin_id
  );


  if exists (
    select 1
    from public.general_ledger_view as gl
    where gl.journal_entry_id = v_draft_journal_id
  ) then

    raise exception
      'TEST 20 FAILED: Draft journal appeared in General Ledger.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 21
  -- Soft close accounting period
  -- ==========================================================

  perform public.soft_close_accounting_period(v_normal_period_id);


  if not exists (
    select 1
    from public.accounting_periods as ap
    where ap.id = v_normal_period_id
      and ap.status = 'soft_closed'
      and ap.closed_at is not null
      and ap.closed_by = v_admin_id
      and ap.locked_at is null
      and ap.locked_by is null
  ) then

    raise exception
      'TEST 21 FAILED: Period was not soft closed correctly.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 22
  -- Soft-closed normal period rejects posting
  -- ==========================================================

  insert into public.journal_entries (
    id,
    company_id,
    accounting_period_id,
    entry_date,
    description,
    source_type,
    base_currency_code,
    status,
    created_by
  )
  values (
    v_soft_closed_journal_id,
    v_company_id,
    v_normal_period_id,
    v_period_start,
    'Helix Test Soft Closed Journal',
    'manual',
    v_currency,
    'draft',
    v_admin_id
  );


  insert into public.journal_lines (
    company_id,
    journal_entry_id,
    line_number,
    account_id,
    debit,
    credit,
    currency_code,
    exchange_rate,
    created_by
  )
  values
  (
    v_company_id,
    v_soft_closed_journal_id,
    1,
    v_debit_account_id,
    75,
    0,
    v_currency,
    1,
    v_admin_id
  ),
  (
    v_company_id,
    v_soft_closed_journal_id,
    2,
    v_credit_account_id,
    0,
    75,
    v_currency,
    1,
    v_admin_id
  );


  v_failed := false;

  begin

    perform *
    from public.post_journal_entry(v_soft_closed_journal_id);

  exception
    when others then
      v_failed := true;
  end;


  if not v_failed then

    raise exception
      'TEST 22 FAILED: Soft-closed normal period accepted a posting.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 23
  -- Reopen soft-closed period
  -- ==========================================================

  perform public.reopen_accounting_period(v_normal_period_id);


  if not exists (
    select 1
    from public.accounting_periods as ap
    where ap.id = v_normal_period_id
      and ap.status = 'open'
      and ap.closed_at is null
      and ap.closed_by is null
      and ap.locked_at is null
      and ap.locked_by is null
  ) then

    raise exception
      'TEST 23 FAILED: Soft-closed period was not reopened correctly.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 24
  -- Posting succeeds after reopen
  -- ==========================================================

  select result.entry_number
  into v_entry_number
  from public.post_journal_entry(v_soft_closed_journal_id) as result;


  if v_entry_number is null
     or not exists (
       select 1
       from public.journal_entries as je
       where je.id = v_soft_closed_journal_id
         and je.status = 'posted'
     ) then

    raise exception
      'TEST 24 FAILED: Posting did not succeed after reopening period.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 25
  -- Create draft before locking a second normal period
  -- ==========================================================

  insert into public.accounting_periods (
    id,
    company_id,
    fiscal_year_label,
    period_number,
    name,
    start_date,
    end_date,
    status,
    is_adjustment_period,
    created_by
  )
  values (
    v_locked_period_id,
    v_company_id,
    v_fiscal_label,
    2,
    'Helix Test Lock Period',
    make_date(v_year, 2, 1),
    make_date(v_year, 2, 28),
    'open',
    false,
    v_admin_id
  );


  insert into public.journal_entries (
    id,
    company_id,
    accounting_period_id,
    entry_date,
    description,
    source_type,
    base_currency_code,
    status,
    created_by
  )
  values (
    v_locked_journal_id,
    v_company_id,
    v_locked_period_id,
    make_date(v_year, 2, 1),
    'Helix Test Locked Period Draft',
    'manual',
    v_currency,
    'draft',
    v_admin_id
  );


  insert into public.journal_lines (
    company_id,
    journal_entry_id,
    line_number,
    account_id,
    debit,
    credit,
    currency_code,
    exchange_rate,
    created_by
  )
  values
  (
    v_company_id,
    v_locked_journal_id,
    1,
    v_debit_account_id,
    80,
    0,
    v_currency,
    1,
    v_admin_id
  ),
  (
    v_company_id,
    v_locked_journal_id,
    2,
    v_credit_account_id,
    0,
    80,
    v_currency,
    1,
    v_admin_id
  );


  if not exists (
    select 1
    from public.journal_entries as je
    where je.id = v_locked_journal_id
      and je.status = 'draft'
  ) then

    raise exception
      'TEST 25 FAILED: Draft was not created before period locking.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 26
  -- Lock accounting period
  -- ==========================================================

  perform public.lock_accounting_period(v_locked_period_id);


  if not exists (
    select 1
    from public.accounting_periods as ap
    where ap.id = v_locked_period_id
      and ap.status = 'locked'
      and ap.closed_at is not null
      and ap.closed_by is not null
      and ap.locked_at is not null
      and ap.locked_by = v_admin_id
  ) then

    raise exception
      'TEST 26 FAILED: Period was not locked correctly.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 27
  -- Locked period rejects posting
  -- ==========================================================

  v_failed := false;

  begin

    perform *
    from public.post_journal_entry(v_locked_journal_id);

  exception
    when others then
      v_failed := true;
  end;


  if not v_failed then

    raise exception
      'TEST 27 FAILED: Locked period accepted a posting.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 28
  -- Locked period cannot reopen
  -- ==========================================================

  v_failed := false;

  begin

    perform public.reopen_accounting_period(v_locked_period_id);

  exception
    when others then
      v_failed := true;
  end;


  if not v_failed then

    raise exception
      'TEST 28 FAILED: Locked period was reopened.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 29
  -- Post an original journal for reversal testing
  -- ==========================================================

  insert into public.accounting_periods (
    id,
    company_id,
    fiscal_year_label,
    period_number,
    name,
    start_date,
    end_date,
    status,
    is_adjustment_period,
    created_by
  )
  values (
    v_reversal_period_id,
    v_company_id,
    v_fiscal_label,
    3,
    'Helix Test Reversal Period',
    make_date(v_year, 3, 1),
    make_date(v_year, 3, 31),
    'open',
    false,
    v_admin_id
  );


  insert into public.journal_entries (
    id,
    company_id,
    accounting_period_id,
    entry_date,
    description,
    source_type,
    base_currency_code,
    status,
    created_by
  )
  values (
    v_reversal_original_id,
    v_company_id,
    v_reversal_period_id,
    make_date(v_year, 3, 1),
    'Helix Test Reversal Original',
    'manual',
    v_currency,
    'draft',
    v_admin_id
  );


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
  values
  (
    v_company_id,
    v_reversal_original_id,
    1,
    v_debit_account_id,
    'Reversal original debit',
    250,
    0,
    v_currency,
    1,
    v_admin_id
  ),
  (
    v_company_id,
    v_reversal_original_id,
    2,
    v_credit_account_id,
    'Reversal original credit',
    0,
    250,
    v_currency,
    1,
    v_admin_id
  );


  select result.entry_number
  into v_entry_number
  from public.post_journal_entry(v_reversal_original_id) as result;


  if v_entry_number is null
     or not exists (
       select 1
       from public.journal_entries as je
       where je.id = v_reversal_original_id
         and je.status = 'posted'
     ) then

    raise exception
      'TEST 29 FAILED: Reversal test original did not post.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 30
  -- Controlled reversal journal is created
  -- ==========================================================

  select
    result.reversal_journal_entry_id,
    result.reversal_entry_number

  into
    v_reversal_journal_id,
    v_reversal_entry_number

  from public.reverse_journal_entry(
    v_reversal_original_id,
    make_date(v_year, 3, 2),
    'Stage 2A integrity test'
  ) as result;


  if v_reversal_journal_id is null
     or v_reversal_entry_number is null then

    raise exception
      'TEST 30 FAILED: Reversal journal was not created correctly.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 31
  -- Original/reversal statuses are correct
  -- ==========================================================

  if not exists (
    select 1
    from public.journal_entries as original
    join public.journal_entries as reversal
      on reversal.id = v_reversal_journal_id
    where original.id = v_reversal_original_id
      and original.status = 'reversed'
      and original.reversed_at is not null
      and original.reversed_by = v_admin_id
      and reversal.status = 'posted'
      and reversal.reverses_entry_id = original.id
      and reversal.entry_number = v_reversal_entry_number
  ) then

    raise exception
      'TEST 31 FAILED: Original/reversal journal statuses are incorrect.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 32
  -- Original and reversal both remain in General Ledger
  -- ==========================================================

  select count(distinct gl.journal_entry_id)

  into v_count

  from public.general_ledger_view as gl

  where gl.journal_entry_id in (
    v_reversal_original_id,
    v_reversal_journal_id
  );


  if v_count <> 2 then

    raise exception
      'TEST 32 FAILED: Original and reversal do not both remain in General Ledger.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 33
  -- Reversal nets each affected account to zero
  -- ==========================================================

  select count(*)

  into v_count

  from (
    select
      gl.account_id,

      sum(
        gl.base_debit -
        gl.base_credit
      ) as net_amount

    from public.general_ledger_view as gl

    where gl.journal_entry_id in (
      v_reversal_original_id,
      v_reversal_journal_id
    )

    group by gl.account_id

    having sum(
      gl.base_debit -
      gl.base_credit
    ) <> 0
  ) as non_zero_accounts;


  if v_count <> 0 then

    raise exception
      'TEST 33 FAILED: Reversal does not net affected accounts to zero.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 34
  -- Duplicate reversal is rejected
  -- ==========================================================

  v_failed := false;

  begin

    perform *
    from public.reverse_journal_entry(
      v_reversal_original_id,
      make_date(v_year, 3, 3),
      'Duplicate reversal should fail'
    );

  exception
    when others then
      v_failed := true;
  end;


  if not v_failed then

    raise exception
      'TEST 34 FAILED: Duplicate reversal was accepted.';

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- TEST 35
  -- Entire company General Ledger remains balanced
  -- ==========================================================

  select
    coalesce(sum(gl.base_debit), 0),
    coalesce(sum(gl.base_credit), 0)

  into
    v_debit,
    v_credit

  from public.general_ledger_view as gl

  where gl.company_id = v_company_id;


  if v_debit <> v_credit then

    raise exception
      'TEST 35 FAILED: Company General Ledger is not balanced. Debits %, credits %.',
      v_debit,
      v_credit;

  end if;

  v_test_count := v_test_count + 1;


  -- ==========================================================
  -- FINAL CHECK
  -- ==========================================================

  if v_test_count <> 35 then

    raise exception
      'Stage 2A test runner internal error: expected 35 tests, counted %.',
      v_test_count;

  end if;


  raise notice
    'PASS — Helix Stage 2A Accounting Core passed all 35 integrity tests. All temporary test data will be rolled back.';

end;
$$;

rollback;


select
  'PASS' as status,
  'Helix Stage 2A Accounting Core passed all 35 integrity tests. All temporary test data was rolled back.' as message;
