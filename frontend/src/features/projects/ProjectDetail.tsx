import { useState } from "react";
import { LuArrowLeft, LuPencil, LuCalendar, LuWallet, LuBuilding2, LuUserCog, LuSend, LuUsers, LuTrash2, LuListChecks, LuMessageSquare, LuActivity, LuLayoutDashboard, LuTriangleAlert, LuUserPlus } from "react-icons/lu";
import { api } from "../../lib/api";
import { invalidate, useQuery } from "../../lib/query";
import { useAuth, useToast } from "../../lib/store";
import { navigate, useQueryParams } from "../../lib/router";
import { useUsers } from "../../lib/hooks";
import { Avatar, Button, Empty, ErrorState, PriorityBadge, Progress, Ring, Skeleton, StatusBadge, Tabs, Modal, Field } from "../../components/ui";
import { Donut, Legend } from "../../components/charts";
import { ActivityFeed } from "../../components/ActivityFeed";
import { STATUS_COLOR, TASK_STATUSES, dueLabel, fmtDate, money, timeAgo, cx } from "../../lib/utils";
import { Activity, Comment, Project, Task } from "../../lib/types";
import { TasksPanel } from "../tasks/Board";
import { ProjectForm } from "./ProjectForm";

export default function ProjectDetail({ id }: { id: number }) {
  const { isAdmin } = useAuth(); const toast = useToast();
  const params = useQueryParams();
  const [tab, setTabState] = useState(params.get("tab") || (params.get("task") ? "tasks" : "overview"));
  const setTab = (t: string) => { setTabState(t); navigate(`/projects/${id}?tab=${t}`, { replace: true }); };
  const [openTask, setOpenTask] = useState<number | null>(params.get("task") ? Number(params.get("task")) : null);
  const [editing, setEditing] = useState(false);
  const { data: p, loading, error, refetch } = useQuery<Project>(`/projects/${id}`, () => api.get(`/projects/${id}`));
  const tasks = useQuery<Task[]>(`/tasks?project_id=${id}`, () => api.get(`/tasks?project_id=${id}`));

  if (error) return <div className="card"><ErrorState error={error} retry={refetch} /></div>;
  if (loading && !p) return <div className="col"><Skeleton h={150} r={16} /><Skeleton h={300} r={16} /></div>;
  if (!p) return null;
  const manage = !!p.can_manage;
  const remove = async () => { if (confirm(`Delete project "${p.name}"? Tasks stay in the database (soft delete) but disappear from the UI.`)) { await api.del(`/projects/${id}`); invalidate(); toast("Project deleted"); navigate("/projects"); } };

  return (
    <>
      <a className="small muted row gap-6 bold mb-12" href="#/projects" style={{ width: "fit-content" }}><LuArrowLeft size={15} />All projects</a>
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="row between wrap" style={{ alignItems: "flex-start", gap: 20 }}>
          <div className="grow" style={{ minWidth: 260 }}>
            <div className="row gap-8 wrap"><StatusBadge status={p.status} /><PriorityBadge priority={p.priority} />{p.overdue && <span className="badge danger"><LuTriangleAlert size={12} />Deadline passed</span>}</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em", margin: "12px 0 4px" }}>{p.name}</h2>
            <div className="row wrap gap-14 small text-2" style={{ gap: 18 }}>
              <span className="row gap-6"><LuBuilding2 size={15} />{p.client_name || "Internal project"}</span>
              <span className="row gap-6"><LuUserCog size={15} />PM: {p.manager_name}</span>
              <span className="row gap-6"><LuCalendar size={15} />{fmtDate(p.start_date)} → {fmtDate(p.deadline, true)}{p.deadline && p.status !== "Completed" ? <b className={cx(p.overdue ? "" : "muted")} style={p.overdue ? { color: "var(--danger)" } : {}}>&nbsp;({dueLabel(p.days_left)})</b> : null}</span>
              {p.budget != null && <span className="row gap-6"><LuWallet size={15} />{money(p.budget)}</span>}
            </div>
          </div>
          <div className="row gap-14" style={{ gap: 18 }}>
            <Ring value={p.progress} size={74} stroke={8} color={p.progress === 100 ? "var(--success)" : "var(--primary)"} />
            <div><div className="bold">{p.task_done}/{p.task_total} tasks</div><div className="xs muted">{p.task_overdue ? <span style={{ color: "var(--danger)", fontWeight: 600 }}>{p.task_overdue} overdue</span> : "On track"}</div></div>
            {manage && <div className="row"><Button onClick={() => setEditing(true)}><LuPencil />Edit</Button>{isAdmin && <Button variant="danger" icon onClick={remove} aria-label="Delete project"><LuTrash2 /></Button>}</div>}
          </div>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "overview", label: "Overview", icon: <LuLayoutDashboard size={15} /> }, { id: "tasks", label: "Tasks", icon: <LuListChecks size={15} />, count: p.task_total },
        { id: "team", label: "Team", icon: <LuUsers size={15} />, count: p.members.length }, { id: "discussion", label: "Discussion", icon: <LuMessageSquare size={15} /> },
        { id: "activity", label: "Activity", icon: <LuActivity size={15} /> }]} />
      {tab === "overview" && <Overview p={p} tasks={tasks.data ?? []} onOpen={(tid) => { setTab("tasks"); setOpenTask(tid); }} />}
      {tab === "tasks" && <TasksPanel projectId={id} canManage={manage} openId={openTask} setOpenId={setOpenTask} />}
      {tab === "team" && <TeamTab p={p} manage={manage} />}
      {tab === "discussion" && <Discussion id={id} />}
      {tab === "activity" && <ActivityTab id={id} />}
      {editing && <ProjectForm project={p} onClose={() => setEditing(false)} />}
    </>
  );
}

