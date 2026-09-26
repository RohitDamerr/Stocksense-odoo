"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { Field, Card } from "@/components/ui";
import { BoxIcon, AlertTriangleIcon } from "@/components/icons";

function validPassword(pw) {
  return (
    pw.length >= 8 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState("warehouse_staff");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (loginId.trim().length < 3 || loginId.trim().length > 30) {
      setError("Name must be between 3 and 30 characters.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!validPassword(password)) {
      setError("Password must be at least 8 characters and include uppercase, lowercase, and a special symbol.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.signup({
        name: loginId.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
      setToken(res?.data?.accessToken || null);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Registration failed. Email may already be in use.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md mb-3">
            <BoxIcon className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create an Account</h1>
          <p className="mt-1 text-sm text-slate-500">Get started with StockSense ERP</p>
        </div>

        {/* Signup Card */}
        <Card className="!p-8 shadow-sm">
          <form onSubmit={onSubmit}>
            <Field label="Full Name / User ID">
              <input
                required
                className="form-input"
                placeholder="e.g. Alex Morgan"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
              />
            </Field>

            <Field label="Work Email Address">
              <input
                type="email"
                required
                className="form-input"
                placeholder="alex@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Role in Organization">
              <select
                className="form-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="warehouse_staff">Warehouse Staff (Pick & Pack)</option>
                <option value="inventory_manager">Inventory Manager (Approvals & Ledger)</option>
              </select>
            </Field>

            <Field
              label="Password"
              hint="Min 8 chars, uppercase, lowercase & special character"
            >
              <input
                type="password"
                required
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <Field label="Confirm Password">
              <input
                type="password"
                required
                className="form-input"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertTriangleIcon className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button disabled={busy} type="submit" className="btn-primary w-full py-2.5">
              {busy ? "Registering…" : "Create Account"}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
            <span>Already have an account? </span>
            <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Sign In
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
