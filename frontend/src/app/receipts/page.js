"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Card, StatusPill, EmptyRow } from "@/components/ui";
import { api } from "@/lib/api";
import {
  SearchIcon,
  PlusIcon,
  ListIcon,
  KanbanIcon,
  ArrowDownLeftIcon,
  AlertTriangleIcon,
  ClockIcon,
} from "@/components/icons";

const STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "waiting", label: "Waiting" },
  { value: "ready", label: "Ready" },
  { value: "done", label: "Done" },
  { value: "canceled", label: "Canceled" },
];

export default function ReceiptsPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(true);
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
      } finally {
        setLoading(false);
      }
    })();
  }, [status, router]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        (r.receiptNumber || "").toLowerCase().includes(needle) ||
        (r.supplier?.name || "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const byStatus = useMemo(() => {
    const g = { draft: [], waiting: [], ready: [], done: [], canceled: [] };
    for (const r of filtered) {
      if (!g[r.status]) g[r.status] = [];
      g[r.status].push(r);
    }
    return g;
  }, [filtered]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <ArrowDownLeftIcon className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Incoming Receipts</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">Manage vendor incoming shipments, draft bills, and warehouse stock-ins.</p>
          </div>
          <Link href="/receipts/new" className="btn-primary">
            <PlusIcon className="h-4 w-4" />
            <span>New Receipt</span>
          </Link>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertTriangleIcon className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter and View Bar */}
        <Card className="mb-6 !p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  placeholder="Search reference or supplier…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="form-input !pl-9 text-xs sm:text-sm"
                />
              </div>

              {/* Status filter tabs */}
              <div className="flex flex-wrap items-center rounded-lg bg-slate-100 p-0.5">
                {STATUSES.map((s) => {
                  const active = status === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => setStatus(s.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                        active
                          ? "bg-white text-slate-900 shadow-xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* View Switcher */}
            <div className="flex items-center self-end sm:self-auto rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button
                onClick={() => setView("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  view === "list" ? "bg-slate-100 text-slate-900 font-semibold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <ListIcon className="h-3.5 w-3.5" />
                <span>List</span>
              </button>
              <button
                onClick={() => setView("kanban")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  view === "kanban" ? "bg-slate-100 text-slate-900 font-semibold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <KanbanIcon className="h-3.5 w-3.5" />
                <span>Kanban</span>
              </button>
            </div>
          </div>
        </Card>

        {/* Content Views */}
        {view === "list" ? (
          <Card className="!p-0 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5">Reference</th>
                    <th className="px-6 py-3.5">Supplier / Contact</th>
                    <th className="px-6 py-3.5">Scheduled Date</th>
                    <th className="px-6 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((r) => (
                    <tr
                      key={r._id}
                      onClick={() => router.push(`/receipts/${r._id}`)}
                      className="cursor-pointer hover:bg-indigo-50/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono font-semibold text-indigo-600 hover:underline">
                        {r.receiptNumber}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {r.supplier?.name || "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {r.scheduledDate ? new Date(r.scheduledDate).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <StatusPill status={r.status} />
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && !loading && <EmptyRow colSpan={4} text="No receipts found" />}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          /* Kanban Board */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {["draft", "waiting", "ready", "done", "canceled"].map((st) => {
              const list = byStatus[st] || [];
              return (
                <div key={st} className="flex flex-col rounded-xl bg-slate-100/70 p-3 border border-slate-200">
                  <div className="mb-3 flex items-center justify-between">
                    <StatusPill status={st} />
                    <span className="text-xs font-semibold text-slate-500">{list.length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {list.map((r) => (
                      <div
                        key={r._id}
                        onClick={() => router.push(`/receipts/${r._id}`)}
                        className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition"
                      >
                        <p className="font-mono text-xs font-bold text-indigo-600">{r.receiptNumber}</p>
                        <p className="mt-1 text-xs font-medium text-slate-800 line-clamp-1">{r.supplier?.name || "No supplier"}</p>
                        {r.scheduledDate && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                            <ClockIcon className="h-3 w-3" />
                            <span>{new Date(r.scheduledDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {!list.length && (
                      <div className="py-6 text-center text-xs text-slate-400">No {st} receipts</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
