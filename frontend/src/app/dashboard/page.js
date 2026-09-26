"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Card, StatCard } from "@/components/ui";
import { api } from "@/lib/api";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ClockIcon,
  AlertTriangleIcon,
  PlusIcon,
  LayersIcon,
  WarehouseIcon,
  ChevronRightIcon,
} from "@/components/icons";

function isLate(scheduledDate, status) {
  if (!scheduledDate || ["done", "canceled"].includes(status)) return false;
  return new Date(scheduledDate) < new Date(new Date().toDateString());
}

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [s, r, d] = await Promise.all([
          api.dashboard().catch(() => null),
          api.receipts("?limit=100").catch(() => null),
          api.deliveries("?limit=100").catch(() => null),
        ]);
        setSummary(s);
        setReceipts(r?.receipts || []);
        setDeliveries(d?.orders || []);
      } catch (err) {
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const openR = receipts.filter((x) => !["done", "canceled"].includes(x.status));
  const openD = deliveries.filter((x) => !["done", "canceled"].includes(x.status));
  const lateR = openR.filter((x) => isLate(x.scheduledDate, x.status)).length;
  const lateD = openD.filter((x) => isLate(x.scheduledDate, x.status)).length;
  const waitingD = openD.filter((x) => x.status === "waiting").length;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Inventory Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">Live operational status and fulfillment monitoring across all warehouses.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/receipts/new" className="btn-secondary">
              <PlusIcon className="h-4 w-4" />
              <span>New Receipt</span>
            </Link>
            <Link href="/delivery/new" className="btn-primary">
              <PlusIcon className="h-4 w-4" />
              <span>New Delivery</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertTriangleIcon className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top KPI Metrics Row */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Pending Receipts"
            value={summary?.pendingReceipts ?? openR.length}
            icon={ArrowDownLeftIcon}
            color="indigo"
            badge="Incoming"
          />
          <StatCard
            title="Pending Deliveries"
            value={summary?.pendingDeliveries ?? openD.length}
            icon={ArrowUpRightIcon}
            color="blue"
            badge="Outgoing"
          />
          <StatCard
            title="Internal Transfers"
            value={summary?.pendingTransfers ?? "0"}
            icon={ClockIcon}
            color="amber"
            badge="In transit"
          />
          <StatCard
            title="Low Stock Items"
            value={summary?.lowStockCount ?? "0"}
            icon={AlertTriangleIcon}
            color={summary?.lowStockCount > 0 ? "rose" : "emerald"}
            badge={summary?.lowStockCount > 0 ? "Needs reorder" : "Healthy"}
          />
        </div>

        {/* Odoo-style Operations Cards */}
        <div className="mb-8">
          <h2 className="mb-4 text-base font-semibold tracking-tight text-slate-800">Warehouse Operations</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Receipts Card */}
            <Card className="card-hover border-t-4 !border-t-indigo-600">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <ArrowDownLeftIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Receipts</h3>
                    <p className="text-xs text-slate-500">Inbound purchase orders & vendor shipments</p>
                  </div>
                </div>
                <Link
                  href="/receipts/new"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title="Create new receipt"
                >
                  <PlusIcon className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-6 flex items-center justify-between border-y border-slate-100 py-4">
                <button
                  onClick={() => router.push("/receipts")}
                  className="btn-primary text-sm"
                >
                  {openR.length} to Process
                </button>
                <div className="flex items-center gap-4 text-xs font-medium">
                  {lateR > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 border border-rose-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      {lateR} Late
                    </span>
                  )}
                  <span className="text-slate-500">{receipts.length} total operations</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-slate-500">Operation Type: <strong className="text-slate-700">IN (Vendor → Stock)</strong></span>
                <Link href="/receipts" className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700">
                  <span>View Receipts</span>
                  <ChevronRightIcon className="h-3 w-3" />
                </Link>
              </div>
            </Card>

            {/* Delivery Card */}
            <Card className="card-hover border-t-4 !border-t-blue-500">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <ArrowUpRightIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Delivery Orders</h3>
                    <p className="text-xs text-slate-500">Outbound customer shipments & fulfillment</p>
                  </div>
                </div>
                <Link
                  href="/delivery/new"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title="Create new delivery"
                >
                  <PlusIcon className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-6 flex items-center justify-between border-y border-slate-100 py-4">
                <button
                  onClick={() => router.push("/delivery")}
                  className="btn-primary !bg-blue-600 hover:!bg-blue-700 text-sm"
                >
                  {openD.length} to Deliver
                </button>
                <div className="flex items-center gap-3 text-xs font-medium">
                  {lateD > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 border border-rose-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      {lateD} Late
                    </span>
                  )}
                  {waitingD > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 border border-amber-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {waitingD} Waiting
                    </span>
                  )}
                  <span className="text-slate-500">{deliveries.length} total operations</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-slate-500">Operation Type: <strong className="text-slate-700">OUT (Stock → Customer)</strong></span>
                <Link href="/delivery" className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700">
                  <span>View Deliveries</span>
                  <ChevronRightIcon className="h-3 w-3" />
                </Link>
              </div>
            </Card>
          </div>
        </div>

        {/* Quick Operations Navigation */}
        <Card className="bg-slate-50/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Quick Navigation</h3>
              <p className="text-xs text-slate-500">Jump directly to warehouse ledger, stock counts, or configurations</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/stock" className="btn-secondary text-xs">
                <LayersIcon className="h-3.5 w-3.5 text-slate-500" />
                <span>Stock Levels</span>
              </Link>
              <Link href="/moves" className="btn-secondary text-xs">
                <ClockIcon className="h-3.5 w-3.5 text-slate-500" />
                <span>Move History</span>
              </Link>
              <Link href="/settings" className="btn-secondary text-xs">
                <WarehouseIcon className="h-3.5 w-3.5 text-slate-500" />
                <span>Warehouses & Locations</span>
              </Link>
            </div>
          </div>
        </Card>
      </main>
    </>
  );
}
