"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { GlassCard, Field } from "@/components/ui";
import { api } from "@/lib/api";

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
      <main className="mx-auto max-w-xl px-4 py-6">
        <h1 className="grad-text mb-4 text-3xl font-extrabold">New Receipt</h1>
        <GlassCard>
          <form onSubmit={onSubmit}>
            <Field label="Supplier">
              <select required value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="glass-input">
                <option value="">Select…</option>
                {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Destination warehouse">
              <select required value={form.destinationWarehouse} onChange={(e) => setForm({ ...form, destinationWarehouse: e.target.value })} className="glass-input">
                <option value="">Select…</option>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name} ({w.code})</option>)}
              </select>
            </Field>
            <Field label="Schedule date">
              <input type="date" required value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="glass-input" />
            </Field>
            {error && <p className="mb-3 rounded-xl border border-rose-300/60 bg-rose-100/60 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <button disabled={busy} className="btn-gradient w-full">
              {busy ? "Creating…" : "Create (Draft)"}
            </button>
          </form>
        </GlassCard>
      </main>
    </>
  );
}
