"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { GlassCard, StatusPill } from "@/components/ui";
import { api } from "@/lib/api";

export default function DeliveryDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [doc, setDoc] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await api.delivery(id);
      setDoc(r?.order || null);
    } catch (err) {
      if (err.status === 401) router.push("/login");
      else setMsg(err.message);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(fn, okMsg) {
    setMsg(""); setBusy(true);
    try {
      await fn();
      setMsg(okMsg);
      await load();
    } catch (err) {
      setMsg(err.message + (err.code === "INSUFFICIENT_STOCK" ? " — product not in stock." : ""));
    } finally {
      setBusy(false);
    }
  }

  const lines = doc?.lines || [];
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="grad-text text-3xl font-extrabold">Delivery</h1>
        {doc ? (
          <GlassCard className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-xl font-bold text-violet-700">{doc.deliveryNumber}</p>
              <span className="rounded-full border border-white/60 bg-white/50 px-4 py-1 text-xs font-semibold">
                Draft &gt; Waiting &gt; Ready &gt; Done — now: <StatusPill status={doc.status} />
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="font-semibold text-violet-900/60">Delivery Address: </span>{doc.customer?.address || doc.customer?.name || "—"}</p>
              <p><span className="font-semibold text-violet-900/60">Schedule Date: </span>{doc.scheduledDate ? new Date(doc.scheduledDate).toLocaleDateString() : "—"}</p>
              <p><span className="font-semibold text-violet-900/60">Operation type: </span>OUT</p>
              <p><span className="font-semibold text-violet-900/60">Status: </span><StatusPill status={doc.status} /></p>
            </div>
            <h2 className="mt-6 font-bold">Products</h2>
            <div className="mt-2 overflow-hidden rounded-xl border border-white/60">
              <table className="w-full bg-white/40 text-sm">
                <thead><tr className="border-b border-white/60 text-left text-xs uppercase text-violet-900/60"><th className="px-3 py-2">Product</th><th className="px-3 py-2">Quantity</th></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l._id || i} className="border-b border-white/40 last:border-0">
                      <td className="px-3 py-2">{l.product?.name || l.product}</td>
                      <td className="px-3 py-2 font-semibold">{l.packedQty ?? l.orderedQty ?? "—"}</td>
                    </tr>
                  ))}
                  {!lines.length && <tr><td colSpan={2} className="px-3 py-4 text-violet-900/50">No lines</td></tr>}
                </tbody>
              </table>
            </div>
            {msg && <p className="mt-4 rounded-xl bg-white/60 px-3 py-2 text-sm">{msg}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => router.push("/delivery/new")} className="btn-glass text-sm">New</button>
              <button disabled={busy} onClick={() => act(() => api.validateDelivery(id), "✅ Validated — Done.")} className="btn-gradient text-sm">Validate</button>
              <button onClick={() => window.print()} className="btn-glass text-sm">🖨 Print</button>
              <button disabled={busy} onClick={() => act(() => api.cancelDelivery(id), "Canceled.")} className="btn-glass text-sm !text-rose-600">Cancel</button>
            </div>
            <p className="mt-3 text-xs text-violet-900/50">Draft: initial · Waiting: waiting for out-of-stock · Ready: ready to deliver · Done: delivered.</p>
          </GlassCard>
        ) : (
          <p className="mt-4 text-sm text-violet-900/60">Loading… {msg}</p>
        )}
      </main>
    </>
  );
}
