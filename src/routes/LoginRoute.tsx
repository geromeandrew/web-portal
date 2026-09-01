import { LogIn, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function LoginRoute() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const originalUri =
    typeof location.state === "object" &&
    location.state &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/";

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(originalUri);
    } catch {
      setError("Unable to start Okta sign-in. Please try again.");
      setBusy(false);
    }
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

      <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal to-sky-500 font-bold text-white shadow-lg shadow-teal/20 md:hidden">DT</div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.12em] text-teal md:mt-0">Data Transformation Plus</p>
        <h1 className="font-heading mt-3 text-4xl font-bold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Continue to Globe Okta to securely access the portal.</p>
        <div className="mt-9 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
          <div className="flex items-start gap-3 text-sm leading-6 text-slate-600"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal" /><span>Authentication and account access are managed by your organization.</span></div>
        </div>
        {error ? <p className="portal-alert mt-5 border-rose-200 bg-rose-50 text-rose-700" role="alert">{error}</p> : null}
        <button type="button" disabled={busy} onClick={() => void signIn()} className="focus-ring portal-button-primary mt-8 w-full justify-center"><LogIn className="h-4 w-4" />{busy ? "Redirecting…" : "Sign in with Okta"}</button>
      </div>
    </section>
  </main>;
}
