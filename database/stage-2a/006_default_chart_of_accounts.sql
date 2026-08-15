-- ============================================================
-- HELIX STAGE 2A
-- 006 - DEFAULT CHART OF ACCOUNTS
--
-- Canonical production Chart of Accounts template and
-- idempotent company seeding function.
--
-- This file was reconstructed from the exact function
-- definitions already installed and validated in Supabase.
-- ============================================================

begin;


-- ============================================================
-- 1. CANONICAL 66-ACCOUNT HELIX TEMPLATE
-- ============================================================

CREATE OR REPLACE FUNCTION public.helix_default_chart_of_accounts_template()
 RETURNS TABLE(code text, account_name text, account_type text, account_subtype text, normal_balance text, system_key text, description text, is_contra boolean, allow_manual_posting boolean, sort_order integer)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$

values

-- ============================================================
-- ASSETS
-- ============================================================

(
  '1000',
  'Cash and Cash Equivalents',
  'asset',
  'cash',
  'debit',
  'cash_and_cash_equivalents',
  'Primary General Ledger account for cash and bank balances.',
  false,
  true,
  1000
),

(
  '1010',
  'Undeposited Funds',
  'asset',
  'undeposited_funds',
  'debit',
  'undeposited_funds',
  'Payments received but not yet deposited into a bank account.',
  false,
  true,
  1010
),

(
  '1050',
  'Bank Clearing',
  'asset',
  'clearing',
  'debit',
  'bank_clearing',
  'Temporary clearing account used during banking and reconciliation workflows.',
  false,
  true,
  1050
),

(
  '1100',
  'Accounts Receivable',
  'asset',
  'accounts_receivable',
  'debit',
  'accounts_receivable',
  'Amounts owed by customers for invoices and credit sales.',
  false,
  false,
  1100
),

(
  '1110',
  'Allowance for Doubtful Accounts',
  'asset',
  'contra_receivable',
  'credit',
  'allowance_doubtful_accounts',
  'Contra-asset allowance for expected uncollectible receivables.',
  true,
  true,
  1110
),

(
  '1200',
  'Inventory',
  'asset',
  'inventory',
  'debit',
  'inventory_asset',
  'Cost value of inventory currently owned by the business.',
  false,
  false,
  1200
),

(
  '1210',
  'Inventory in Transit',
  'asset',
  'inventory_in_transit',
  'debit',
  'inventory_in_transit',
  'Inventory purchased but not yet received into stock.',
  false,
  true,
  1210
),

(
  '1300',
  'Sales Tax Recoverable',
  'asset',
  'tax_recoverable',
  'debit',
  'sales_tax_recoverable',
  'Recoverable GST, HST, VAT or other input sales taxes.',
  false,
  false,
  1300
),

(
  '1310',
  'Prepaid Expenses',
  'asset',
  'prepaid_expenses',
  'debit',
  'prepaid_expenses',
  'Payments made in advance for future expenses.',
  false,
  true,
  1310
),

(
  '1320',
  'Supplier Deposits',
  'asset',
  'supplier_deposits',
  'debit',
  'supplier_deposits',
  'Deposits and advances paid to suppliers.',
  false,
  true,
  1320
),

(
  '1390',
  'Other Current Assets',
  'asset',
  'other_current_assets',
  'debit',
  'other_current_assets',
  'Other short-term assets not classified elsewhere.',
  false,
  true,
  1390
),

(
  '1500',
  'Property, Plant and Equipment',
  'asset',
  'fixed_assets',
  'debit',
  'property_plant_equipment',
  'Capitalized tangible fixed assets.',
  false,
  true,
  1500
),

(
  '1510',
  'Accumulated Depreciation',
  'asset',
  'accumulated_depreciation',
  'credit',
  'accumulated_depreciation',
  'Accumulated depreciation recorded against fixed assets.',
  true,
  true,
  1510
),

(
  '1600',
  'Intangible Assets',
  'asset',
  'intangible_assets',
  'debit',
  'intangible_assets',
  'Capitalized intangible assets.',
  false,
  true,
  1600
),

(
  '1610',
  'Accumulated Amortization',
  'asset',
  'accumulated_amortization',
  'credit',
  'accumulated_amortization',
  'Accumulated amortization recorded against intangible assets.',
  true,
  true,
  1610
),

