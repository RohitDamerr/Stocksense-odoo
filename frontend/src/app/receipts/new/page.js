"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Card, Field, SelectWithCreate, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { ArrowLeftIcon, ArrowDownLeftIcon, AlertTriangleIcon } from "@/components/icons";

export default function NewReceiptPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ supplier: "", destinationWarehouse: "", scheduledDate: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Modal states for creating new entities
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [warehouseForm, setWarehouseForm] = useState({ name: "", code: "", address: "" });
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [creatingWarehouse, setCreatingWarehouse] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [s, w] = await Promise.all([api.suppliers().catch(() => null), api.warehouses().catch(() => null)]);
      setSuppliers(s?.suppliers || s?.data?.suppliers || []);
      setWarehouses(w?.warehouses || w?.data?.warehouses || []);
    } catch (err) {
      if (err.status === 401) router.push("/login");
    }
  }

  async function createSupplier(e) {
    e.preventDefault();
    setCreatingSupplier(true);
    try {
      const res = await api.createSupplier(supplierForm);
      const newSupplier = res?.supplier || res?.data?.supplier;
      if (newSupplier) {
        setSuppliers([...suppliers, newSupplier]);
        setForm({ ...form, supplier: newSupplier._id });
        setShowSupplierModal(false);
        setSupplierForm({ name: "", email: "", phone: "", address: "" });
      }
    } catch (err) {
      alert("Error creating supplier: " + err.message);
    } finally {
      setCreatingSupplier(false);
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
        setForm({ ...form, destinationWarehouse: newWarehouse._id });
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
            <SelectWithCreate
              label="Vendor / Supplier"
              hint="Select the vendor supplying the goods"
              value={form.supplier}
              onChange={(value) => setForm({ ...form, supplier: value })}
              options={suppliers}
              onCreateNew={() => setShowSupplierModal(true)}
              placeholder="Select a supplier…"
              createLabel="Add Supplier"
              required
            />

            <SelectWithCreate
              label="Destination Warehouse"
              hint="Warehouse receiving the physical inventory"
              value={form.destinationWarehouse}
              onChange={(value) => setForm({ ...form, destinationWarehouse: value })}
              options={warehouses.map(w => ({ ...w, label: `${w.name} (${w.code})` }))}
              onCreateNew={() => setShowWarehouseModal(true)}
              placeholder="Select destination warehouse…"
              createLabel="Add Warehouse"
              required
            />

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

        {/* Supplier Creation Modal */}
        <Modal 
          isOpen={showSupplierModal} 
          onClose={() => setShowSupplierModal(false)}
          title="Add New Supplier"
        >
          <form onSubmit={createSupplier}>
            <Field label="Supplier Name" hint="Company or individual name">
              <input
                type="text"
                required
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                className="form-input"
                placeholder="Enter supplier name"
              />
            </Field>

            <Field label="Email" hint="Primary contact email">
              <input
                type="email"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                className="form-input"
                placeholder="supplier@example.com"
              />
            </Field>

            <Field label="Phone" hint="Contact phone number">
              <input
                type="tel"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                className="form-input"
                placeholder="+1 (555) 123-4567"
              />
            </Field>

            <Field label="Address" hint="Business address">
              <textarea
                value={supplierForm.address}
                onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                className="form-input"
                rows={3}
                placeholder="Street address, City, State, ZIP"
              />
            </Field>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingSupplier}
                className="btn-primary"
              >
                {creatingSupplier ? "Creating..." : "Create Supplier"}
              </button>
            </div>
          </form>
        </Modal>

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
