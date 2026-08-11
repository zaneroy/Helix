type PanelProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function Panel({ title, subtitle, children }: PanelProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-primary)]">
          {title}
        </p>

        {subtitle && <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{subtitle}</p>}
      </div>

      {children}
    </div>
  );
}