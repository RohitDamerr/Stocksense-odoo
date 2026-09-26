"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Card, EmptyRow } from "@/components/ui";
import { api } from "@/lib/api";
import { ClockIcon, AlertTriangleIcon, LayersIcon } from "@/components/icons";

function isIn(movementType, qty) {
  if (movementType === "delivery" || movementType === "transfer_out") return false;
  if (movementType === "receipt" || movementType === "transfer_in") return true;
  return (qty ?? 0) >= 0;
}

export default function MovesPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.ledger("?limit=100");
        setRows(res?.entries || []);
      } catch (err) {
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <ClockIcon className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Move History Ledger</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">Comprehensive double-entry audit trail of all warehouse stock movements.</p>
          </div>
          <Link href="/stock" className="btn-secondary">
            <LayersIcon className="h-4 w-4 text-slate-500" />
            <span>Current Stock</span>
          </Link>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertTriangleIcon className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Audit Table */}
        <Card className="!p-0 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3.5">Reference / Type</th>
                  <th className="px-6 py-3.5">Date & Time</th>
                  <th className="px-6 py-3.5">Product</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5 text-right">Quantity Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((m) => {
                  const inn = isIn(m.movementType, m.quantityChange);
                  const isPositive = m.quantityChange > 0;

                  return (
                    <tr key={m._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium uppercase ${
                            inn
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            {m.movementType?.replace("_", " ") || "Move"}
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            {m.reference?.docNumber || ""}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {m.timestamp ? new Date(m.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <span>{m.product?.name || m.product || "Product"}</span>
                        {m.product?.sku && (
                          <span className="ml-2 font-mono text-xs text-slate-400">[{m.product.sku}]</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {m.location?.name || "Main Stock"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-bold ${
                            inn
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isPositive ? `+${m.quantityChange}` : m.quantityChange}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && !loading && <EmptyRow colSpan={5} text="No stock movements recorded yet" />}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </>
  );
}
