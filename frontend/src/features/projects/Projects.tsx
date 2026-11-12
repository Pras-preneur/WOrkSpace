import { useState } from "react";
import { LuPlus, LuSearch, LuLayoutGrid, LuList, LuCalendar, LuTriangleAlert, LuFolderKanban } from "react-icons/lu";
import { api, qs } from "../../lib/api";
import { useQuery } from "../../lib/query";
import { useAuth } from "../../lib/store";
import { navigate } from "../../lib/router";
import { useClientsList } from "../../lib/hooks";
import { AvatarStack, Button, Empty, ErrorState, PriorityBadge, Progress, Segmented, Skeleton, StatusBadge } from "../../components/ui";
import { PRIORITIES, PROJECT_STATUSES, cx, dueLabel, fmtDate, money } from "../../lib/utils";
import { Project } from "../../lib/types";
import { ProjectForm } from "./ProjectForm";

export const DeadlineTag = ({ p }: { p: Project }) => p.deadline ? (
  <span className={cx("due", p.overdue && "overdue", p.due_soon && "soon")}><LuCalendar />{p.overdue || p.due_soon ? dueLabel(p.days_left) : fmtDate(p.deadline)}</span>) : <span className="muted xs">No deadline</span>;

export default function Projects() {
  const { isStaff } = useAuth();
  const [view, setView] = useState<"cards" | "table">("cards");
  const [f, setF] = useState({ search: "", status: "", client_id: "", priority: "" });
  const [creating, setCreating] = useState(false);
  const clients = useClientsList(isStaff);
  const key = `/projects${qs(f)}`;
  const { data, loading, error, refetch } = useQuery<Project[]>(key, () => api.get(key));
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <>
      <div className="page-head"><div><h2>Projects</h2><p>{isStaff ? "All client and internal projects in one place." : "Projects you're part of."}</p></div>
        {isStaff && <Button variant="primary" onClick={() => setCreating(true)}><LuPlus />New project</Button>}</div>
      <div className="row wrap mb-16">
        <div className="search" style={{ width: 260 }}><LuSearch /><input className="input" placeholder="Search projects or clients…" value={f.search} onChange={(e) => set("search", e.target.value)} aria-label="Search projects" /></div>
        <select className="select" style={{ width: 150 }} value={f.status} onChange={(e) => set("status", e.target.value)} aria-label="Status"><option value="">All statuses</option>{PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        {isStaff && <select className="select" style={{ width: 170 }} value={f.client_id} onChange={(e) => set("client_id", e.target.value)} aria-label="Client"><option value="">All clients</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        <select className="select" style={{ width: 140 }} value={f.priority} onChange={(e) => set("priority", e.target.value)} aria-label="Priority"><option value="">All priorities</option>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select>
        <div className="grow" />
        <Segmented value={view} onChange={setView} options={[{ id: "cards", label: <><LuLayoutGrid size={14} />Cards</> }, { id: "table", label: <><LuList size={14} />Table</> }]} />
      </div>
      {loading && !data ? <div className="grid g-cards">{[1, 2, 3].map((i) => <Skeleton key={i} h={230} r={14} />)}</div> : error ? <ErrorState error={error} retry={refetch} /> :
        !data?.length ? <div className="card"><Empty icon={<LuFolderKanban size={26} />} title="No projects found" text="Adjust the filters or create a new project." action={isStaff && <Button variant="primary" onClick={() => setCreating(true)}><LuPlus />New project</Button>} /></div> :
        view === "cards" ? (
          <div className="grid g-cards">
            {data.map((p) => (
              <article key={p.id} className="card hover card-pad" onClick={() => navigate(`/projects/${p.id}`)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`/projects/${p.id}`)} aria-label={`Open project ${p.name}`}>
                <div className="row between"><StatusBadge status={p.status} /><PriorityBadge priority={p.priority} /></div>
                <h3 style={{ fontSize: 16, margin: "14px 0 2px" }}>{p.name}</h3>
                <div className="small muted">{p.client_name || "Internal project"}</div>
                <div className="mt-16"><div className="row between xs"><span className="muted">{p.task_done}/{p.task_total} tasks</span><b className="mono">{p.progress}%</b></div><div className="mt-8" style={{ marginTop: 6 }}><Progress value={p.progress} tone={p.progress === 100 ? "success" : undefined} /></div></div>
                <div className="row between mt-16"><AvatarStack people={p.members} />
                  <div className="row gap-8">{p.task_overdue > 0 && <span className="badge danger"><LuTriangleAlert size={12} />{p.task_overdue}</span>}<DeadlineTag p={p} /></div></div>
              </article>))}
          </div>
        ) : (
          <div className="card table-wrap"><table className="t"><thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Priority</th><th>Progress</th><th>Team</th><th>Deadline</th><th>Budget</th></tr></thead>
            <tbody>{data.map((p) => (
              <tr key={p.id} className="click" onClick={() => navigate(`/projects/${p.id}`)}>
                <td><div className="bold">{p.name}</div><div className="xs muted">PM: {p.manager_name}</div></td><td className="small">{p.client_name || "Internal"}</td>
                <td><StatusBadge status={p.status} /></td><td><PriorityBadge priority={p.priority} /></td>
                <td style={{ minWidth: 150 }}><div className="row"><div className="grow"><Progress value={p.progress} /></div><b className="xs mono">{p.progress}%</b></div></td>
                <td><AvatarStack people={p.members} size={26} /></td><td><DeadlineTag p={p} /></td><td className="small mono">{money(p.budget)}</td></tr>))}</tbody></table></div>
        )}
      {creating && <ProjectForm onClose={() => setCreating(false)} onSaved={(p) => navigate(`/projects/${p.id}`)} />}
    </>
  );
}
