"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const currencies = ["AFN", "ALL", "DZD", "AOA", "XCD", "ARS", "AMD", "AWG", "AUD", "AZN",
"BSD", "BHD", "BDT", "BBD", "BYN", "BZD", "XOF", "BMD", "BTN", "BOB",
"BAM", "BWP", "BRL", "BND", "BGN", "BIF", "CVE", "KHR", "XAF", "CAD",
"KYD", "CLP", "CNY", "COP", "KMF", "CDF", "CRC", "HRK", "CUP", "CZK",
"DKK", "DJF", "DOP", "EGP", "SVC", "ERN", "SZL", "ETB", "FJD", "GMD",
"GEL", "GHS", "GIP", "GTQ", "GNF", "GYD", "HTG", "HNL", "HKD", "HUF",
"ISK", "INR", "IDR", "IRR", "IQD", "ILS", "JMD", "JPY", "JOD", "KZT",
"KES", "KWD", "KGS", "LAK", "LBP", "LSL", "LRD", "LYD", "MOP", "MKD",
"MGA", "MWK", "MYR", "MVR", "MRU", "MUR", "MXN", "MDL", "MNT", "MAD",
"MZN", "MMK", "NAD", "NPR", "ANG", "NZD", "NIO", "NGN", "KPW", "NOK",
"OMR", "PKR", "PAB", "PGK", "PYG", "PEN", "PHP", "PLN", "QAR", "RON",
"RUB", "RWF", "SHP", "WST", "STN", "SAR", "RSD", "SCR", "SLL", "SGD",
"SBD", "SOS", "ZAR", "KRW", "SSP", "LKR", "SDG", "SRD", "SEK", "CHF",
"SYP", "TWD", "TJS", "TZS", "THB", "TOP", "TTD", "TND", "TRY", "TMT",
"UGX", "UAH", "AED", "GBP", "USD", "UYU", "UZS", "VUV", "VES", "VND",
"YER", "ZMW", "ZWL"];

export default function CurrencySelector({
  companyId,
  currency,
}: {
  companyId: string;
  currency: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [selected, setSelected] = useState(currency);
  const [saving, setSaving] = useState(false);

  async function updateCurrency(newCurrency: string) {
    setSelected(newCurrency);
    setSaving(true);

    const { error } = await supabase
      .from("companies")
      .update({ currency: newCurrency })
      .eq("id", companyId);

    setSaving(false);

    if (error) {
      alert(`Currency update failed: ${error.message}`);
      setSelected(currency);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={selected}
        onChange={(e) => updateCurrency(e.target.value)}
        className="rounded-[var(--radius-md)] border border-[color:var(--border-brand)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none"
      >
        {currencies.map((item) => (
          <option key={item} value={item} className="bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
            {item}
          </option>
        ))}
      </select>

      {saving && <span className="text-xs text-[color:var(--primary)]">Saving...</span>}
    </div>
  );
}