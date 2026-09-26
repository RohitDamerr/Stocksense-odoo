"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { GlassCard, Field } from "@/components/ui";
import { api } from "@/lib/api";

export default function NewDeliveryPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ name: "", address: "", sourceWarehouse: "", scheduledDate: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const w = await api.warehouses().catch(() => null);
        setWarehouses(w?.warehouses || w?.data?.warehouses || []);
      } catch (err) {
        if (err.status === 401) router.push("/login");
      }
    })();
  }, [router]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = await api.createDelivery({
        customer: { name: form.name, address: form.address },
        sourceWarehouse: form.sourceWarehouse,
        scheduledDate: form.scheduledDate || undefined,
      });
      const id = res?.order?._id || res?.data?.order?._id;
      router.push(id ? `/delivery/${id}` : "/delivery");
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
        <h1 className="grad-text mb-4 text-3xl font-extrabold">New Delivery</h1>
        <GlassCard>
          <form onSubmit={onSubmit}>
            <Field label="Customer name">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="glass-input" />
            </Field>
            <Field label="Delivery address">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="glass-input" />
            </Field>
            <Field label="Source warehouse">
              <select required value={form.sourceWarehouse} onChange={(e) => setForm({ ...form, sourceWarehouse: e.target.value })} className="glass-input">
                <option value="">Select…</option>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name} ({w.code})</option>)}
              </select>
            </Field>
            <Field label="Schedule date">
              <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="glass-input" />
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
