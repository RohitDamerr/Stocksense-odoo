"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { Field } from "@/components/ui";

// Excalidraw Login Page: Login Id + Password + SIGN IN.
// Backend authenticates by email — the Login Id field accepts email.
export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!loginId.trim() || !password) {
      setError("Invalid Login Id or Password");
      return;
    }
    setBusy(true);
    try {
      const res = await api.login({ email: loginId.trim(), password });
      setToken(res?.data?.accessToken || null);
      router.push("/dashboard");
    } catch {
      setError("Invalid Login Id or Password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4">
      <div className="glass-strong p-8">
        <div className="mb-1 text-center text-3xl">📦</div>
        <h1 className="grad-text mb-1 text-center text-3xl font-extrabold">StockSense</h1>
        <p className="mb-6 text-center text-sm text-violet-900/60">Login Page</p>
        <form onSubmit={onSubmit}>
          <Field label="Login Id">
            <input
              className="glass-input"
              placeholder="email / login id"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              className="glass-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          {error && (
            <p className="mb-3 rounded-xl border border-rose-300/60 bg-rose-100/60 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          <button disabled={busy} className="btn-gradient w-full">
            {busy ? "Signing in…" : "SIGN IN"}
          </button>
          <div className="mt-4 text-center text-sm text-violet-900/70">
            <Link href="/forgot-password" className="font-semibold underline decoration-fuchsia-400">
              Forget Password ?
            </Link>
            {" | "}
            <Link href="/signup" className="font-semibold underline decoration-fuchsia-400">
              Sign Up
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
