"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Card, EmptyRow } from "@/components/ui";
import { api } from "@/lib/api";
import { SearchIcon, LayersIcon, AlertTriangleIcon, PlusIcon } from "@/components/icons";

export default function StockPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.products("?limit=100");
        setRows(res?.products || []);
      } catch (err) {
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function search(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.products(`?limit=100${q.trim() ? `&search=${encodeURIComponent(q.trim())}` : ""}`);
      setRows(res?.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    setQ("");
    setLoading(true);
    api.products("?limit=100")
      .then((res) => setRows(res?.products || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Stock Inventory</h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                {rows.length} products
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Real-time inventory quantities on hand and available to reserve.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/moves" className="btn-secondary">
              <span>View Move Ledger</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertTriangleIcon className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Search Toolbar */}
        <Card className="mb-6 !p-3">
          <form onSubmit={search} className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products by title, SKU, or category…"
                className="form-input !pl-9 text-sm"
              />
              {q && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
            <button type="submit" disabled={loading} className="btn-primary shrink-0">
              <span>{loading ? "Searching…" : "Search"}</span>
            </button>
          </form>
        </Card>

        {/* Products Stock Table */}
        <Card className="!p-0 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3.5">Product</th>
                  <th className="px-6 py-3.5">SKU / Code</th>
                  <th className="px-6 py-3.5 text-right">On Hand</th>
                  <th className="px-6 py-3.5 text-right">Free to Use</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => {
                  const onHand = p.totalOnHand ?? 0;
                  const available = p.totalAvailable ?? 0;
                  const isOut = onHand <= 0;
                  const isLow = onHand > 0 && onHand < 5;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            <LayersIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-semibold">{p.name}</span>
                            {p.category && <p className="text-xs text-slate-400">{p.category}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-700 border border-slate-200">
                          {p.sku || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold text-slate-900">{onHand}</span>
                        <span className="ml-1 text-xs text-slate-400">units</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-semibold ${available > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                          {available}
                        </span>
                        <span className="ml-1 text-xs text-slate-400">units</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Out of stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Low stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            In stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && !loading && <EmptyRow colSpan={5} text="No products found in inventory" />}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </>
  );
}
