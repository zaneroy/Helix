"use client";

import {
  ThemePreference,
  useTheme,
} from "@/components/theme/ThemeProvider";

const OPTIONS: {
  value: ThemePreference;
  title: string;
  description: string;
}[] = [
  {
    value: "light",
    title: "Light",
    description: "Use Helix's light appearance.",
  },
  {
    value: "dark",
    title: "Dark",
    description: "Use Helix's midnight appearance.",
  },
  {
    value: "system",
    title: "System",
    description: "Match your device appearance automatically.",
  },
];

export default function ThemeSwitcher() {
  const {
    preference,
    resolvedTheme,
    setPreference,
  } = useTheme();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[color:var(--text-primary)]">
          Appearance
        </h3>

        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
          Choose how Helix looks on this device.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const active = preference === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setPreference(option.value)}
              aria-pressed={active}
              className={`
                rounded-[var(--radius-lg)]
                border
                p-4
                text-left
                transition
                duration-[var(--duration-fast)]
                ${
                  active
                    ? "border-[color:var(--primary)] bg-[color:var(--primary-soft)] shadow-[var(--primary-glow)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)]"
                }
              `}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-[color:var(--text-primary)]">
                  {option.title}
                </span>

                <span
                  className={`
                    h-3
                    w-3
                    rounded-full
                    ${
                      active
                        ? "bg-[color:var(--primary)]"
                        : "bg-[color:var(--border-strong)]"
                    }
                  `}
                />
              </div>

              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                {option.description}
              </p>

              {option.value === "system" && active && (
                <p className="mt-3 text-xs font-medium text-[color:var(--primary)]">
                  Currently using {resolvedTheme}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}