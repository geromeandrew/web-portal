import { CheckCircle2, KeyRound, Mail, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { apiRequest, ApiClientError } from "../lib/apiClient";
import type { UserDto } from "../lib/apiTypes";

export default function AdminUsersRoute() {
  const { user } = useAuth();
  const [users, setUsers] = useState<Array<UserDto & { isActive: boolean }>>([]);
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => { const response = await apiRequest<{ users: Array<UserDto & { isActive: boolean }> }>("/admin/users"); setUsers(response.users); };
  useEffect(() => { if (user?.isBootstrapAdmin) void load().catch(() => setError("Unable to load users.")); }, [user?.isBootstrapAdmin]);
  if (!user?.isBootstrapAdmin) return <p className="portal-alert border-rose-200 bg-rose-50 text-rose-700">You do not have access to user management.</p>;
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(null); try { await apiRequest("/admin/users", { method: "POST", body: JSON.stringify({ email, temporaryPassword }) }); setEmail(""); setTemporaryPassword(""); await load(); } catch (reason) { setError(reason instanceof ApiClientError ? reason.message : "Unable to create user."); } finally { setBusy(false); } };
  const toggle = async (candidate: UserDto & { isActive: boolean }) => { try { await apiRequest(`/admin/users/${candidate.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !candidate.isActive }) }); await load(); } catch (reason) { setError(reason instanceof ApiClientError ? reason.message : "Unable to update user."); } };

  return <div className="space-y-10 pb-4">
    <section className="relative min-h-[220px] overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-mint via-sky-50 to-[#edf1ff] px-7 py-10 shadow-[0_20px_60px_rgba(27,46,110,0.09)] ring-1 ring-white sm:px-10 sm:py-12 lg:px-12">
      <div className="absolute -bottom-24 right-10 h-56 w-56 rounded-full border-[36px] border-white/35" />
      <div className="relative flex min-h-[130px] flex-col justify-center"><p className="portal-eyebrow">Administration</p><h1 className="font-heading mt-3 text-[34px] font-bold tracking-tight text-slate-900">User accounts</h1><p className="mt-3 max-w-2xl text-[14px] leading-7 text-slate-500">Every active user has the same portal permissions and a private workspace.</p></div>
    </section>

    <form onSubmit={submit} className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_22px_64px_rgba(27,46,110,0.08)] ring-1 ring-slate-200/70">
      <div className="grid gap-6 p-7 sm:p-9 lg:grid-cols-[1fr_1fr_auto] lg:items-end lg:p-10">
        <label className="text-[13px] font-semibold text-slate-700">Email<span className="relative mt-2 block"><Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="portal-input w-full pl-10" /></span></label>
        <label className="text-[13px] font-semibold text-slate-700">Temporary password<span className="relative mt-2 block"><KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required minLength={12} type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} className="portal-input w-full pl-10" /></span></label>
        <button disabled={busy} className="focus-ring portal-button-primary h-11 justify-center"><UserPlus className="h-4 w-4" />Create user</button>
      </div>
    </form>

    {error ? <p className="portal-alert border-rose-200 bg-rose-50 text-rose-700" role="alert"><XCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p> : null}

    <section className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_22px_64px_rgba(27,46,110,0.08)] ring-1 ring-slate-200/70">
      <div className="overflow-x-auto"><table className="min-w-full text-left text-[13px]"><thead className="bg-slate-50/80 text-[10px] uppercase tracking-[0.11em] text-slate-500"><tr><th className="px-7 py-4 font-bold">Email</th><th className="px-7 py-4 font-bold">Status</th><th className="px-7 py-4 font-bold">Created</th><th className="px-7 py-4" /></tr></thead><tbody>{users.map((candidate) => <tr key={candidate.id} className="border-t border-slate-100 transition hover:bg-teal/[0.025]"><td className="px-7 py-5 font-medium text-slate-700">{candidate.email}{candidate.isBootstrapAdmin ? <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-navy/8 px-2.5 py-1 text-[10px] font-bold text-navy"><ShieldCheck className="h-3 w-3" />Bootstrap admin</span> : null}</td><td className="px-7 py-5"><span className={`portal-status ${candidate.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{candidate.isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{candidate.isActive ? "Active" : "Inactive"}</span></td><td className="px-7 py-5 text-slate-500">{new Date(candidate.createdAt).toLocaleDateString()}</td><td className="px-7 py-5 text-right"><button disabled={candidate.id === user.id} onClick={() => void toggle(candidate)} className="focus-ring rounded-lg px-2 py-1 text-[12px] font-semibold text-teal hover:bg-teal/5 disabled:text-slate-300">{candidate.isActive ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