(
  '1700',
  'Long-Term Investments',
  'asset',
  'long_term_investments',
  'debit',
  'long_term_investments',
  'Long-term investments and financial assets.',
  false,
  true,
  1700
),


-- ============================================================
-- LIABILITIES
-- ============================================================

(
  '2000',
  'Accounts Payable',
  'liability',
  'accounts_payable',
  'credit',
  'accounts_payable',
  'Amounts owed to suppliers and vendors.',
  false,
  false,
  2000
),

(
  '2100',
  'Sales Tax Payable',
  'liability',
  'tax_payable',
  'credit',
  'sales_tax_payable',
  'GST, HST, VAT and other sales taxes collected and payable.',
  false,
  false,
  2100
),

(
  '2110',
  'Accrued Expenses',
  'liability',
  'accrued_expenses',
  'credit',
  'accrued_expenses',
  'Expenses incurred but not yet paid or invoiced.',
  false,
  true,
  2110
),

(
  '2120',
  'Customer Deposits and Deferred Revenue',
  'liability',
  'deferred_revenue',
  'credit',
  'deferred_revenue',
  'Customer funds received before revenue has been earned.',
  false,
  false,
  2120
),

(
  '2200',
  'Credit Cards Payable',
  'liability',
  'credit_card',
  'credit',
  'credit_card_payable',
  'Outstanding balances owed on business credit cards.',
  false,
  true,
  2200
),

(
  '2300',
  'Short-Term Loans',
  'liability',
  'short_term_debt',
  'credit',
  'short_term_loans',
  'Loans and debt obligations due within twelve months.',
  false,
  true,
  2300
),

(
  '2400',
  'Long-Term Debt',
  'liability',
  'long_term_debt',
  'credit',
  'long_term_debt',
  'Loans and debt obligations due beyond twelve months.',
  false,
  true,
  2400
),

(
  '2500',
  'Shareholder Loans Payable',
  'liability',
  'shareholder_loans',
  'credit',
  'shareholder_loans_payable',
  'Amounts loaned to the company by shareholders or owners.',
  false,
  true,
  2500
),

(
  '2600',
  'Other Liabilities',
  'liability',
  'other_liabilities',
  'credit',
  'other_liabilities',
  'Other liabilities not classified elsewhere.',
  false,
  true,
  2600
),


-- ============================================================
-- EQUITY
-- ============================================================

(
  '3000',
  'Share Capital',
  'equity',
  'share_capital',
  'credit',
  'share_capital',
  'Issued share capital of the company.',
  false,
  false,
  3000
),

(
  '3010',
  'Additional Paid-In Capital',
  'equity',
  'additional_paid_in_capital',
  'credit',
  'additional_paid_in_capital',
  'Capital contributed above the stated or par value of shares.',
  false,
  false,
  3010
),

(
  '3100',
  'Retained Earnings',
  'equity',
  'retained_earnings',
  'credit',
  'retained_earnings',
  'Accumulated historical profits retained by the business.',
  false,
  false,
  3100
),

(
  '3200',
  'Opening Balance Equity',
  'equity',
  'opening_balance',
  'credit',
  'opening_balance_equity',
  'Temporary equity account used during initial accounting setup.',
  false,
  false,
  3200
),

(
  '3300',
  'Dividends and Owner Distributions',
  'equity',
  'owner_distributions',
  'debit',
  'owner_distributions',
  'Dividends or distributions made to owners and shareholders.',
  true,
  true,
  3300
),

(
  '3400',
  'Treasury Shares',
  'equity',
  'treasury_shares',
  'debit',
  'treasury_shares',
  'Contra-equity account for shares repurchased by the company.',
  true,
  false,
  3400
),


-- ============================================================
-- REVENUE
-- ============================================================

(
  '4000',
  'Product Sales',
  'revenue',
  'sales',
  'credit',
  'sales_revenue',
  'Revenue earned from product sales.',
  false,
  true,
  4000
),

(
  '4010',
  'Service Revenue',
  'revenue',
  'services',
  'credit',
  'service_revenue',
  'Revenue earned from services.',
  false,
  true,
  4010
),

(
  '4020',
  'Shipping Income',
  'revenue',
  'shipping_income',
  'credit',
  'shipping_income',
  'Shipping and delivery amounts charged to customers.',
  false,
  true,
  4020
),

(
  '4100',
  'Sales Returns and Allowances',
  'revenue',
  'sales_returns',
  'debit',
  'sales_returns_allowances',
  'Contra-revenue account for customer returns and allowances.',
  true,
  true,
  4100
),

