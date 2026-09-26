"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Card, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { ArrowLeftIcon, ArrowDownLeftIcon, AlertTriangleIcon } from "@/components/icons";

export default function NewReceiptPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ supplier: "", destinationWarehouse: "", scheduledDate: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, w] = await Promise.all([api.suppliers().catch(() => null), api.warehouses().catch(() => null)]);
        setSuppliers(s?.suppliers || s?.data?.suppliers || []);
        setWarehouses(w?.warehouses || w?.data?.warehouses || []);
      } catch (err) {
        if (err.status === 401) router.push("/login");
      }
    })();
  }, [router]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.createReceipt(form);
      const id = res?.receipt?._id || res?.data?.receipt?._id;
      router.push(id ? `/receipts/${id}` : "/receipts");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/receipts"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back to Receipts</span>
          </Link>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ArrowDownLeftIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create New Receipt</h1>
            <p className="text-xs text-slate-500">Record a new inbound vendor shipment into inventory</p>
          </div>
        </div>

        <Card className="!p-6 shadow-xs">
          <form onSubmit={onSubmit}>
            <Field label="Vendor / Supplier" hint="Select the vendor supplying the goods">
              <select
                required
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="form-input"
              >
                <option value="">Select a supplier…</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Destination Warehouse" hint="Warehouse receiving the physical inventory">
              <select
                required
                value={form.destinationWarehouse}
                onChange={(e) => setForm({ ...form, destinationWarehouse: e.target.value })}
                className="form-input"
              >
                <option value="">Select destination warehouse…</option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Scheduled Date" hint="Expected arrival date at warehouse">
              <input
                type="date"
                required
                value={form.scheduledDate}
                onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                className="form-input"
              />
            </Field>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <AlertTriangleIcon className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <Link href="/receipts" className="btn-secondary">
                Cancel
              </Link>
              <button disabled={busy} type="submit" className="btn-primary">
                {busy ? "Creating…" : "Save as Draft"}
              </button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