function Overview({ p, tasks, onOpen }: { p: Project; tasks: Task[]; onOpen: (id: number) => void }) {
  const counts = TASK_STATUSES.map((s) => ({ label: s, value: tasks.filter((t) => t.status === s).length, color: STATUS_COLOR[s] }));
  const urgent = tasks.filter((t) => t.status !== "Done" && (t.overdue || t.due_soon)).sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0)).slice(0, 5);
  return (
    <div className="grid g-21">
      <div className="col" style={{ gap: 18 }}>
        <div className="card card-pad"><h3 style={{ fontSize: 15 }}>About this project</h3><p className="text-2" style={{ whiteSpace: "pre-wrap", margin: "10px 0 0" }}>{p.description || "No description yet."}</p></div>
        <div className="card"><div className="card-head"><h3>Needs attention</h3></div>
          <div style={{ marginTop: 10 }}>
            {!urgent.length && <Empty title="Nothing urgent" text="No overdue or imminent tasks in this project." />}
            {urgent.map((t) => <div key={t.id} className="list-item click" onClick={() => onOpen(t.id)}>
              <span className={`pri ${t.priority}`} /><div className="grow"><div className="bold small truncate">{t.title}</div><div className="xs muted">{t.assignee_name || "Unassigned"}</div></div>
              <span className={cx("due", t.overdue ? "overdue" : "soon")}>{dueLabel(t.days_left)}</span></div>)}
          </div></div>
      </div>
      <div className="card"><div className="card-head"><h3>Task breakdown</h3></div>
        <div className="card-body col" style={{ alignItems: "center", gap: 16 }}><Donut data={counts} size={170} thickness={22} center={{ value: tasks.length, label: "Tasks" }} />
          <Legend items={counts.map((c) => ({ label: `${c.label} · ${c.value}`, color: c.color }))} /></div></div>
    </div>
  );
}

