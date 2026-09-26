"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Field } from "@/components/ui";

// OTP flow: forgot-password (always 200) -> verify-otp (resetToken) ->
// reset-password. Dev OTP prints to backend console.
export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function wrap(fn) {
    setMsg(""); setBusy(true);
    try { await fn(); } catch (err) { setMsg(err.message); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4">
      <div className="glass-strong p-8">
        <h1 className="grad-text mb-1 text-center text-2xl font-extrabold">Forget Password</h1>
        <p className="mb-6 text-center text-sm text-violet-900/60">
          {step === 1 ? "Step 1 — send OTP" : step === 2 ? "Step 2 — verify OTP" : "Step 3 — new password"}
        </p>
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); wrap(async () => { await api.forgotPassword({ email }); setStep(2); setMsg("If the account exists, a reset code was sent (dev: check backend console)."); }); }}>
            <Field label="Email Id">
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="glass-input" />
            </Field>
            <button disabled={busy} className="btn-gradient w-full">Send OTP</button>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); wrap(async () => { const r = await api.verifyOtp({ email, otp }); setResetToken(r?.data?.resetToken || ""); setStep(3); }); }}>
            <Field label="6-digit OTP">
              <input value={otp} onChange={(e) => setOtp(e.target.value)} className="glass-input" />
            </Field>
            <button disabled={busy} className="btn-gradient w-full">Verify OTP</button>
          </form>
        )}
        {step === 3 && (
          <form onSubmit={(e) => { e.preventDefault(); wrap(async () => { await api.resetPassword({ resetToken, newPassword: pw }); setMsg("Password reset. Please log in."); }); }}>
            <Field label="New password (min 8, letter + digit)">
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="glass-input" />
            </Field>
            <button disabled={busy} className="btn-gradient w-full">Reset Password</button>
          </form>
        )}
        {msg && <p className="mt-3 rounded-xl bg-white/60 px-3 py-2 text-sm text-violet-900">{msg}</p>}
        <div className="mt-3 text-center text-sm text-violet-900/70">
          <Link href="/login" className="font-semibold underline decoration-fuchsia-400">Back to Login</Link>
        </div>
      </div>
    </main>
  );
}
