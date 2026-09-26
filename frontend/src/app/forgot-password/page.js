"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Field, Card } from "@/components/ui";
import { BoxIcon, ArrowLeftIcon, AlertTriangleIcon, CheckCircleIcon } from "@/components/icons";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function wrap(fn) {
    setMsg("");
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset Password</h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === 1 && "Step 1: Request a one-time verification code"}
            {step === 2 && "Step 2: Enter the 6-digit OTP code sent to your email"}
            {step === 3 && "Step 3: Create a new secure password"}
          </p>
        </div>

        {/* Form Card */}
        <Card className="!p-8 shadow-sm">
          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                wrap(async () => {
                  await api.forgotPassword({ email });
                  setStep(2);
                  setMsg("A verification OTP code was sent to your email address.");
                });
              }}
            >
              <Field label="Your Account Email">
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                />
              </Field>
              <button disabled={busy} type="submit" className="btn-primary w-full py-2.5">
                {busy ? "Sending Code…" : "Send Verification Code"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                wrap(async () => {
                  const r = await api.verifyOtp({ email, otp });
                  setResetToken(r?.data?.resetToken || "");
                  setStep(3);
                });
              }}
            >
              <Field label="6-Digit OTP Code" hint="Check backend console in dev environment">
                <input
                  required
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="form-input font-mono text-center tracking-widest text-lg"
                />
              </Field>
              <button disabled={busy} type="submit" className="btn-primary w-full py-2.5">
                {busy ? "Verifying…" : "Verify Code"}
              </button>
            </form>
          )}

          {step === 3 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                wrap(async () => {
                  await api.resetPassword({ resetToken, newPassword: pw });
                  setMsg("Password has been reset successfully. You can now log in.");
                });
              }}
            >
              <Field label="New Password" hint="Minimum 8 characters with letters & numbers">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="form-input"
                />
              </Field>
              <button disabled={busy} type="submit" className="btn-primary w-full py-2.5">
                {busy ? "Saving…" : "Update Password"}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertTriangleIcon className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {msg && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{msg}</span>
            </div>
          )}

          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeftIcon className="h-3 w-3" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
