import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../lib/apiClient";

type Module = { moduleId: string; moduleName: string; isActive: boolean };
type Account = { id: string; email: string; firstName: string | null; lastName: string | null; isActive: boolean; isAdmin: boolean; moduleIds: string[] };

export default function AdminUsersRoute() {
  const [users, setUsers] = useState<Account[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const load = async () => {
    try {
      const [accounts, moduleList] = await Promise.all([
        apiRequest<{ users: Account[] }>("/admin/users"),
        apiRequest<{ modules: Module[] }>("/admin/modules"),
      ]);
      setUsers(accounts.users); setModules(moduleList.modules);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to load access administration."); }
  };
  useEffect(() => { void load(); }, []);
  const toggle = async (account: Account, module: Module) => {
    const assigned = account.moduleIds.includes(module.moduleId);
    try {
      await apiRequest(`/admin/users/${account.id}/modules/${module.moduleId}`, { method: assigned ? "DELETE" : "PUT" });
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to update assignment."); }
  };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    try { await apiRequest("/admin/users", { method: "POST", body: JSON.stringify({ email }) }); setEmail(""); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create account."); }
  };
  const update = async (account: Account, field: "isActive" | "isAdmin") => {
    try { await apiRequest(`/admin/users/${account.id}`, { method: "PATCH", body: JSON.stringify({ [field]: !account[field] }) }); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to update account."); }
  };
  return <section className="space-y-6">
    <div><p className="portal-eyebrow">Administrator</p><h1 className="portal-section-title mt-2">User workspace access</h1><p className="mt-2 text-sm text-slate-500">Assign active users to the workspaces they may operate.</p></div>
    <form onSubmit={create} className="portal-panel flex flex-wrap items-end gap-3 p-5"><label className="text-sm font-semibold">Pre-provision user email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="portal-input mt-1 block" /></label><button className="portal-button-primary" type="submit">Add user</button></form>
    {notice ? <p className="portal-alert border-rose-200 bg-rose-50 text-rose-700">{notice}</p> : null}
    <div className="portal-panel overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-4">User</th><th className="p-4">Status</th><th className="p-4">Workspaces</th></tr></thead><tbody>{users.map((account) => <tr key={account.id} className="border-b align-top"><td className="p-4"><b>{account.email}</b><br /><span className="text-slate-500">{[account.firstName, account.lastName].filter(Boolean).join(" ") || "No profile name"}</span></td><td className="p-4"><button className="underline" onClick={() => void update(account, "isActive")}>{account.isActive ? "Active" : "Inactive"}</button><br /><button className="underline" onClick={() => void update(account, "isAdmin")}>{account.isAdmin ? "Administrator" : "Business user"}</button></td><td className="p-4"><div className="grid gap-2 md:grid-cols-2">{modules.filter((module) => module.isActive).map((module) => <label key={module.moduleId} className="flex gap-2"><input type="checkbox" checked={account.isAdmin || account.moduleIds.includes(module.moduleId)} disabled={account.isAdmin} onChange={() => void toggle(account, module)} />{module.moduleName}</label>)}</div></td></tr>)}</tbody></table></div>
  </section>;
}
