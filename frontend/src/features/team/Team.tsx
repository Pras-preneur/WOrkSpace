import { useMemo, useState } from "react";
import { LuUserPlus, LuSearch, LuMail, LuEllipsis, LuPencil, LuUserX, LuUserCheck } from "react-icons/lu";
import { api, qs } from "../../lib/api";
import { invalidate, useQuery } from "../../lib/query";
import { useAuth, useToast } from "../../lib/store";
import { navigate } from "../../lib/router";
import { Avatar, Button, Dropdown, Empty, ErrorState, Field, Modal, Skeleton, TagInput } from "../../components/ui";
import { fieldErrors } from "../../lib/hooks";
import { AVATAR_COLORS, cx } from "../../lib/utils";
import { User } from "../../lib/types";

const ROLE_TONE: Record<string, string> = { Admin: "primary", "Project Manager": "info", "Team Member": "", Client: "warning" };

export default function Team() {
  const { isAdmin } = useAuth(); const toast = useToast();
  const [search, setSearch] = useState(""), [role, setRole] = useState(""), [status, setStatus] = useState("active"), [skill, setSkill] = useState("");
  const [form, setForm] = useState<User | "new" | null>(null);
  const key = `/users${qs({ search, role, skill, status: status === "active" ? "" : status })}`;
  const { data, loading, error, refetch } = useQuery<User[]>(key, () => api.get(key));
  const all = useQuery<User[]>("/users", () => api.get("/users"));
  const skills = useMemo(() => Array.from(new Set((all.data ?? []).flatMap((u) => u.skills))).sort(), [all.data]);

  const toggleActive = async (u: User) => {
    try {
      if (u.active) await api.del(`/users/${u.id}`); else await api.patch(`/users/${u.id}`, { active: true });
      invalidate(); toast(u.active ? `${u.name} deactivated` : `${u.name} reactivated`);
    } catch (e: any) { toast(e.message, "error"); }
  };

  return (
    <>
      <div className="page-head"><div><h2>Team</h2><p>Everyone at OriginTheory, their responsibilities and current load.</p></div>
        {isAdmin && <Button variant="primary" onClick={() => setForm("new")}><LuUserPlus />Add team member</Button>}</div>
      <div className="row wrap mb-16">
        <div className="search" style={{ width: 280 }}><LuSearch /><input className="input" placeholder="Search name, role, skill…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search team" /></div>
        <select className="select" style={{ width: 170 }} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role"><option value="">All roles</option><option>Admin</option><option>Project Manager</option><option>Team Member</option></select>
        <select className="select" style={{ width: 150 }} value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skill"><option value="">All skills</option>{skills.map((s) => <option key={s}>{s}</option>)}</select>
        {isAdmin && <select className="select" style={{ width: 140 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select>}
      </div>
      {loading && !data ? <div className="grid g-cards">{[1, 2, 3].map((i) => <Skeleton key={i} h={300} r={14} />)}</div> : error ? <ErrorState error={error} retry={refetch} /> :
        !data?.length ? <div className="card"><Empty title="No team members found" text="Try a different search or filter." /></div> : (
        <div className="grid g-cards">
          {data.map((u) => (
            <article key={u.id} className={cx("card hover", !u.active && "muted")} style={{ overflow: "hidden", opacity: u.active ? 1 : .65 }} onClick={() => navigate(`/team/${u.id}`)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`/team/${u.id}`)}>
              <div style={{ height: 64, background: `linear-gradient(135deg, ${u.avatar_color}, ${u.avatar_color}66)` }} />
              <div style={{ padding: "0 20px 20px", marginTop: -32 }}>
                <div className="row between" style={{ alignItems: "flex-end" }}>
                  <span style={{ borderRadius: "50%", border: "4px solid var(--surface)", display: "inline-flex" }}><Avatar name={u.name} color={u.avatar_color} size={64} /></span>
                  <div className="row gap-6" onClick={(e) => e.stopPropagation()}>
                    <span className={cx("badge", ROLE_TONE[u.role])}>{u.role}</span>
                    {isAdmin && <Dropdown trigger={(o, t) => <Button variant="ghost" size="sm" icon onClick={t} aria-label={`Actions for ${u.name}`}><LuEllipsis /></Button>}>{(close) => (
                      <div className="menu"><button onClick={() => { close(); setForm(u); }}><LuPencil size={15} />Edit profile</button>
                        <button className={u.active ? "danger" : ""} onClick={() => { close(); toggleActive(u); }}>{u.active ? <><LuUserX size={15} />Deactivate</> : <><LuUserCheck size={15} />Reactivate</>}</button></div>)}</Dropdown>}
                  </div>
                </div>
                <h3 style={{ fontSize: 17, marginTop: 12 }}>{u.name}{!u.active && <span className="badge" style={{ marginLeft: 8 }}>Inactive</span>}</h3>
                <div className="small text-2">{u.title}</div>
                <div className="small mt-12" style={{ color: "var(--primary-ink)", fontWeight: 600 }}>{u.primary_responsibility}</div>
                <div className="row wrap gap-6 mt-12">{u.skills.slice(0, 4).map((s) => <span key={s} className="chip">{s}</span>)}{u.skills.length > 4 && <span className="chip">+{u.skills.length - 4}</span>}</div>
                <div className="divider" />
                <div className="row between small"><span className="muted row gap-6 truncate"><LuMail size={14} />{u.email}</span></div>
                <div className="row gap-8 mt-12">
                  <div className="stat-mini grow"><b>{u.stats?.open ?? 0}</b><span>Open</span></div>
                  <div className="stat-mini grow"><b style={{ color: u.stats?.overdue ? "var(--danger)" : undefined }}>{u.stats?.overdue ?? 0}</b><span>Overdue</span></div>
                  <div className="stat-mini grow"><b>{u.stats?.done ?? 0}</b><span>Done</span></div>
                </div>
              </div>
            </article>))}
        </div>)}
      {form && <UserForm user={form === "new" ? undefined : form} onClose={() => setForm(null)} />}
    </>
  );
}

export function UserForm({ user, onClose }: { user?: User; onClose: () => void }) {
  const toast = useToast(); const { user: me, reloadMe } = useAuth();
  const [f, setF] = useState<any>({
    name: user?.name ?? "", email: user?.email ?? "", role: user?.role ?? "Team Member", password: "", title: user?.title ?? "",
    primary_responsibility: user?.primary_responsibility ?? "", responsibilities: user?.responsibilities ?? [], skills: user?.skills ?? [],
    phone: user?.phone ?? "", bio: user?.bio ?? "", avatar_color: user?.avatar_color ?? AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  });
  const [err, setErr] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const editingSelf = user?.id === me?.id;
  const save = async () => {
    setBusy(true); setErr({});
    try {
      if (user) { const { email, password, ...rest } = f; await api.patch(`/users/${user.id}`, { ...rest, ...(password ? { password } : {}), ...(editingSelf ? { role: undefined } : {}) }); if (editingSelf) await reloadMe(); }
      else await api.post("/users", f);
      toast(user ? "Profile updated" : `${f.name} added to the team`); invalidate(); onClose();
    } catch (e: any) { setErr(fieldErrors(e)); } finally { setBusy(false); }
  };
  return (
    <Modal wide title={user ? `Edit ${user.name}` : "Add team member"} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || f.name.trim().length < 2 || (!user && (!f.email || f.password.length < 8))} onClick={save}>{busy ? "Saving…" : user ? "Save changes" : "Add member"}</Button></>}>
      {err._ && <div className="badge danger mb-12" role="alert" style={{ height: "auto", padding: "8px 12px", whiteSpace: "normal" }}>{err._}</div>}
      <div className="form-grid">
        <Field label="Full name" error={err.name}><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
        <Field label="Work email" error={err.email}><input className="input" type="email" value={f.email} disabled={!!user} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Role"><select className="select" value={f.role} disabled={editingSelf} onChange={(e) => set("role", e.target.value)}><option>Admin</option><option>Project Manager</option><option>Team Member</option></select></Field>
        <Field label={user ? "Reset password (optional)" : "Temporary password"} error={err.password}><input className="input" type="password" value={f.password} placeholder="Min 8 characters" onChange={(e) => set("password", e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Job title"><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Full-Stack Developer" /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Primary responsibility" className="full"><input className="input" value={f.primary_responsibility} onChange={(e) => set("primary_responsibility", e.target.value)} placeholder="e.g. Web Development / Software Development" /></Field>
        <Field label="Responsibility areas" className="full"><TagInput value={f.responsibilities} onChange={(v) => set("responsibilities", v)} placeholder="Press Enter to add, e.g. Backend APIs" /></Field>
        <Field label="Skills" className="full"><TagInput value={f.skills} onChange={(v) => set("skills", v)} placeholder="Press Enter to add, e.g. React" /></Field>
        <Field label="Bio" className="full"><textarea className="textarea" style={{ minHeight: 70 }} value={f.bio} onChange={(e) => set("bio", e.target.value)} /></Field>
        <Field label="Avatar color" className="full"><div className="row wrap gap-8">{AVATAR_COLORS.map((c) => (
          <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => set("avatar_color", c)} style={{ width: 30, height: 30, borderRadius: 99, background: c, border: f.avatar_color === c ? "3px solid var(--text)" : "3px solid transparent", outline: "2px solid var(--surface)", outlineOffset: -4 }} />))}</div></Field>
      </div>
    </Modal>
  );
}
