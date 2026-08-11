type LogoProps = {
  showWordmark?: boolean;
  className?: string;
};

export default function Logo({
  showWordmark = true,
  className = "",
}: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--primary-soft)] shadow-[var(--shadow-xs)]"
        aria-hidden="true"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 5L18 18H6L12 5Z"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {showWordmark && (
        <span className="text-xl font-bold tracking-[-0.03em] text-[color:var(--text-primary)]">
          Helix
        </span>
      )}
    </div>
  );
}