(
  '4110',
  'Sales Discounts',
  'revenue',
  'sales_discounts',
  'debit',
  'sales_discounts',
  'Contra-revenue account for discounts reducing sales revenue.',
  true,
  true,
  4110
),

(
  '4200',
  'Other Operating Revenue',
  'revenue',
  'other_operating_revenue',
  'credit',
  'other_operating_revenue',
  'Other revenue generated from normal business operations.',
  false,
  true,
  4200
),

(
  '4300',
  'Interest Income',
  'revenue',
  'interest_income',
  'credit',
  'interest_income',
  'Interest earned on cash, deposits and investments.',
  false,
  true,
  4300
),

(
  '4400',
  'Other Income',
  'revenue',
  'other_income',
  'credit',
  'other_income',
  'Non-operating income not classified elsewhere.',
  false,
  true,
  4400
),

(
  '4410',
  'Gain on Asset Disposal',
  'revenue',
  'asset_disposal_gain',
  'credit',
  'gain_on_asset_disposal',
  'Gain recognized when fixed assets are sold or disposed.',
  false,
  true,
  4410
),

(
  '4420',
  'Foreign Exchange Gain',
  'revenue',
  'foreign_exchange_gain',
  'credit',
  'foreign_exchange_gain',
  'Realized or recognized gains arising from foreign exchange movements.',
  false,
  true,
  4420
),


-- ============================================================
-- COST OF SALES
-- ============================================================

(
  '5000',
  'Cost of Goods Sold',
  'cost_of_sales',
  'cost_of_goods_sold',
  'debit',
  'cost_of_goods_sold',
  'Direct inventory cost associated with products sold.',
  false,
  false,
  5000
),

(
  '5010',
  'Freight and Duties - Inventory',
  'cost_of_sales',
  'inventory_freight',
  'debit',
  'inventory_freight_in',
  'Inbound freight, customs and landed costs associated with inventory.',
  false,
  true,
  5010
),

(
  '5020',
  'Inventory Adjustments and Write-Offs',
  'cost_of_sales',
  'inventory_adjustments',
  'debit',
  'inventory_adjustments',
  'Inventory shrinkage, damage, write-offs and cost adjustments.',
  false,
  true,
  5020
),

(
  '5030',
  'Direct Labour',
  'cost_of_sales',
  'direct_labour',
  'debit',
  'direct_labour_cogs',
  'Direct labour attributable to production or delivery of goods.',
  false,
  true,
  5030
),


-- ============================================================
-- OPERATING EXPENSES
-- ============================================================

(
  '6000',
  'Advertising and Marketing',
  'expense',
  'marketing',
  'debit',
  'advertising_expense',
  'Advertising, promotion, marketing and customer acquisition costs.',
  false,
  true,
  6000
),

(
  '6010',
  'Merchant Processing Fees',
  'expense',
  'merchant_fees',
  'debit',
  'merchant_fees',
  'Payment processor and merchant transaction fees.',
  false,
  true,
  6010
),

(
  '6020',
  'Bank Fees',
  'expense',
  'bank_fees',
  'debit',
  'bank_fees',
  'Bank service charges and transaction fees.',
  false,
  true,
  6020
),

(
  '6030',
  'Depreciation Expense',
  'expense',
  'depreciation',
  'debit',
  'depreciation_expense',
  'Periodic depreciation expense for tangible fixed assets.',
  false,
  true,
  6030
),

(
  '6040',
  'Amortization Expense',
  'expense',
  'amortization',
  'debit',
  'amortization_expense',
  'Periodic amortization expense for intangible assets.',
  false,
  true,
  6040
),

(
  '6050',
  'Insurance',
  'expense',
  'insurance',
  'debit',
  'insurance_expense',
  'Business insurance expense.',
  false,
  true,
  6050
),

(
  '6060',
  'Interest Expense',
  'expense',
  'interest',
  'debit',
  'interest_expense',
  'Interest incurred on loans, credit and other debt.',
  false,
  true,
  6060
),

(
  '6070',
  'Legal and Professional Fees',
  'expense',
  'professional_fees',
  'debit',
  'professional_fees',
  'Legal, accounting, consulting and other professional services.',
  false,
  true,
  6070
),

