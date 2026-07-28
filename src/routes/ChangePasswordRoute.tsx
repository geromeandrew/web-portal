import { KeyRound, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { ApiClientError } from "../lib/apiClient";

export default function ChangePasswordRoute() {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(null); try { await changePassword(currentPassword, newPassword); } catch (reason) { setError(reason instanceof ApiClientError ? reason.message : "Unable to change password."); } finally { setBusy(false); } };

  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#F7FBFC] px-5 py-10">
    <div className="absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-teal/10 blur-3xl" />
    <form onSubmit={submit} className="relative w-full max-w-xl overflow-hidden rounded-[2rem] bg-white p-8 shadow-[0_30px_90px_rgba(27,46,110,0.14)] ring-1 ring-slate-200/70 sm:p-12">
      <div className="absolute right-0 top-0 h-36 w-36 rounded-bl-[6rem] bg-gradient-to-br from-mint to-sky-100" />
      <span className="relative grid h-[52px] w-[52px] place-items-center rounded-[15px] bg-teal/10 text-teal"><ShieldCheck className="h-6 w-6" /></span>
      <p className="relative mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-teal">Account security</p>
      <h1 className="font-heading relative mt-3 text-4xl font-bold tracking-tight text-slate-900">Set a new password</h1>
      <p className="relative mt-3 text-sm leading-6 text-slate-500">Your temporary password must be changed before using the portal.</p>
      <label className="mt-9 block text-sm font-semibold text-slate-700">Temporary password<span className="relative mt-2 block"><KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="portal-input w-full pl-10" /></span></label>
      <label className="mt-5 block text-sm font-semibold text-slate-700">New password<span className="relative mt-2 block"><KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required minLength={12} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="portal-input w-full pl-10" /></span></label>
      {error ? <p className="portal-alert mt-5 border-rose-200 bg-rose-50 text-rose-700" role="alert">{error}</p> : null}
      <button disabled={busy} className="focus-ring portal-button-primary mt-8 w-full justify-center">{busy ? "Saving…" : "Save password"}</button>
    </form>
  </main>;
}