function TeamTab({ p, manage }: { p: Project; manage: boolean }) {
  const toast = useToast(); const users = useUsers(); const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState(""), [role, setRole] = useState("Contributor");
  const save = async (members: { user_id: number; project_role: string }[]) => {
    try { await api.put(`/projects/${p.id}/members`, { members }); invalidate(); toast("Team updated"); } catch (e: any) { toast(e.message, "error"); }
  };
  const current = p.members.map((m) => ({ user_id: m.id, project_role: m.project_role }));
  const available = (users.data ?? []).filter((u) => u.role !== "Client" && !p.members.some((m) => m.id === u.id));
  return (
    <div className="card">
      <div className="card-head"><h3>Project team</h3>{manage && <Button size="sm" variant="primary" onClick={() => setAdding(true)}><LuUserPlus />Add member</Button>}</div>
      <div style={{ marginTop: 10 }}>
        {p.members.map((m) => (
          <div className="list-item" key={m.id}>
            <Avatar name={m.name} color={m.avatar_color} size={40} />
            <div className="grow"><a className="bold" href={`#/team/${m.id}`}>{m.name}</a><div className="xs muted">{m.title}</div></div>
            <span className="badge primary">{m.project_role}</span>
            {manage && m.id !== p.manager_id && <Button variant="ghost" size="sm" icon aria-label={`Remove ${m.name}`} onClick={() => save(current.filter((c) => c.user_id !== m.id))}><LuTrash2 size={15} /></Button>}
          </div>))}
      </div>
      {adding && (
        <Modal title="Add team member" onClose={() => setAdding(false)} footer={<><Button onClick={() => setAdding(false)}>Cancel</Button>
          <Button variant="primary" disabled={!pick} onClick={async () => { await save([...current, { user_id: Number(pick), project_role: role }]); setAdding(false); }}>Add to project</Button></>}>
          <div className="col"><Field label="Person"><select className="select" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Select…</option>{available.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.title}</option>)}</select></Field>
            <Field label="Role on this project"><input className="input" value={role} onChange={(e) => setRole(e.target.value)} /></Field></div>
        </Modal>)}
    </div>
  );
}

function Discussion({ id }: { id: number }) {
  const { user } = useAuth(); const toast = useToast();
  const key = `/projects/${id}/comments`;
  const { data, loading, refetch } = useQuery<Comment[]>(key, () => api.get(key));
  const [body, setBody] = useState(""), [busy, setBusy] = useState(false);
  const post = async () => { setBusy(true); try { await api.post(key, { body }); setBody(""); refetch(); invalidate(); } catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); } };
  return (
    <div className="card card-pad" style={{ maxWidth: 820 }}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <Avatar name={user!.name} color={user!.avatar_color} size={36} />
        <div className="grow col" style={{ gap: 8 }}>
          <textarea className="textarea" placeholder="Share an update with the team…" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Post an update"
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) post(); }} />
          <div className="row between"><span className="xs muted">Ctrl/⌘ + Enter to post</span><Button variant="primary" size="sm" disabled={!body.trim() || busy} onClick={post}><LuSend />Post update</Button></div>
        </div>
      </div>
      <div className="divider" />
      {loading && !data ? <Skeleton h={80} /> : !data?.length ? <Empty icon={<LuMessageSquare size={24} />} title="No updates yet" text="Post the first update to keep everyone in sync." /> :
        <div className="col" style={{ gap: 18 }}>{data.map((c) => (
          <div className="comment" key={c.id}><Avatar name={c.author_name} color={c.author_color} size={36} />
            <div className="bubble"><div className="row between"><span><b className="small">{c.author_name}</b> <span className="xs muted">· {c.author_role}</span></span><span className="xs muted">{timeAgo(c.created_at)}</span></div>
              <div className="small" style={{ marginTop: 4 }}>{c.body}</div></div></div>))}</div>}
    </div>
  );
}

function ActivityTab({ id }: { id: number }) {
  const { data, loading } = useQuery<Activity[]>(`/projects/${id}/activity`, () => api.get(`/projects/${id}/activity`));
  return <div className="card card-pad" style={{ maxWidth: 820 }}>{loading && !data ? <Skeleton h={120} /> : data?.length ? <ActivityFeed items={data} showProject={false} /> : <Empty title="No activity yet" />}</div>;
}
