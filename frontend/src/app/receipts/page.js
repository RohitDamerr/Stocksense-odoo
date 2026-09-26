"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { GlassCard, StatusPill, EmptyRow } from "@/components/ui";
import { api } from "@/lib/api";

const STATUSES = ["", "draft", "waiting", "ready", "done", "canceled"];

export default function ReceiptsPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState("list");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const qs = status ? `?status=${status}&limit=100` : "?limit=100";
        const res = await api.receipts(qs);
        setRows(res?.receipts || []);
      } catch (err) {
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      }
    })();
  }, [status, router]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      (r.receiptNumber || "").toLowerCase().includes(needle) ||
      (r.supplier?.name || "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const byStatus = useMemo(() => {
    const g = {};
    for (const r of filtered) (g[r.status] = g[r.status] || []).push(r);
    return g;
  }, [filtered]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="grad-text text-3xl font-extrabold">📥 Receipts</h1>
          <button onClick={() => router.push("/receipts/new")} className="btn-gradient text-sm">+ NEW</button>
        </div>
        <p className="mb-4 text-sm text-violet-900/60">By default land on List View</p>
        <GlassCard className="mb-4 flex flex-wrap gap-2 !p-4">
          <input
            placeholder="🔍 Search by reference & contacts"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="glass-input !w-64"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="glass-input !w-auto">
            {STATUSES.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
          </select>
          <button onClick={() => setView(view === "list" ? "kanban" : "list")} className="btn-glass text-sm">
            {view === "list" ? "🗂 Kanban view" : "📋 List view"}
          </button>
        </GlassCard>
        {error && (
          <p className="mb-4 rounded-xl border border-rose-300/60 bg-rose-100/60 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
        {view === "list" ? (
          <GlassCard className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/60 bg-white/40 text-left text-xs uppercase tracking-wide text-violet-900/60">
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Schedule date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r._id} className="cursor-pointer border-b border-white/40 last:border-0 hover:bg-white/50" onClick={() => router.push(`/receipts/${r._id}`)}>
                    <td className="px-4 py-2.5 font-mono font-semibold text-violet-700">{r.receiptNumber}</td>
                    <td className="px-4 py-2.5">{r.supplier?.name || "—"}</td>
                    <td className="px-4 py-2.5">{r.scheduledDate ? new Date(r.scheduledDate).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-2.5"><StatusPill status={r.status} /></td>
                  </tr>
                ))}
                {!filtered.length && <EmptyRow colSpan={4} text="No receipts" />}
              </tbody>
            </table>
          </GlassCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {Object.entries(byStatus).map(([s, list]) => (
              <GlassCard key={s}>
                <p className="mb-2 font-bold"><StatusPill status={s} /> <span className="text-violet-900/60">({list.length})</span></p>
                {list.map((r) => (
                  <div key={r._id} onClick={() => router.push(`/receipts/${r._id}`)} className="mb-2 cursor-pointer rounded-xl border border-white/60 bg-white/50 px-3 py-2 text-sm hover:bg-white/80">
                    <p className="font-mono font-semibold text-violet-700">{r.receiptNumber}</p>
                    <p className="text-violet-900/60">{r.supplier?.name}</p>
                  </div>
                ))}
              </GlassCard>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
