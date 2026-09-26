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
  WarehouseIcon,
} from "@/components/icons";

export default function ReceiptDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [doc, setDoc] = useState(null);
  const [me, setMe] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [r, u] = await Promise.all([api.receipt(id), api.me().catch(() => null)]);
      setDoc(r?.receipt || null);
      setMe(u?.data?.user || u?.user || null);
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
      setMsg(err.message);
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
            href="/receipts"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back to Receipts</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="btn-secondary text-xs sm:text-sm"
              title="Print Receipt"
            >
              <PrinterIcon className="h-4 w-4" />
              <span>Print</span>
            </button>
            <Link href="/receipts/new" className="btn-secondary text-xs sm:text-sm">
              <PlusIcon className="h-4 w-4" />
              <span>New</span>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="card-base p-12 text-center text-slate-500">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="mt-3 text-sm">Loading receipt details…</p>
          </div>
        ) : doc ? (
          <div className="space-y-6">
            {/* Header Document Card */}
            <Card className="!p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Incoming Shipment</span>
                  <h1 className="font-mono text-2xl font-bold tracking-tight text-slate-900">{doc.receiptNumber}</h1>
                </div>
                <div>
                  {isCanceled ? (
                    <StatusPill status="canceled" />
                  ) : (
                    <StagePipeline stages={["draft", "ready", "done"]} current={doc.status} />
                  )}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5 pt-4">
                {!isDone && !isCanceled && (
                  <button
                    disabled={busy}
                    onClick={() => act(() => api.validateReceipt(id), "Receipt successfully validated and stock added to inventory.")}
                    className="btn-primary"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    <span>{busy ? "Validating…" : "Validate (Move to Done)"}</span>
                  </button>
                )}
                {!isDone && !isCanceled && (
                  <button
                    disabled={busy}
                    onClick={() => act(() => api.cancelReceipt(id), "Receipt order canceled.")}
                    className="btn-danger"
                  >
                    <span>Cancel Receipt</span>
                  </button>
                )}
                {isDone && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200">
                    <CheckCircleIcon className="h-4 w-4" />
                    Completed & Archived in Ledger
                  </span>
                )}
              </div>

              {msg && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {msg}
                </div>
              )}
            </Card>

            {/* Document Details Grid */}
            <Card className="!p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Shipment Information</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <span className="block text-xs font-medium text-slate-400">Vendor / Supplier</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-900">
                    {doc.supplier?.name || doc.supplier || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-400">Destination Warehouse</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-900">
                    {doc.destinationWarehouse?.name || "Main Warehouse"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-400">Scheduled Date</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-900">
                    {doc.scheduledDate ? new Date(doc.scheduledDate).toLocaleDateString(undefined, { dateStyle: "long" }) : "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-400">Responsible User</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-900">
                    {doc.validatedBy?.name || doc.createdBy?.name || me?.name || "Warehouse Manager"}
                  </span>
                </div>
              </div>
            </Card>

            {/* Products Line Items Table */}
            <Card className="!p-0 overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-3.5">
                <h2 className="text-sm font-semibold text-slate-800">Product Line Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Product Name</th>
                      <th className="px-6 py-3">SKU</th>
                      <th className="px-6 py-3 text-right">Received Quantity</th>
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
                          {l.receivedQty ?? l.expectedQty ?? "1"}
                        </td>
                      </tr>
                    ))}
                    {!lines.length && (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-400">
                          No line items attached to this receipt
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
            Receipt not found or failed to load.
          </div>
        )}
      </main>
    </>
  );
}
