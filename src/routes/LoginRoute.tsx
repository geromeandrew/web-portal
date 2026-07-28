import { LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiClientError } from "../lib/apiClient";

export default function LoginRoute() {
  const { user, login } = useAuth();
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

  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#F7FBFC] px-5 py-10">
    <div className="absolute -left-28 -top-28 h-[30rem] w-[30rem] rounded-full bg-teal/10 blur-3xl" />
    <div className="absolute -bottom-36 -right-24 h-[32rem] w-[32rem] rounded-full bg-sky-200/45 blur-3xl" />
    <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-[0_32px_100px_rgba(27,46,110,0.16)] ring-1 ring-slate-200/70 md:min-h-[620px] md:grid-cols-[.9fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-navy p-12 text-white md:flex md:flex-col md:justify-between">
        <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full border-[54px] border-teal/20" />
        <div className="absolute right-12 top-16 h-20 w-20 rounded-full bg-teal/20 blur-2xl" />
        <div className="relative grid h-12 w-12 place-items-center rounded-[15px] bg-gradient-to-br from-teal to-sky-500 text-sm font-bold text-white shadow-lg shadow-teal/20">DT</div>
        <p className="relative font-heading max-w-xs text-4xl font-bold leading-tight tracking-tight">Data Transformation Plus</p>
      </div>

      <form onSubmit={submit} className="flex flex-col justify-center p-8 sm:p-12 lg:p-16">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal to-sky-500 font-bold text-white shadow-lg shadow-teal/20 md:hidden">DT</div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.12em] text-teal md:mt-0">Data Transformation Plus</p>
        <h1 className="font-heading mt-3 text-4xl font-bold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Use the account created by your portal administrator.</p>
        <label className="mt-9 block text-sm font-semibold text-slate-700">Email<span className="relative mt-2 block"><Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="portal-input w-full pl-10" autoComplete="email" /></span></label>
        <label className="mt-5 block text-sm font-semibold text-slate-700">Password<span className="relative mt-2 block"><LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="portal-input w-full pl-10" autoComplete="current-password" /></span></label>
        {error ? <p className="portal-alert mt-5 border-rose-200 bg-rose-50 text-rose-700" role="alert">{error}</p> : null}
        <button disabled={busy} className="focus-ring portal-button-primary mt-8 w-full justify-center">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </section>
  </main>;
}
