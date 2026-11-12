import { useState } from "react";
import { LuArrowLeft, LuMail, LuPhone, LuCalendar, LuPencil, LuFolderKanban } from "react-icons/lu";
import { api } from "../../lib/api";
import { useQuery } from "../../lib/query";
import { useAuth } from "../../lib/store";
import { Avatar, Button, Empty, ErrorState, PriorityBadge, Skeleton, StatusBadge } from "../../components/ui";
import { fmtDate } from "../../lib/utils";
import { User } from "../../lib/types";
import { DueTag } from "../tasks/Board";
import { TaskDrawer } from "../tasks/TaskDrawer";
import { UserForm } from "./Team";

export default function Profile({ id }: { id: number }) {
  const { user: me, isAdmin } = useAuth();
  const { data: u, loading, error, refetch } = useQuery<User>(`/users/${id}`, () => api.get(`/users/${id}`));
  const [edit, setEdit] = useState(false), [open, setOpen] = useState<number | null>(null);
  if (error) return <div className="card"><ErrorState error={error} retry={refetch} /></div>;
  if (loading && !u) return <Skeleton h={400} r={16} />;
  if (!u) return null;
  const rate = u.stats && u.stats.assigned ? Math.round((100 * u.stats.done) / u.stats.assigned) : 0;
  return (
    <>
      <a className="small muted row gap-6 bold mb-12" href="#/team" style={{ width: "fit-content" }}><LuArrowLeft size={15} />Team</a>
      <div className="card profile-hero" style={{ marginBottom: 20 }}>
        <span style={{ borderRadius: "50%", border: "5px solid var(--surface)", display: "inline-flex", position: "relative" }}><Avatar name={u.name} color={u.avatar_color} size={96} /></span>
        <div className="grow" style={{ position: "relative", minWidth: 240 }}>
          <div className="row gap-8 wrap"><h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em" }}>{u.name}</h2><span className="badge primary">{u.role}</span>{!u.active && <span className="badge">Inactive</span>}</div>
          <div className="text-2" style={{ marginTop: 2 }}>{u.title}</div>
          <div className="row wrap small muted mt-12" style={{ gap: 18 }}><span className="row gap-6"><LuMail size={14} />{u.email}</span>{u.phone && <span className="row gap-6"><LuPhone size={14} />{u.phone}</span>}<span className="row gap-6"><LuCalendar size={14} />Joined {fmtDate(u.joined_at, true)}</span></div>
        </div>
        <div className="row gap-8" style={{ position: "relative" }}>
          <div className="stat-mini"><b>{u.stats?.open}</b><span>Open</span></div>
          <div className="stat-mini"><b style={{ color: u.stats?.overdue ? "var(--danger)" : undefined }}>{u.stats?.overdue}</b><span>Overdue</span></div>
          <div className="stat-mini"><b>{u.stats?.done}</b><span>Done</span></div>
          <div className="stat-mini"><b>{rate}%</b><span>Completion</span></div>
          {(isAdmin || me?.id === u.id) && <Button onClick={() => setEdit(true)}><LuPencil />Edit</Button>}
        </div>
      </div>
      <div className="grid g-12">
        <div className="col" style={{ gap: 18 }}>
          <div className="card card-pad"><h3 style={{ fontSize: 15 }}>About</h3><p className="text-2" style={{ margin: "8px 0 0" }}>{u.bio || "No bio yet."}</p></div>
          <div className="card card-pad"><h3 style={{ fontSize: 15 }}>Primary responsibility</h3>
            <div className="mt-12" style={{ color: "var(--primary-ink)", fontWeight: 700, fontSize: 15 }}>{u.primary_responsibility || "—"}</div>
            <div className="small muted mt-16 bold">Responsibility areas</div><div className="row wrap gap-6 mt-8">{u.responsibilities.length ? u.responsibilities.map((r) => <span key={r} className="badge primary">{r}</span>) : <span className="muted small">None assigned</span>}</div>
            <div className="small muted mt-16 bold">Skills</div><div className="row wrap gap-6 mt-8">{u.skills.length ? u.skills.map((s) => <span key={s} className="chip">{s}</span>) : <span className="muted small">None listed</span>}</div></div>
          <div className="card"><div className="card-head"><h3>Projects</h3></div><div style={{ marginTop: 8 }}>
            {!u.projects?.length && <Empty title="Not on any project yet" />}
            {u.projects?.map((p) => <a key={p.id} href={`#/projects/${p.id}`} className="list-item click"><span className="tl-ico"><LuFolderKanban size={15} /></span><span className="grow bold small">{p.name}</span><StatusBadge status={p.status} /></a>)}</div></div>
        </div>
        <div className="card"><div className="card-head"><div><h3>Current workload</h3><div className="xs muted">Open tasks by due date</div></div></div>
          <div style={{ marginTop: 8 }}>
            {!u.open_tasks?.length && <Empty title="No open tasks" text="Nothing assigned right now." />}
            {u.open_tasks?.map((t) => (
              <div key={t.id} className="list-item click" onClick={() => setOpen(t.id)}>
                <span className={`pri ${t.priority}`} /><div className="grow"><div className="bold small truncate">{t.title}</div><div className="xs muted truncate">{t.project_name}</div></div>
                <StatusBadge status={t.status} /><div style={{ minWidth: 80, textAlign: "right" }}><DueTag t={t} /></div></div>))}
          </div></div>
      </div>
      {edit && <UserForm user={u} onClose={() => setEdit(false)} />}
      {open && <TaskDrawer id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
