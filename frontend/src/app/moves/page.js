"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { GlassCard, EmptyRow } from "@/components/ui";
import { api } from "@/lib/api";

function isIn(movementType, qty) {
  if (movementType === "delivery" || movementType === "transfer_out") return false;
  if (movementType === "receipt" || movementType === "transfer_in") return true;
  return (qty ?? 0) >= 0;
}

export default function MovesPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.ledger("?limit=100");
        setRows(res?.entries || []);
      } catch (err) {
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      }
    })();
  }, [router]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="grad-text text-3xl font-extrabold">🕘 Move History</h1>
        <p className="mb-4 text-sm text-violet-900/60">All moves From → To. In = green, Out = red.</p>
        {error && <p className="mb-4 rounded-xl border border-rose-300/60 bg-rose-100/60 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <GlassCard className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/60 bg-white/40 text-left text-xs uppercase tracking-wide text-violet-900/60">
                <th className="px-4 py-3">Reference</th><th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const inn = isIn(m.movementType, m.quantityChange);
                return (
                  <tr key={m._id} className="border-b border-white/40 last:border-0 hover:bg-white/50">
                    <td className="px-4 py-2.5 font-mono text-xs">{m.reference?.docNumber || m.movementType}</td>
                    <td className="px-4 py-2.5">{m.timestamp ? new Date(m.timestamp).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-2.5">{m.product?.name || m.product} {m.product?.sku ? `[${m.product.sku}]` : ""}</td>
                    <td className="px-4 py-2.5">{m.location?.name || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${inn ? "bg-emerald-400/25 text-emerald-700" : "bg-rose-400/25 text-rose-700"}`}>
                        {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <EmptyRow colSpan={5} text="No moves" />}
            </tbody>
          </table>
        </GlassCard>
      </main>
    </>
  );
}
