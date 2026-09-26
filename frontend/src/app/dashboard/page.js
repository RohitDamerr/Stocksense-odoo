"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { GlassCard } from "@/components/ui";
import { api } from "@/lib/api";

function isLate(scheduledDate, status) {
  if (!scheduledDate || ["done", "canceled"].includes(status)) return false;
  return new Date(scheduledDate) < new Date(new Date().toDateString());
}

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [s, r, d] = await Promise.all([
          api.dashboard().catch(() => null),
          api.receipts("?limit=100").catch(() => null),
          api.deliveries("?limit=100").catch(() => null),
        ]);
        setSummary(s);
        setReceipts(r?.receipts || []);
        setDeliveries(d?.orders || []);
      } catch (err) {
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      }
    })();
  }, [router]);

  const openR = receipts.filter((x) => !["done", "canceled"].includes(x.status));
  const openD = deliveries.filter((x) => !["done", "canceled"].includes(x.status));
  const lateR = openR.filter((x) => isLate(x.scheduledDate, x.status)).length;
  const lateD = openD.filter((x) => isLate(x.scheduledDate, x.status)).length;
  const waitingD = openD.filter((x) => x.status === "waiting").length;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="grad-text mb-1 text-3xl font-extrabold">Dashboard</h1>
        <p className="mb-6 text-sm text-violet-900/60">Dashboard to display the current statistics</p>
        {error && (
          <p className="mb-4 rounded-xl border border-rose-300/60 bg-rose-100/60 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
        {summary && (
          <div className="mb-4 flex flex-wrap gap-2 text-sm font-medium">
            {[
              ["Receipts", summary.pendingReceipts, "from-violet-500 to-purple-500"],
              ["Deliveries", summary.pendingDeliveries, "from-sky-500 to-cyan-400"],
              ["Transfers", summary.pendingTransfers, "from-fuchsia-500 to-pink-400"],
              ["Low stock", summary.lowStockCount, "from-amber-500 to-orange-400"],
            ].map(([label, v, grad]) => (
              <span key={label} className={`rounded-full bg-gradient-to-r px-4 py-1.5 text-white shadow ${grad}`}>
                {label}: {v ?? "–"}
              </span>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <GlassCard className="border-l-4 !border-l-violet-500">
            <div className="mb-1 flex items-center gap-2 text-2xl">📥<h2 className="text-lg font-bold">Receipt</h2></div>
            <button onClick={() => router.push("/receipts")} className="btn-gradient mt-3 text-sm">
              {openR.length} to receive
            </button>
            <p className="mt-3 text-sm"><span className="font-bold text-rose-500">{lateR}</span> Late</p>
            <p className="text-sm text-violet-900/70">{openR.length} operations</p>
          </GlassCard>
          <GlassCard className="border-l-4 !border-l-cyan-400">
            <div className="mb-1 flex items-center gap-2 text-2xl">📤<h2 className="text-lg font-bold">Delivery</h2></div>
            <button onClick={() => router.push("/delivery")} className="btn-gradient mt-3 text-sm">
              {openD.length} to Deliver
            </button>
            <p className="mt-3 text-sm"><span className="font-bold text-rose-500">{lateD}</span> Late</p>
            <p className="text-sm text-violet-900/70">{waitingD} waiting · {openD.length} operations</p>
          </GlassCard>
        </div>
        <GlassCard className="mt-4 text-sm">
          <p className="font-bold">Operations submenu</p>
          <p className="text-violet-900/70">1. Receipt &nbsp; 2. Delivery &nbsp; 3. Adjustment (via Stock page)</p>
        </GlassCard>
      </main>
    </>
  );
}
