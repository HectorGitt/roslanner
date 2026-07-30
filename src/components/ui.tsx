import Link from "next/link";
import React from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------- Buttons --------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 " +
  "disabled:pointer-events-none disabled:opacity-50";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    // emerald-700 keeps white label text at AA contrast; 600 falls just short.
    "bg-emerald-700 text-white shadow-sm shadow-emerald-700/20 hover:bg-emerald-600 active:bg-emerald-800",
  secondary:
    "border border-zinc-300 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 " +
    "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 " +
    "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
  danger:
    "bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-500 active:bg-rose-700",
  success:
    "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-500 active:bg-emerald-700",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "rounded-lg px-3 py-1.5 text-xs",
  md: "rounded-xl px-5 py-2.5 text-sm",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size]);
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(buttonClass(variant, size), className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <Link className={cn(buttonClass(variant, size), className)} {...rest} />;
}

/** Low-emphasis inline text action (delete/enable links in list rows). */
export function TextButton({
  tone = "neutral",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "neutral" | "danger" }) {
  return (
    <button
      className={cn(
        // Padding + negative margin enlarges the hit area without shifting layout.
        "-m-1.5 rounded-lg p-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
        tone === "danger"
          ? "text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400"
          : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
        className,
      )}
      {...rest}
    />
  );
}

/* ---------------------------------- Forms ----------------------------------- */

export const inputClass =
  "rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm " +
  "outline-none transition placeholder:text-zinc-400 " +
  "hover:border-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500 dark:hover:border-zinc-600 " +
  "[color-scheme:light] dark:[color-scheme:dark]";

export const inputSmClass = inputClass.replace("rounded-xl", "rounded-lg").replace("px-3 py-2", "px-2 py-1.5");

export function Input({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...rest} />;
}

export function Select({
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, "select-chevron pr-9", className)} {...rest} />;
}

export function Checkbox({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
        className,
      )}
      {...rest}
    />
  );
}

/** Labelled form field: <Field label="Date"><Input … /></Field> */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1.5 block font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
      )}
    </label>
  );
}

/* ------------------------------- Surfaces ----------------------------------- */

export function Card({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
      {...rest}
    />
  );
}

/** Card that stacks rows separated by hairlines (lists, tables of rows). */
export function ListCard({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Card
      className={cn("divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800/50", className)}
      {...rest}
    />
  );
}

/** Header-cell style shared by every data table (matrix editors, lists). */
export const thClass =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";

/** Header-row style for data tables. */
export const theadRowClass =
  "border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/40";

/** Big-number tile for dashboards: muted label, tabular-nums value, text tokens. */
export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        <p className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-white">
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
      </div>
      {icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
          {icon}
        </div>
      )}
    </Card>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="mb-1 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 print:hidden"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {backLabel ?? "Back"}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{title}</h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------ Feedback ------------------------------------ */

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  brand: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
};

export function Badge({
  tone = "neutral",
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        BADGE_TONE[tone],
        className,
      )}
      {...rest}
    />
  );
}

export function Alert({
  tone,
  children,
  className,
}: {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    error:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    info:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-2.5 text-sm", styles, className)}>
      {children}
    </p>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className ?? "h-5 w-5")} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex items-center gap-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Spinner className="h-5 w-5" />
        {label}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-dashed border-zinc-200 bg-white/50 p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50",
        className,
      )}
    >
      {icon && (
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
          {icon}
        </div>
      )}
      <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mx-auto mb-6 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      )}
      {action}
    </div>
  );
}

/** Placeholder row for an empty list rendered inside a ListCard. */
export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">{children}</p>;
}
