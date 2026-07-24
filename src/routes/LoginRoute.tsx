import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiClientError } from "../lib/apiClient";

export default function LoginRoute() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(null);
    try { await login(email, password); } catch (reason) { setError(reason instanceof ApiClientError ? reason.message : "Unable to sign in."); } finally { setBusy(false); }
  };
  return <main className="grid min-h-screen place-items-center bg-[#F7FBFC] px-5"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-panel ring-1 ring-slate-100"><div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal to-sky-500 font-bold text-white">DT</div><p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-teal">Data Transformation Plus</p><h1 className="font-heading mt-2 text-3xl font-bold text-slate-900">Sign in</h1><p className="mt-2 text-sm text-slate-500">Use the account created by your portal administrator.</p><label className="mt-6 block text-sm font-semibold text-slate-700">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="portal-input mt-1.5 w-full" autoComplete="email" /></label><label className="mt-4 block text-sm font-semibold text-slate-700">Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="portal-input mt-1.5 w-full" autoComplete="current-password" /></label>{error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}<button disabled={busy} className="portal-button-primary mt-6 w-full justify-center disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button></form></main>;
}
