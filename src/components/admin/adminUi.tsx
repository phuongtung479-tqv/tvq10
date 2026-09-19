import { X } from "lucide-react";
import { type ReactNode } from "react";

/** Khung modal chung — full-screen trên mobile, canh giữa trên desktop. */
export function AdminModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`fixed inset-0 z-[95] flex bg-black/60 ${title === "Sửa Giao Diện" ? "justify-end" : "items-end justify-center p-0 sm:items-center sm:p-4"}`}
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col bg-white text-neutral-900 shadow-2xl dark:bg-neutral-900 dark:text-neutral-100 ${title === "Sửa Giao Diện" ? "h-full max-h-full max-w-xl border-l border-neutral-200 dark:border-white/10" : "rounded-t-2xl sm:max-w-2xl sm:rounded-2xl"}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] text-neutral-400">{hint}</span>
      )}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-white/15 dark:bg-neutral-800 dark:focus:border-white/40";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`${inputCls} min-h-[90px] font-mono text-xs`}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="mb-3 flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3 dark:border-white/10">
      <div className={`text-2xl font-black tabular-nums ${tone ?? ""}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-medium text-neutral-500">
        {label}
      </div>
    </div>
  );
}
