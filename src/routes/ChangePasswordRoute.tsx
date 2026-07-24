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
  return <main className="grid min-h-screen place-items-center bg-[#F7FBFC] px-5"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-panel ring-1 ring-slate-100"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal">Account security</p><h1 className="font-heading mt-2 text-3xl font-bold text-slate-900">Set a new password</h1><p className="mt-2 text-sm text-slate-500">Your temporary password must be changed before using the portal.</p><label className="mt-6 block text-sm font-semibold text-slate-700">Temporary password<input required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="portal-input mt-1.5 w-full" /></label><label className="mt-4 block text-sm font-semibold text-slate-700">New password<input required minLength={12} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="portal-input mt-1.5 w-full" /></label>{error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}<button disabled={busy} className="portal-button-primary mt-6 w-full justify-center disabled:opacity-50">{busy ? "Saving…" : "Save password"}</button></form></main>;
}
