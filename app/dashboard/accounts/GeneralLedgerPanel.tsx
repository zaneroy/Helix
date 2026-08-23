"use client";

import { useMemo, useState } from "react";

type GeneralLedgerRow = {
  journal_entry_id: string;
  entry_number: number;
  entry_date: string;
  account_code: string;
  account_name: string;
  journal_description: string | null;
  reference: string | null;
  debit: number;
  credit: number;
  currency_code: string | null;
  journal_status: string;
  posted_at: string | null;
};

type Props = {
  rows: GeneralLedgerRow[];
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(
      new Date(`${value}T00:00:00`)
    );
  } catch {
    return value;
  }
}

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function GeneralLedgerPanel({
  rows,
}: Props) {

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [account, setAccount] = useState("all");


  const accounts = useMemo(() => {
    return Array.from(
      new Map(
        rows.map((row) => [
          row.account_code,
          row.account_name,
        ])
      )
    );
  }, [rows]);


  const filteredRows = useMemo(() => {

    return rows.filter((row) => {

      const matchesSearch =
        row.account_code
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        row.account_name
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        row.journal_description
          ?.toLowerCase()
          .includes(search.toLowerCase()) ||
        row.reference
          ?.toLowerCase()
          .includes(search.toLowerCase());


      const matchesStatus =
        status === "all" ||
        row.journal_status === status;


      const matchesAccount =
        account === "all" ||
        row.account_code === account;


      return (
        matchesSearch &&
        matchesStatus &&
        matchesAccount
      );

    });

  }, [
    rows,
    search,
    status,
    account,
  ]);


  const totals = useMemo(() => {

    return filteredRows.reduce(
      (acc, row) => ({
        debit: acc.debit + Number(row.debit || 0),
        credit: acc.credit + Number(row.credit || 0),
      }),
      {
        debit: 0,
        credit: 0,
      }
    );

  }, [filteredRows]);


  return (

<section className="rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">


<div className="border-b border-[color:var(--border)] p-5">

<h2 className="text-[17px] font-semibold text-[color:var(--text-primary)]">
General Ledger
</h2>


<p className="mt-2 text-[12px] text-[color:var(--text-tertiary)]">
Posted journal activity across all accounts.
</p>


<div className="mt-5 flex flex-wrap gap-3">


<input
value={search}
onChange={(e)=>setSearch(e.target.value)}
placeholder="Search ledger..."
className="rounded-xl border px-3 py-2 text-sm"
/>


<select
value={account}
onChange={(e)=>setAccount(e.target.value)}
className="rounded-xl border px-3 py-2 text-sm"
>

<option value="all">
All accounts
</option>

{accounts.map(([code,name])=>(
<option key={code} value={code}>
{code} - {name}
</option>
))}

</select>


<select
value={status}
onChange={(e)=>setStatus(e.target.value)}
className="rounded-xl border px-3 py-2 text-sm"
>

<option value="all">
All status
</option>

<option value="posted">
Posted
</option>

<option value="reversed">
Reversed
</option>

</select>


</div>



<div className="mt-5 grid gap-3 md:grid-cols-3">


<div className="rounded-xl border p-4">
<div className="text-xs text-gray-500">
Total Debits
</div>

<div className="mt-2 font-semibold">
{money(totals.debit)}
</div>

</div>


<div className="rounded-xl border p-4">
<div className="text-xs text-gray-500">
Total Credits
</div>

<div className="mt-2 font-semibold">
{money(totals.credit)}
</div>

</div>


<div className="rounded-xl border p-4">
<div className="text-xs text-gray-500">
Net Movement
</div>

<div className="mt-2 font-semibold">
{money(
totals.debit - totals.credit
)}
</div>

</div>


</div>

</div>


<div className="max-h-[520px] overflow-auto overscroll-contain">

<table className="w-full min-w-[1200px]">

<thead className="sticky top-0 z-10 bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">

<tr>

<th className="px-5 py-4 text-left">
Date
</th>

<th className="px-5 py-4 text-left">
Entry
</th>

<th className="px-5 py-4 text-left">
Account
</th>

<th className="px-5 py-4 text-left">
Description
</th>

<th className="px-5 py-4 text-right">
Debit
</th>

<th className="px-5 py-4 text-right">
Credit
</th>

<th className="px-5 py-4">
Status
</th>

</tr>

</thead>


<tbody>

{filteredRows.map((row)=>(

<tr
key={row.journal_entry_id + row.account_code}
className="border-b"
>

<td className="px-5 py-4">
{formatDate(row.entry_date)}
</td>


<td className="px-5 py-4">
#{row.entry_number}
</td>


<td className="px-5 py-4">

<div>
{row.account_code}
</div>

<div className="text-xs text-gray-500">
{row.account_name}
</div>

</td>


<td className="px-5 py-4">
{row.journal_description || "—"}
</td>


<td className="px-5 py-4 text-right">
{money(row.debit)}
</td>


<td className="px-5 py-4 text-right">
{money(row.credit)}
</td>


<td className="px-5 py-4">
{row.journal_status}
</td>


</tr>

))}


{filteredRows.length === 0 && (

<tr>

<td
colSpan={7}
className="px-5 py-16 text-center"
>

No ledger activity available.

</td>

</tr>

)}

</tbody>


</table>

</div>


</section>

  );
}