(
  '6080',
  'Office and Administrative Expense',
  'expense',
  'office',
  'debit',
  'office_expense',
  'General office and administrative costs.',
  false,
  true,
  6080
),

(
  '6090',
  'Payroll and Wages',
  'expense',
  'wages',
  'debit',
  'wages_expense',
  'Employee wages, salaries and related labour expense.',
  false,
  true,
  6090
),

(
  '6100',
  'Rent and Occupancy',
  'expense',
  'rent',
  'debit',
  'rent_expense',
  'Rent, lease and occupancy costs.',
  false,
  true,
  6100
),

(
  '6110',
  'Repairs and Maintenance',
  'expense',
  'repairs_maintenance',
  'debit',
  'repairs_maintenance_expense',
  'Repairs and routine maintenance expense.',
  false,
  true,
  6110
),

(
  '6120',
  'Software and Subscriptions',
  'expense',
  'software',
  'debit',
  'software_subscriptions_expense',
  'Software, SaaS and recurring technology subscriptions.',
  false,
  true,
  6120
),

(
  '6130',
  'Utilities',
  'expense',
  'utilities',
  'debit',
  'utilities_expense',
  'Electricity, gas, water, internet and similar utility costs.',
  false,
  true,
  6130
),

(
  '6140',
  'Travel and Meals',
  'expense',
  'travel_meals',
  'debit',
  'travel_meals_expense',
  'Business travel, accommodation and meal expenses.',
  false,
  true,
  6140
),

(
  '6150',
  'Shipping and Delivery Expense',
  'expense',
  'shipping_delivery',
  'debit',
  'shipping_delivery_expense',
  'Outbound shipping, courier and customer delivery expenses.',
  false,
  true,
  6150
),

(
  '6160',
  'Bad Debt Expense',
  'expense',
  'bad_debt',
  'debit',
  'bad_debt_expense',
  'Receivable balances recognized as uncollectible.',
  false,
  true,
  6160
),

(
  '6170',
  'Taxes and Licences',
  'expense',
  'taxes_licenses',
  'debit',
  'taxes_licenses_expense',
  'Business taxes, permits and licence expenses excluding income tax.',
  false,
  true,
  6170
),

(
  '6180',
  'Miscellaneous Expense',
  'expense',
  'miscellaneous',
  'debit',
  'miscellaneous_expense',
  'Other ordinary expenses not classified elsewhere.',
  false,
  true,
  6180
),

(
  '6190',
  'Loss on Asset Disposal',
  'expense',
  'asset_disposal_loss',
  'debit',
  'loss_on_asset_disposal',
  'Loss recognized when fixed assets are sold or disposed.',
  false,
  true,
  6190
),

(
  '6200',
  'Foreign Exchange Loss',
  'expense',
  'foreign_exchange_loss',
  'debit',
  'foreign_exchange_loss',
  'Realized or recognized losses arising from foreign exchange movements.',
  false,
  true,
  6200
);

$function$


