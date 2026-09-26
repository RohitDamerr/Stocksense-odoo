"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { GlassCard, Field } from "@/components/ui";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [w, setW] = useState({ name: "", code: "", address: "" });
  const [l, setL] = useState({ name: "", code: "", warehouse: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const [wh, loc] = await Promise.all([
        api.warehouses().catch(() => null),
        api.locations().catch(() => null),
      ]);
      setWarehouses(wh?.warehouses || wh?.data?.warehouses || []);
      setLocations(loc?.locations || loc?.data?.locations || []);
    } catch (err) {
      if (err.status === 401) router.push("/login");
      else setMsg(err.message);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="grad-text mb-4 text-3xl font-extrabold">⚙️ Settings</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <GlassCard className="border-t-4 !border-t-violet-500">
            <h2 className="mb-3 text-lg font-bold">🏭 Warehouse</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault(); setMsg("");
                try {
                  await api.createWarehouse(w);
                  setW({ name: "", code: "", address: "" });
                  setMsg("✅ Warehouse created.");
                  load();
                } catch (err) { setMsg(err.message); }
              }}
            >
              <Field label="Name">
                <input required value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} className="glass-input" />
              </Field>
              <Field label="Short Code">
                <input required value={w.code} onChange={(e) => setW({ ...w, code: e.target.value })} className="glass-input" />
              </Field>
              <Field label="Address">
                <input value={w.address} onChange={(e) => setW({ ...w, address: e.target.value })} className="glass-input" />
              </Field>
              <button className="btn-gradient w-full text-sm">Add Warehouse</button>
            </form>
            <ul className="mt-4 space-y-1.5 text-sm">
              {warehouses.map((x) => (
                <li key={x._id} className="rounded-xl border border-white/60 bg-white/50 px-3 py-2">
                  <span className="font-semibold">{x.name}</span> <span className="rounded-full bg-violet-100/80 px-2 py-0.5 font-mono text-xs text-violet-700">{x.code}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
          <GlassCard className="border-t-4 !border-t-cyan-400">
            <h2 className="mb-3 text-lg font-bold">📍 Location</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault(); setMsg("");
                try {
                  await api.createLocation(l);
                  setL({ name: "", code: "", warehouse: "" });
                  setMsg("✅ Location created.");
                  load();
                } catch (err) { setMsg(err.message); }
              }}
            >
              <Field label="Name">
                <input required value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} className="glass-input" />
              </Field>
              <Field label="Short Code">
                <input value={l.code} onChange={(e) => setL({ ...l, code: e.target.value })} className="glass-input" />
              </Field>
              <Field label="Warehouse">
                <select required value={l.warehouse} onChange={(e) => setL({ ...l, warehouse: e.target.value })} className="glass-input">
                  <option value="">Select…</option>
                  {warehouses.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                </select>
              </Field>
              <button className="btn-gradient w-full text-sm">Add Location</button>
            </form>
            <ul className="mt-4 space-y-1.5 text-sm">
              {locations.map((x) => (
                <li key={x._id} className="rounded-xl border border-white/60 bg-white/50 px-3 py-2">
                  <span className="font-semibold">{x.name}</span> <span className="text-violet-900/60">— {x.warehouse?.name || ""}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
        {msg && <p className="mt-4 rounded-xl bg-white/60 px-3 py-2 text-sm">{msg}</p>}
      </main>
    </>
  );
}
