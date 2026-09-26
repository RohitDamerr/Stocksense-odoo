export function GlassCard({ className = "", children }) {
  return <div className={`glass p-5 ${className}`}>{children}</div>;
}

const PILL = {
  draft: "bg-slate-400/20 text-slate-700 border-slate-400/40",
  waiting: "bg-amber-400/20 text-amber-700 border-amber-400/50",
  ready: "bg-sky-400/20 text-sky-700 border-sky-400/50",
  done: "bg-emerald-400/20 text-emerald-700 border-emerald-400/50",
  canceled: "bg-rose-400/20 text-rose-700 border-rose-400/50",
};

export function StatusPill({ status }) {
  const cls = PILL[status] || "bg-violet-400/20 text-violet-700 border-violet-400/50";
  return (
    <span className={`inline-block rounded-full border px-3 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

export function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-violet-900/70">
        {label}
      </label>
      {children}
    </div>
  );
}

export function EmptyRow({ colSpan, text }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-violet-900/50">
        {text}
      </td>
    </tr>
  );
}
