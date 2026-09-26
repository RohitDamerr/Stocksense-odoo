"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { Field, Card } from "@/components/ui";
import { BoxIcon, AlertTriangleIcon } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!loginId.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.login({
        email: loginId.trim(),
        password,
      });

      setToken(res?.data?.accessToken || null);

      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Invalid Email or Password.");
    } finally {
      setLoading(false);
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

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign in to StockSense
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Warehouse inventory & fulfillment management
          </p>
        </div>

        {/* Login Card */}
        <Card className="!p-8 shadow-sm">
          <form onSubmit={onSubmit}>
            <Field label="Email Address">
              <input
                type="email"
                required
                className="form-input"
                placeholder="name@company.com"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                autoComplete="email"
              />
            </Field>

            <Field label="Password">
              <div className="flex items-center justify-between mb-1">
                <span />

                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Forgot password?
                </Link>
              </div>

              <input
                type="password"
                required
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>

            {/* Error Message */}
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertTriangleIcon className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              disabled={loading}
              type="submit"
              className="btn-primary w-full py-2.5"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
            <span>Don&apos;t have an account yet? </span>

            <Link
              href="/signup"
              className="font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Create an account
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}