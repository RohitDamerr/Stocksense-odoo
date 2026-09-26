"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { Field } from "@/components/ui";

// Excalidraw Sign up Page rules:
// 1. login ID unique, 6-12 chars. 2. email not duplicate. 3. password: lower +
// upper + special, >8 chars. Backend maps loginId -> name.
function validPassword(pw) {
  return (
    pw.length > 8 &&
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
    if (loginId.trim().length < 6 || loginId.trim().length > 12) {
      setError("Login ID must be unique and 6-12 characters.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid Email Id.");
      return;
    }
    if (!validPassword(password)) {
      setError("Password must be >8 chars with a small case, a large case and a special character.");
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
      setError(err.message || "Signup failed (email may be duplicate).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="glass-strong p-8">
        <div className="mb-1 text-center text-3xl">📦</div>
        <h1 className="grad-text mb-1 text-center text-3xl font-extrabold">StockSense</h1>
        <p className="mb-6 text-center text-sm text-violet-900/60">Sign up Page</p>
        <form onSubmit={onSubmit}>
          <Field label="Enter Login Id (6-12 chars)">
            <input className="glass-input" value={loginId} onChange={(e) => setLoginId(e.target.value)} />
          </Field>
          <Field label="Enter Email Id">
            <input className="glass-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Enter Password">
            <input type="password" className="glass-input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Re-Enter Password">
            <input type="password" className="glass-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Field label="Role">
            <select className="glass-input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="warehouse_staff">warehouse_staff</option>
              <option value="inventory_manager">inventory_manager</option>
            </select>
          </Field>
          {error && (
            <p className="mb-3 rounded-xl border border-rose-300/60 bg-rose-100/60 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          <button disabled={busy} className="btn-gradient w-full">
            {busy ? "Creating…" : "SIGN UP"}
          </button>
          <div className="mt-4 text-center text-sm text-violet-900/70">
            <Link href="/login" className="font-semibold underline decoration-fuchsia-400">
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
