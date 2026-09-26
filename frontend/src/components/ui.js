import { CheckCircleIcon } from "./icons";

export function Card({ className = "", children, ...props }) {
  return (
    <div className={`card-base p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

// Keep GlassCard as alias for backwards compatibility
export const GlassCard = Card;

const STATUS_CONFIG = {
  draft: {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
    label: "Draft",
  },
  waiting: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    label: "Waiting",
  },
  ready: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
    label: "Ready",
  },
  done: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    label: "Done",
  },
  canceled: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
    label: "Canceled",
  },
};

export function StatusPill({ status }) {
  const norm = (status || "").toLowerCase();
  const cfg = STATUS_CONFIG[norm] || {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
    label: status || "Unknown",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function Field({ label, hint, error, children, className = "mb-4" }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

export function EmptyRow({ colSpan, text = "No records found" }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center text-sm text-slate-400">
        <div className="flex flex-col items-center justify-center gap-1">
          <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <span className="font-medium">{text}</span>
        </div>
      </td>
    </tr>
  );
}

// Odoo-style visual stage workflow pipeline
export function StagePipeline({ stages = ["draft", "ready", "done"], current = "draft" }) {
  const currentIndex = stages.indexOf(current);

  return (
    <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50/70 p-1 text-xs font-medium">
      {stages.map((st, idx) => {
        const isCurrent = current === st;
        const isPast = currentIndex > idx;
        return (
          <div key={st} className="flex items-center">
            {idx > 0 && <span className="mx-1 text-slate-300">/</span>}
            <span
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 capitalize transition ${
                isCurrent
                  ? "bg-white font-semibold text-indigo-700 shadow-xs ring-1 ring-slate-200"
                  : isPast
                  ? "text-slate-600"
                  : "text-slate-400"
              }`}
            >
              {isPast && <CheckCircleIcon className="h-3 w-3 text-emerald-600" />}
              {st}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Executive KPI Metric Card
export function StatCard({ title, value, icon: Icon, badge, color = "indigo" }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    blue: "bg-blue-50 text-blue-600",
  };

  return (
    <div className="card-base card-hover p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
        {Icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors[color] || colors.indigo}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{value ?? "–"}</span>
        {badge && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
