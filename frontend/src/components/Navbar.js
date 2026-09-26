"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { setToken, api } from "@/lib/api";
import {
  BoxIcon,
  LayoutDashboardIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  LayersIcon,
  ClockIcon,
  SettingsIcon,
  LogOutIcon,
  UserIcon,
} from "./icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/receipts", label: "Receipts", icon: ArrowDownLeftIcon },
  { href: "/delivery", label: "Delivery", icon: ArrowUpRightIcon },
  { href: "/stock", label: "Stock", icon: LayersIcon },
  { href: "/moves", label: "Move History", icon: ClockIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    api
      .me()
      .then((res) => {
        setUser(res?.data?.user || res?.user || null);
      })
      .catch(() => {});
  }, []);

  function logout() {
    setToken(null);
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs group-hover:bg-indigo-700 transition">
              <BoxIcon className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-slate-900 leading-tight">StockSense</span>
              <span className="text-[10px] font-medium tracking-wide uppercase text-slate-400">Inventory ERP</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition ${
                    active
                      ? "bg-slate-100 text-indigo-700 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & Actions */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2.5 border-r border-slate-200 pr-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-semibold text-xs border border-slate-200">
                {user.name ? user.name.slice(0, 2).toUpperCase() : <UserIcon className="h-4 w-4" />}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 leading-tight">{user.name || "User"}</span>
                <span className="text-[10px] text-slate-500 capitalize">{user.role ? user.role.replace("_", " ") : "Staff"}</span>
              </div>
            </div>
          )}

          <button
            onClick={logout}
            title="Sign out"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-slate-200 transition"
          >
            <LogOutIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex overflow-x-auto border-t border-slate-100 px-2 py-1 gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs whitespace-nowrap rounded-md ${
                active
                  ? "bg-slate-100 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
