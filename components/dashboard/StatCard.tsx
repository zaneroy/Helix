import Link from "next/link";

type StatCardProps = {
  label: string;
  value: string | number;
  note: string;
  href?: string;
  danger?: boolean;
};

export default function StatCard({
  label,
  value,
  note,
  href,
  danger,
}: StatCardProps) {
  const card = (
    <div className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition hover:border-[color:var(--border-brand)] hover:bg-[color:var(--surface)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--text-secondary)]">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
        {value}
      </p>

      <p className={`mt-2 text-xs ${danger ? "text-[color:var(--danger)]" : "text-[color:var(--primary)]"}`}>
        {note}
      </p>
    </div>
  );

  if (!href) return card;

  return <Link href={href}>{card}</Link>;
}