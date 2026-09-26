"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Card, Field, Modal } from "@/components/ui";
import { api } from "@/lib/api";

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    try {
      setLoading(true);
      const res = await api.suppliers();
      setSuppliers(res?.suppliers || res?.data?.suppliers || []);
    } catch (err) {
      if (err.status === 401) {
        router.push("/login");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createSupplier(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.createSupplier(supplierForm);
      const newSupplier = res?.supplier || res?.data?.supplier;
      if (newSupplier) {
        setSuppliers([...suppliers, newSupplier]);
        setShowCreateModal(false);
        setSupplierForm({ name: "", email: "", phone: "", address: "" });
      }
    } catch (err) {
      alert("Error creating supplier: " + err.message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-3 text-slate-600">Loading suppliers...</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Suppliers</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">Manage your vendor and supplier relationships</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Supplier
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Suppliers Grid */}
        {suppliers.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-lg font-medium text-slate-900 mb-1">No suppliers found</h3>
            <p className="text-slate-500 mb-4">Get started by adding your first supplier</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              Add Your First Supplier
            </button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suppliers.map((supplier) => (
              <Card key={supplier._id} className="hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">{supplier.name}</h3>
                    {supplier.email && (
                      <p className="text-sm text-slate-600 mb-1">
                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {supplier.email}
                      </p>
                    )}
                    {supplier.phone && (
                      <p className="text-sm text-slate-600 mb-1">
                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {supplier.phone}
                      </p>
                    )}
                    {supplier.address && (
                      <p className="text-sm text-slate-500 mt-2">{supplier.address}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    Created {new Date(supplier.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create Supplier Modal */}
        <Modal 
          isOpen={showCreateModal} 
          onClose={() => setShowCreateModal(false)}
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
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="btn-primary"
              >
                {creating ? "Creating..." : "Create Supplier"}
              </button>
            </div>
          </form>
        </Modal>
      </main>
    </>
  );
}