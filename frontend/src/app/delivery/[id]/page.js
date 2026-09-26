"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Card, StatusPill, StagePipeline } from "@/components/ui";
import { api } from "@/lib/api";
import {
  ArrowLeftIcon,
  PrinterIcon,
  CheckCircleIcon,
  PlusIcon,
  AlertTriangleIcon,
} from "@/components/icons";

export default function DeliveryDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [doc, setDoc] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await api.delivery(id);
      setDoc(r?.order || null);
    } catch (err) {
      if (err.status === 401) router.push("/login");
      else setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(fn, okMsg) {
    setMsg("");
    setBusy(true);
    try {
      await fn();
      setMsg(okMsg);
      await load();
    } catch (err) {
      setMsg(err.message + (err.code === "INSUFFICIENT_STOCK" ? " — Insufficient stock in warehouse to fulfill this delivery." : ""));
    } finally {
      setBusy(false);
    }
  }

  const lines = doc?.lines || [];
  const isDone = doc?.status === "done";
  const isCanceled = doc?.status === "canceled";

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/delivery"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back to Deliveries</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="btn-secondary text-xs sm:text-sm"
              title="Print Delivery Order"
            >
              <PrinterIcon className="h-4 w-4" />
              <span>Print</span>
            </button>
            <Link href="/delivery/new" className="btn-secondary text-xs sm:text-sm">
              <PlusIcon className="h-4 w-4" />
              <span>New</span>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="card-base p-12 text-center text-slate-500">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="mt-3 text-sm">Loading delivery details…</p>
          </div>
        ) : doc ? (
          <div className="space-y-6">
            {/* Header Document Card */}
            <Card className="!p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Outbound Delivery</span>
                  <h1 className="font-mono text-2xl font-bold tracking-tight text-slate-900">{doc.deliveryNumber}</h1>
                </div>
                <div>
                  {isCanceled ? (
                    <StatusPill status="canceled" />
                  ) : (
                    <StagePipeline stages={["draft", "waiting", "ready", "done"]} current={doc.status} />
                  )}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5 pt-4">
                {!isDone && !isCanceled && (
                  <button
                    disabled={busy}
                    onClick={() => act(() => api.validateDelivery(id), "Delivery validated and dispatched to customer.")}
                    className="btn-primary !bg-blue-600 hover:!bg-blue-700"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    <span>{busy ? "Validating…" : "Validate (Mark as Done)"}</span>
                  </button>
                )}
                {!isDone && !isCanceled && (
                  <button
                    disabled={busy}
                    onClick={() => act(() => api.cancelDelivery(id), "Delivery order canceled.")}
                    className="btn-danger"
                  >
                    <span>Cancel Delivery</span>
                  </button>
                )}
                {isDone && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200">
                    <CheckCircleIcon className="h-4 w-4" />
                    Dispatched & Delivered
                  </span>
                )}
              </div>

              {msg && (
                <div className={`mt-4 rounded-lg border p-3 text-sm ${msg.includes("Insufficient") ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                  {msg}
                </div>
              )}
            </Card>

            {/* Document Details Grid */}
            <Card className="!p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Customer & Destination Details</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <span className="block text-xs font-medium text-slate-400">Customer Name</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-900">
                    {doc.customer?.name || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-400">Delivery Address</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-900">
                    {doc.customer?.address || doc.deliveryAddress || "Standard Shipping"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-400">Scheduled Date</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-900">
                    {doc.scheduledDate ? new Date(doc.scheduledDate).toLocaleDateString(undefined, { dateStyle: "long" }) : "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-400">Operation Type</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-900">
                    OUT (Warehouse → Customer)
                  </span>
                </div>
              </div>
            </Card>

            {/* Products Line Items Table */}
            <Card className="!p-0 overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-3.5">
                <h2 className="text-sm font-semibold text-slate-800">Delivery Line Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Product Name</th>
                      <th className="px-6 py-3">SKU</th>
                      <th className="px-6 py-3 text-right">Delivery Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l, i) => (
                      <tr key={l._id || i}>
                        <td className="px-6 py-3.5 font-medium text-slate-900">
                          {l.product?.name || l.product || "Product"}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-xs text-slate-500">
                          {l.product?.sku || "—"}
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold text-slate-900">
                          {l.packedQty ?? l.orderedQty ?? "1"}
                        </td>
                      </tr>
                    ))}
                    {!lines.length && (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-400">
                          No line items attached to this delivery
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : (
          <div className="card-base p-8 text-center text-rose-600">
            Delivery order not found or failed to load.
          </div>
        )}
      </main>
    </>
  );
}
