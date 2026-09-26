"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Card, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { SettingsIcon, WarehouseIcon, MapPinIcon, PlusIcon, CheckCircleIcon } from "@/components/icons";

export default function SettingsPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [w, setW] = useState({ name: "", code: "", address: "" });
  const [l, setL] = useState({ name: "", code: "", warehouse: "" });
  const [msg, setMsg] = useState("");
  const [busyW, setBusyW] = useState(false);
  const [busyL, setBusyL] = useState(false);

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

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Warehouse Settings</h1>
            <p className="mt-1 text-sm text-slate-500">Configure physical facilities, warehouse short codes, and internal storage locations.</p>
          </div>
        </div>

        {msg && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
            <CheckCircleIcon className="h-5 w-5 text-indigo-600 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Warehouses Section */}
          <div className="space-y-6">
            <Card className="!p-6 border-t-4 !border-t-indigo-600">
              <div className="mb-5 flex items-center gap-2.5">
                <WarehouseIcon className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Add New Warehouse</h2>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setMsg("");
                  setBusyW(true);
                  try {
                    await api.createWarehouse(w);
                    setW({ name: "", code: "", address: "" });
                    setMsg("Warehouse created successfully.");
                    load();
                  } catch (err) {
                    setMsg(err.message);
                  } finally {
                    setBusyW(false);
                  }
                }}
              >
                <Field label="Warehouse Name" hint="Full title of the physical warehouse">
                  <input
                    required
                    placeholder="e.g. Central Warehouse"
                    value={w.name}
                    onChange={(e) => setW({ ...w, name: e.target.value })}
                    className="form-input"
                  />
                </Field>
                <Field label="Short Code" hint="2-5 letter prefix (e.g. WH, BLR)">
                  <input
                    required
                    placeholder="e.g. WH"
                    value={w.code}
                    onChange={(e) => setW({ ...w, code: e.target.value.toUpperCase() })}
                    className="form-input font-mono uppercase"
                  />
                </Field>
                <Field label="Physical Address" hint="City or street address">
                  <input
                    placeholder="e.g. Plot 42, Industrial Zone"
                    value={w.address}
                    onChange={(e) => setW({ ...w, address: e.target.value })}
                    className="form-input"
                  />
                </Field>
                <button disabled={busyW} type="submit" className="btn-primary w-full">
                  <PlusIcon className="h-4 w-4" />
                  <span>{busyW ? "Adding…" : "Add Warehouse"}</span>
                </button>
              </form>
            </Card>

            {/* Warehouse List */}
            <Card className="!p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Configured Warehouses ({warehouses.length})</h3>
              <div className="space-y-2">
                {warehouses.map((x) => (
                  <div key={x._id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <div>
                      <span className="font-semibold text-sm text-slate-800">{x.name}</span>
                      {x.address && <p className="text-xs text-slate-500 mt-0.5">{x.address}</p>}
                    </div>
                    <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 font-mono text-xs font-bold text-indigo-700 shadow-2xs">
                      {x.code}
                    </span>
                  </div>
                ))}
                {!warehouses.length && (
                  <p className="text-xs text-slate-400 py-2">No warehouses configured yet.</p>
                )}
              </div>
            </Card>
          </div>

          {/* Locations Section */}
          <div className="space-y-6">
            <Card className="!p-6 border-t-4 !border-t-blue-500">
              <div className="mb-5 flex items-center gap-2.5">
                <MapPinIcon className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Add Storage Location</h2>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setMsg("");
                  setBusyL(true);
                  try {
                    await api.createLocation(l);
                    setL({ name: "", code: "", warehouse: "" });
                    setMsg("Location created successfully.");
                    load();
                  } catch (err) {
                    setMsg(err.message);
                  } finally {
                    setBusyL(false);
                  }
                }}
              >
                <Field label="Location Name" hint="Rack, aisle, or bin name">
                  <input
                    required
                    placeholder="e.g. Shelf A-101 / Input Zone"
                    value={l.name}
                    onChange={(e) => setL({ ...l, name: e.target.value })}
                    className="form-input"
                  />
                </Field>
                <Field label="Location Code" hint="Short code identifier">
                  <input
                    placeholder="e.g. LOC-01"
                    value={l.code}
                    onChange={(e) => setL({ ...l, code: e.target.value })}
                    className="form-input font-mono"
                  />
                </Field>
                <Field label="Parent Warehouse" hint="Facility where this location belongs">
                  <select
                    required
                    value={l.warehouse}
                    onChange={(e) => setL({ ...l, warehouse: e.target.value })}
                    className="form-input"
                  >
                    <option value="">Select warehouse…</option>
                    {warehouses.map((x) => (
                      <option key={x._id} value={x._id}>
                        {x.name} ({x.code})
                      </option>
                    ))}
                  </select>
                </Field>
                <button disabled={busyL} type="submit" className="btn-primary !bg-blue-600 hover:!bg-blue-700 w-full">
                  <PlusIcon className="h-4 w-4" />
                  <span>{busyL ? "Adding…" : "Add Location"}</span>
                </button>
              </form>
            </Card>

            {/* Locations List */}
            <Card className="!p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Storage Locations ({locations.length})</h3>
              <div className="space-y-2">
                {locations.map((x) => (
                  <div key={x._id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <div>
                      <span className="font-semibold text-sm text-slate-800">{x.name}</span>
                      <p className="text-xs text-slate-500 mt-0.5">Warehouse: {x.warehouse?.name || "Main"}</p>
                    </div>
                    {x.code && (
                      <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 font-mono text-xs text-slate-600 shadow-2xs">
                        {x.code}
                      </span>
                    )}
                  </div>
                ))}
                {!locations.length && (
                  <p className="text-xs text-slate-400 py-2">No locations configured yet.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
