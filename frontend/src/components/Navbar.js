"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { setToken } from "@/lib/api";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/receipts", label: "Receipts" },
  { href: "/delivery", label: "Delivery" },
  { href: "/stock", label: "Stock" },
  { href: "/moves", label: "Move History" },
  { href: "/settings", label: "Settings" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    setToken(null);
    router.push("/login");
  }

  return (
    <header className="sticky top-3 z-50 mx-auto max-w-6xl px-4">
      <div className="glass-strong flex items-center gap-3 px-4 py-2.5">
        <Link href="/dashboard" className="grad-text text-lg font-extrabold tracking-tight">
          StockSense
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md shadow-fuchsia-300"
                    : "text-violet-950/70 hover:bg-white/60 hover:text-violet-950"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="rounded-full border border-white/70 bg-white/50 px-4 py-1.5 text-sm font-semibold text-violet-900 hover:bg-white/80"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
