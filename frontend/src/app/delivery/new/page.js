"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Card, Field, SelectWithCreate, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { ArrowLeftIcon, ArrowUpRightIcon, AlertTriangleIcon } from "@/components/icons";

export default function NewDeliveryPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ name: "", address: "", sourceWarehouse: "", scheduledDate: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Modal states for creating new warehouse
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState({ name: "", code: "", address: "" });
  const [creatingWarehouse, setCreatingWarehouse] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const w = await api.warehouses().catch(() => null);
      setWarehouses(w?.warehouses || w?.data?.warehouses || []);
    } catch (err) {
      if (err.status === 401) router.push("/login");
    }
  }

  async function createWarehouse(e) {
    e.preventDefault();
    setCreatingWarehouse(true);
    try {
      const res = await api.createWarehouse(warehouseForm);
      const newWarehouse = res?.warehouse || res?.data?.warehouse;
      if (newWarehouse) {
        setWarehouses([...warehouses, newWarehouse]);
        setForm({ ...form, sourceWarehouse: newWarehouse._id });
        setShowWarehouseModal(false);
        setWarehouseForm({ name: "", code: "", address: "" });
      }
    } catch (err) {
      alert("Error creating warehouse: " + err.message);
    } finally {
      setCreatingWarehouse(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
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
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/delivery"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back to Deliveries</span>
          </Link>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <ArrowUpRightIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Delivery Order</h1>
            <p className="text-xs text-slate-500">Dispatch stock for outbound customer fulfillment</p>
          </div>
        </div>

        <Card className="!p-6 shadow-xs">
          <form onSubmit={onSubmit}>
            <Field label="Customer Name" hint="Client or store receiving the order">
              <input
                required
                placeholder="e.g. Acme Corp / John Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="form-input"
              />
            </Field>

            <Field label="Delivery Address" hint="Destination physical delivery address">
              <input
                placeholder="e.g. 123 Industrial Park, Sector 5"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="form-input"
              />
            </Field>

            <SelectWithCreate
              label="Source Warehouse"
              hint="Warehouse dispatching the inventory"
              value={form.sourceWarehouse}
              onChange={(value) => setForm({ ...form, sourceWarehouse: value })}
              options={warehouses.map(w => ({ ...w, label: `${w.name} (${w.code})` }))}
              onCreateNew={() => setShowWarehouseModal(true)}
              placeholder="Select dispatch warehouse…"
              createLabel="Add Warehouse"
              required
            />

            <Field label="Scheduled Date" hint="Expected dispatch or delivery date">
              <input
                type="date"
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
              <Link href="/delivery" className="btn-secondary">
                Cancel
              </Link>
              <button disabled={busy} type="submit" className="btn-primary !bg-blue-600 hover:!bg-blue-700">
                {busy ? "Creating…" : "Save as Draft"}
              </button>
            </div>
          </form>
        </Card>

        {/* Warehouse Creation Modal */}
        <Modal 
          isOpen={showWarehouseModal} 
          onClose={() => setShowWarehouseModal(false)}
          title="Add New Warehouse"
        >
          <form onSubmit={createWarehouse}>
            <Field label="Warehouse Name" hint="Descriptive name for the warehouse">
              <input
                type="text"
                required
                value={warehouseForm.name}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                className="form-input"
                placeholder="Enter warehouse name"
              />
            </Field>

            <Field label="Warehouse Code" hint="Short code (e.g., WH01, NYC, LAX)">
              <input
                type="text"
                required
                value={warehouseForm.code}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value.toUpperCase() })}
                className="form-input"
                placeholder="WH01"
              />
            </Field>

            <Field label="Address" hint="Physical location of warehouse">
              <textarea
                value={warehouseForm.address}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
                className="form-input"
                rows={3}
                placeholder="Street address, City, State, ZIP"
              />
            </Field>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowWarehouseModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingWarehouse}
                className="btn-primary"
              >
                {creatingWarehouse ? "Creating..." : "Create Warehouse"}
              </button>
            </div>
          </form>
        </Modal>
      </main>
    </>
  );
}
