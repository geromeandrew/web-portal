import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getUserDisplayName } from "../lib/userDisplay";
import { workspaces, workspaceHref } from "../lib/workspaces";
import { cn } from "../lib/utils";
import globeLogo from "../assets/globe-logo.png";
import userIcon from "../assets/user-icon.svg";

const shellUi = {
  shell: "min-h-screen bg-[#f2f7fe] text-[#121926]",
  header: "sticky top-0 z-40 border-b border-[#edf1f7] bg-white",
  headerContent: "mx-auto flex h-[72px] w-full max-w-none items-center justify-between px-5 sm:px-8 lg:w-[84.7%] lg:px-0",
  logo: "focus-ring rounded-md font-elliot text-[21px] font-bold tracking-[-0.045em] text-[#244797] 2xl:text-[24px]",
  desktopNav: "hidden h-full items-center gap-7 lg:flex",
  navLink: "focus-ring relative flex h-full items-center font-elliot text-[13px] font-medium text-[#151923] transition-colors hover:text-[#087dca] 2xl:text-[15px]",
  activeNav: "text-[#087dca] after:absolute after:inset-x-[-12px] after:bottom-0 after:h-1 after:bg-[#087dca]",
  menuButton: "focus-ring flex h-full items-center gap-1 font-elliot text-[13px] font-medium text-[#151923] transition-colors hover:text-[#087dca] 2xl:text-[15px]",
  popover: "absolute left-1/2 top-[calc(100%+10px)] z-50 w-72 -translate-x-1/2 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-[0_12px_28px_rgba(16,35,70,0.15)]",
  popoverLink: "block px-4 py-3 font-elliot text-[13px] text-slate-700 transition-colors hover:bg-[#f1f7ff] hover:text-[#087dca]",
  account: "hidden items-center gap-2 font-elliot text-[12px] text-[#171b24] xl:flex 2xl:text-[14px]",
  signOut: "focus-ring grid h-8 w-8 place-items-center border-l border-[#d9dfe8] pl-2 text-[#1d2634] transition-colors hover:text-[#087dca]",
  globe: "hidden sm:block",
  globeLogo: "h-[30px] w-auto 2xl:h-[35px]",
  mobileButton: "focus-ring grid h-9 w-9 place-items-center text-[#1d2634] lg:hidden",
  mobileNav: "border-t border-slate-100 bg-white px-5 py-3 sm:px-8 lg:hidden",
  mobileLink: "block rounded-md px-3 py-3 font-elliot text-sm text-slate-700 hover:bg-[#f1f7ff] hover:text-[#087dca]",
};

function WorkspaceMenu({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="py-1" aria-label="Workspace links">
      {workspaces.map((workspace) => (
        <Link key={workspace.id} to={workspaceHref(workspace)} onClick={onNavigate} className={shellUi.popoverLink}>
          {workspace.title}
        </Link>
      ))}
    </div>
  );
}

export default function AppShell() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [administratorOpen, setAdministratorOpen] = useState(false);
  const { logout, user } = useAuth();
  const closeMenus = () => {
    setMobileOpen(false);
    setWorkspaceOpen(false);
    setAdministratorOpen(false);
  };

  return (
    <div className={shellUi.shell}>
      <header className={shellUi.header}>
        <div className={shellUi.headerContent}>
          <NavLink to="/" end onClick={closeMenus} className={shellUi.logo} aria-label="ES-ATP Dashboard">ES-ATP</NavLink>

          <nav className={shellUi.desktopNav} aria-label="Primary navigation">
            <NavLink to="/" end onClick={closeMenus} className={({ isActive }) => cn(shellUi.navLink, isActive && shellUi.activeNav)}>Dashboard</NavLink>
            <div className="relative h-full">
              <button type="button" onClick={() => { setWorkspaceOpen((open) => !open); setAdministratorOpen(false); }} className={cn(shellUi.menuButton, location.pathname === "/processing-pipelines" && shellUi.activeNav)} aria-expanded={workspaceOpen} aria-controls="workspace-menu">
                Workspace <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {workspaceOpen ? <div id="workspace-menu" className={shellUi.popover}><WorkspaceMenu onNavigate={closeMenus} /></div> : null}
            </div>
            <div className="relative h-full">
              <button type="button" onClick={() => { setAdministratorOpen((open) => !open); setWorkspaceOpen(false); }} className={shellUi.menuButton} aria-expanded={administratorOpen} aria-controls="administrator-menu">
                Administrator <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {administratorOpen ? <div id="administrator-menu" className={shellUi.popover}><span className="block px-4 py-3 font-elliot text-[13px] text-slate-400" aria-disabled="true">Coming soon</span></div> : null}
            </div>
          </nav>

          <div className="flex items-center gap-3">
            <div className={shellUi.account} title={user?.email}><img src={userIcon} alt="" className="h-4 w-4" />{getUserDisplayName(user?.email)}</div>
            <button type="button" onClick={() => void logout()} className={shellUi.signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
            <img src={globeLogo} alt="Globe" className={shellUi.globeLogo} />
            <button type="button" onClick={() => setMobileOpen((open) => !open)} className={shellUi.mobileButton} aria-label="Toggle navigation" aria-expanded={mobileOpen}>{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>

        {mobileOpen ? <nav className={shellUi.mobileNav} aria-label="Mobile navigation">
          <NavLink to="/" end onClick={closeMenus} className={shellUi.mobileLink}>Dashboard</NavLink>
          <p className="px-3 pb-1 pt-4 font-elliot text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Workspace</p>
          <WorkspaceMenu onNavigate={closeMenus} />
          <p className="px-3 pb-3 pt-4 font-elliot text-[13px] text-slate-400">Administrator — Coming soon</p>
        </nav> : null}
      </header>

      <main className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-none px-5 py-10 sm:px-8 sm:py-12 lg:w-[84.7%] lg:px-0 lg:py-14"><Outlet /></main>
    </div>
  );
}
