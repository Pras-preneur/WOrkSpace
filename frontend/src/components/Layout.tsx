import { ReactNode, useState } from "react";
import { LuLayoutDashboard, LuListChecks, LuFolderKanban, LuUsers, LuBuilding2, LuChartColumn, LuActivity, LuBell, LuMoon, LuSun,
  LuLogOut, LuMenu, LuClock, LuTriangleAlert, LuUserPlus, LuKeyRound, LuTarget } from "react-icons/lu";
import { Link, navigate, usePath } from "../lib/router";
import { useAuth, useTheme, useToast } from "../lib/store";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";
import { Avatar, Button, Dropdown, Field, Modal } from "./ui";
import { cx } from "../lib/utils";

export const Logo = ({ size = 36 }: { size?: number }) => (
  <span className="brand-mark" style={{ width: size, height: size }}>
    <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="14" stroke="#fff" strokeWidth="6" /><circle cx="48" cy="16" r="6" fill="#fff" /></svg>
  </span>
);

const TITLES: [string, string][] = [["/projects", "Projects"], ["/tasks", "All tasks"], ["/my-tasks", "My tasks"], ["/team", "Team"],
  ["/clients", "Clients"], ["/analytics", "Analytics"], ["/activity", "Activity"], ["/", "Dashboard"]];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, isStaff } = useAuth();
  const path = usePath();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(false);
  const notes = useQuery<{ count: number; items: any[] }>("/notifications", () => api.get("/notifications"));
  const title = (TITLES.find(([p]) => (p === "/" ? path === "/" : path.startsWith(p))) || ["", ""])[1];
  const nav = [
    { to: "/", label: "Dashboard", icon: <LuLayoutDashboard /> },
    { to: "/my-tasks", label: "My tasks", icon: <LuTarget />, count: notes.data?.items.filter((i) => i.kind === "overdue").length },
    { to: "/projects", label: "Projects", icon: <LuFolderKanban /> },
    ...(isStaff ? [{ to: "/tasks", label: "All tasks", icon: <LuListChecks /> }] : []),
    { to: "/team", label: "Team", icon: <LuUsers /> },
    ...(isStaff ? [{ to: "/clients", label: "Clients", icon: <LuBuilding2 /> }, { to: "/analytics", label: "Analytics", icon: <LuChartColumn /> }] : []),
    { to: "/activity", label: "Activity", icon: <LuActivity /> },
  ];
  return (
    <div className="shell">
      <div className={cx("scrim", open && "open")} onClick={() => setOpen(false)} />
      <aside className={cx("sidebar", open && "open")}>
        <div className="brand"><Logo /><div><div className="brand-name">OriginTheory</div><div className="brand-sub">Workspace</div></div></div>
        <nav className="nav" onClick={() => setOpen(false)} aria-label="Main">
          <div className="nav-label">Workspace</div>
          {nav.map((n) => (
            <Link key={n.to} to={n.to} nav className="">{n.icon}{n.label}{n.count ? <span className="count">{n.count}</span> : null}</Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Link to={`/team/${user!.id}`} className="me-card"><Avatar name={user!.name} color={user!.avatar_color} size={36} />
            <div style={{ minWidth: 0 }}><div className="name truncate">{user!.name}</div><div className="role">{user!.role}</div></div></Link>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Button variant="ghost" icon className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><LuMenu /></Button>
          <h1>{title}</h1><div className="grow" />
          <Dropdown trigger={(o, t) => (
            <Button variant="ghost" icon onClick={t} aria-label="Notifications" style={{ position: "relative" }}>
              <LuBell />{!!notes.data?.count && <span style={{ position: "absolute", top: 6, right: 6, width: 9, height: 9, borderRadius: 9, background: "var(--danger)", border: "2px solid var(--bg)" }} />}
            </Button>)}>
            {(close) => (
              <div className="popover">
                <div className="row between" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
                  <b>Notifications</b><span className="badge">{notes.data?.count ?? 0}</span>
                </div>
                <div style={{ maxHeight: 380, overflowY: "auto" }}>
                  {!notes.data?.items.length && <div className="empty" style={{ padding: 28 }}>You're all caught up 🎉</div>}
                  {notes.data?.items.map((n, i) => (
                    <div key={i} className="list-item click" onClick={() => { close(); navigate(`/projects/${n.project_id}?task=${n.task_id}`); }}>
                      <span className={cx("tl-ico", n.kind === "overdue" ? "tone-danger" : n.kind === "due_soon" ? "tone-warning" : "")} style={{ width: 34, height: 34 }}>
                        {n.kind === "assigned" ? <LuUserPlus /> : n.kind === "overdue" ? <LuTriangleAlert /> : <LuClock />}
                      </span>
                      <div style={{ minWidth: 0 }}><div className="bold truncate small">{n.title}</div>
                        <div className={cx("xs", n.kind === "overdue" ? "" : "muted")} style={n.kind === "overdue" ? { color: "var(--danger)" } : {}}>{n.message}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Dropdown>
          <Button variant="ghost" icon onClick={toggle} aria-label="Toggle theme">{theme === "dark" ? <LuSun /> : <LuMoon />}</Button>
          <Dropdown trigger={(o, t) => <button onClick={t} aria-label="Account menu" style={{ border: 0, background: "none", padding: 0, display: "flex" }}><Avatar name={user!.name} color={user!.avatar_color} size={36} /></button>}>
            {(close) => (
              <div className="menu">
                <div style={{ padding: "8px 11px 10px", borderBottom: "1px solid var(--border)", marginBottom: 6 }}><div className="bold">{user!.name}</div><div className="xs muted">{user!.email}</div></div>
                <button onClick={() => { close(); navigate(`/team/${user!.id}`); }}><LuUsers size={16} />My profile</button>
                <button onClick={() => { close(); setPw(true); }}><LuKeyRound size={16} />Change password</button>
                <button className="danger" onClick={logout}><LuLogOut size={16} />Sign out</button>
              </div>
            )}
          </Dropdown>
        </header>
        <main className="page">{children}</main>
      </div>
      {pw && <PasswordModal onClose={() => setPw(false)} />}
    </div>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [cur, setCur] = useState(""), [next, setNext] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const submit = async () => {
    setBusy(true); setErr("");
    try { await api.post("/auth/change-password", { current_password: cur, new_password: next }); toast("Password updated"); onClose(); }
    catch (e: any) { setErr(e.details?.[0]?.message || e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Change password" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || next.length < 8 || !cur} onClick={submit}>Update password</Button></>}>
      <div className="col">
        <Field label="Current password"><input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></Field>
        <Field label="New password (min 8 characters)" error={err}><input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
      </div>
    </Modal>
  );
}
