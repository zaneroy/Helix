"use client";

import ThemeSwitcher from "@/components/theme/ThemeSwitcher";

type ProfileAppearanceCardProps = {
  portal: "Investor" | "Employee";
};

export default function ProfileAppearanceCard({
  portal,
}: ProfileAppearanceCardProps) {
  return (
    <section
      className="
        rounded-[24px]
        border
        border-[color:var(--border)]
        bg-[color:var(--surface-soft)]
        p-5
        shadow-[var(--shadow-card)]
        sm:p-6
      "
    >
      <div className="mb-5">
        <p
          className="
            text-[11px]
            font-medium
            uppercase
            tracking-[0.2em]
            text-[color:var(--primary)]
          "
        >
          Appearance
        </p>

        <h2
          className="
            mt-2
            text-xl
            font-semibold
            tracking-[-0.025em]
            text-[color:var(--text-primary)]
          "
        >
          Choose how Helix looks
        </h2>

        <p
          className="
            mt-2
            max-w-2xl
            text-sm
            leading-6
            text-[color:var(--text-tertiary)]
          "
        >
          Choose the appearance for your {portal.toLowerCase()} portal.
          Light is the default, Dark uses the Helix midnight theme, and
          System follows your device appearance automatically.
        </p>
      </div>

      <ThemeSwitcher />
    </section>
  );
}