-- ============================================================
-- 2. IDEMPOTENT COMPANY SEEDER
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_default_chart_of_accounts(p_company_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_currency text;

  v_before_count integer;
  v_after_count integer;

  v_missing_keys text;
begin

  v_user_id := auth.uid();


  -- ----------------------------------------------------------
  -- COMPANY VALIDATION
  -- ----------------------------------------------------------

  select upper(coalesce(c.currency, 'USD'))
  into v_currency
  from public.companies as c
  where c.id = p_company_id;


  if v_currency is null then
    raise exception
      'Company does not exist.';
  end if;


  -- ----------------------------------------------------------
  -- APPLICATION AUTHORIZATION
  --
  -- When called by Helix, only an Admin belonging to the
  -- company can seed its Chart of Accounts.
  --
  -- auth.uid() is NULL when run directly by the Supabase SQL
  -- Editor, allowing controlled installation by the DB owner.
  -- ----------------------------------------------------------

  if v_user_id is not null then

    if not exists (
      select 1
      from public.profiles as p
      where p.id = v_user_id
        and p.role = 'admin'::user_role
        and p.company_id = p_company_id
    ) then

      raise exception
        'You are not authorised to initialize the Chart of Accounts for this company.';

    end if;

  end if;


  -- ----------------------------------------------------------
  -- COUNT EXISTING HELIX SYSTEM ACCOUNTS
  -- ----------------------------------------------------------

  select count(*)
  into v_before_count
  from public.accounting_accounts as aa
  where aa.company_id = p_company_id
    and aa.system_key in (
      select t.system_key
      from public.helix_default_chart_of_accounts_template() as t
    );


  -- ----------------------------------------------------------
  -- INSERT MISSING ACCOUNTS
  --
  -- We never overwrite an existing system account.
  --
  -- If a business has later customized the account code/name,
  -- system_key remains the permanent Helix identifier.
  -- ----------------------------------------------------------

  insert into public.accounting_accounts (
    company_id,
    code,
    name,
    account_type,
    account_subtype,
    normal_balance,
    system_key,
    description,
    currency_code,
    is_system,
    is_contra,
    allow_manual_posting,
    status,
    sort_order,
    created_by
  )

  select
    p_company_id,
    t.code,
    t.account_name,
    t.account_type,
    t.account_subtype,
    t.normal_balance,
    t.system_key,
    t.description,
    v_currency,
    true,
    t.is_contra,
    t.allow_manual_posting,
    'active',
    t.sort_order,
    v_user_id

  from public.helix_default_chart_of_accounts_template() as t

  where not exists (
    select 1
    from public.accounting_accounts as existing
    where existing.company_id = p_company_id
      and existing.system_key = t.system_key
  )

  and not exists (
    select 1
    from public.accounting_accounts as existing
    where existing.company_id = p_company_id
      and existing.code = t.code
  );


  -- ----------------------------------------------------------
  -- VERIFY EVERY REQUIRED SYSTEM KEY EXISTS
  --
  -- This detects a situation such as:
  --
  -- code 1100 already exists
  -- but belongs to an unrelated custom account.
  --
  -- We do NOT silently replace user data.
  -- ----------------------------------------------------------

  select string_agg(
    t.system_key,
    ', '
    order by t.code
  )
  into v_missing_keys

  from public.helix_default_chart_of_accounts_template() as t

  where not exists (
    select 1
    from public.accounting_accounts as aa
    where aa.company_id = p_company_id
      and aa.system_key = t.system_key
  );


  if v_missing_keys is not null then

    raise exception
      'Default Chart of Accounts could not be completed because existing account codes conflict with required Helix system accounts. Missing system keys: %',
      v_missing_keys;

  end if;


  -- ----------------------------------------------------------
  -- FINAL COUNT
  -- ----------------------------------------------------------

  select count(*)
  into v_after_count
  from public.accounting_accounts as aa
  where aa.company_id = p_company_id
    and aa.system_key in (
      select t.system_key
      from public.helix_default_chart_of_accounts_template() as t
    );


  return v_after_count - v_before_count;

end;
$function$


-- ============================================================
-- 3. FUNCTION SECURITY
-- ============================================================

revoke all
on function public.seed_default_chart_of_accounts(uuid)
from public;

revoke all
on function public.seed_default_chart_of_accounts(uuid)
from anon;

grant execute
on function public.seed_default_chart_of_accounts(uuid)
to authenticated;


-- The template contains only Helix's standard account metadata.
-- Authenticated users may execute it; anonymous access is not
-- required by the application.

revoke all
on function public.helix_default_chart_of_accounts_template()
from anon;

grant execute
on function public.helix_default_chart_of_accounts_template()
to authenticated;


-- ============================================================
-- 4. SEED ALL EXISTING COMPANIES
--
-- When this migration is run by the database owner through the
-- Supabase SQL Editor, auth.uid() is NULL. The seeding function
-- intentionally permits that controlled installation context.
--
-- Existing accounts are never overwritten. The seeder inserts
-- only missing system keys and raises on conflicting required
-- account codes rather than replacing user data.
-- ============================================================

do $$
declare
  v_company_id uuid;
begin

  for v_company_id in
    select c.id
    from public.companies as c
    order by c.id
  loop

    perform public.seed_default_chart_of_accounts(v_company_id);

  end loop;

end;
$$;


-- ============================================================
-- 5. DOCUMENTATION
-- ============================================================

comment on function public.helix_default_chart_of_accounts_template() is
  'Canonical Helix 66-account production Chart of Accounts template used to initialize company General Ledgers.';

comment on function public.seed_default_chart_of_accounts(uuid) is
  'Idempotently installs missing Helix system Chart of Accounts records for a company without overwriting existing system accounts or conflicting custom account codes.';


commit;


-- ============================================================
-- END
-- ============================================================
