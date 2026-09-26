"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { GlassCard, EmptyRow } from "@/components/ui";
import { api } from "@/lib/api";

export default function StockPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.products("?limit=100");
        setRows(res?.products || []);
      } catch (err) {
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      }
    })();
  }, [router]);

  async function search(e) {
    e.preventDefault();
    try {
      const res = await api.products(`?limit=100${q.trim() ? `&search=${encodeURIComponent(q.trim())}` : ""}`);
      setRows(res?.products || []);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="grad-text text-3xl font-extrabold">📦 Stock</h1>
        <p className="mb-4 text-sm text-violet-900/60">List the available stock. Update via Stock Adjustment.</p>
        <GlassCard className="mb-4 !p-4">
          <form onSubmit={search} className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Search products" className="glass-input" />
            <button className="btn-gradient shrink-0 text-sm">Search</button>
          </form>
        </GlassCard>
        {error && <p className="mb-4 rounded-xl border border-rose-300/60 bg-rose-100/60 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <GlassCard className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/60 bg-white/40 text-left text-xs uppercase tracking-wide text-violet-900/60">
                <th className="px-4 py-3">Product</th><th className="px-4 py-3">On hand</th><th className="px-4 py-3">Free to use</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p._id} className="border-b border-white/40 last:border-0 hover:bg-white/50">
                  <td className="px-4 py-2.5 font-medium">{p.name} <span className="rounded-full bg-violet-100/80 px-2 py-0.5 font-mono text-xs text-violet-700">{p.sku}</span></td>
                  <td className="px-4 py-2.5 font-bold text-sky-700">{p.totalOnHand ?? "—"}</td>
                  <td className="px-4 py-2.5 font-bold text-emerald-600">{p.totalAvailable ?? "—"}</td>
                </tr>
              ))}
              {!rows.length && <EmptyRow colSpan={3} text="No products" />}
            </tbody>
          </table>
        </GlassCard>
      </main>
    </>
  );
}
