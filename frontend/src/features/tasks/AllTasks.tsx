import { useState } from "react";
import { LuPlus, LuSearch } from "react-icons/lu";
import { api, qs } from "../../lib/api";
import { useQuery } from "../../lib/query";
import { useQueryParams } from "../../lib/router";
import { useProjectsList, useUsers } from "../../lib/hooks";
import { Button, ErrorState, Skeleton } from "../../components/ui";
import { PRIORITIES, TASK_STATUSES } from "../../lib/utils";
import { Task } from "../../lib/types";
import { TaskTable } from "./Board";
import { TaskDrawer } from "./TaskDrawer";
import { TaskForm } from "./TaskForm";

export default function AllTasks() {
  const params = useQueryParams();
  const [f, setF] = useState({ project_id: "", assignee_id: "", status: "", priority: "", search: "", overdue: params.get("overdue") === "1" });
  const [open, setOpen] = useState<number | null>(null), [creating, setCreating] = useState(false);
  const users = useUsers(), projects = useProjectsList();
  const key = `/tasks${qs({ ...f, sort: "due" })}`;
  const { data, loading, error, refetch } = useQuery<Task[]>(key, () => api.get(key));
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  return (
    <>
      <div className="page-head"><div><h2>All tasks</h2><p>Every task across your projects. Filter, sort and open for details.</p></div>
        <Button variant="primary" onClick={() => setCreating(true)}><LuPlus />New task</Button></div>
      <div className="card">
        <div className="row wrap" style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
          <div className="search grow" style={{ minWidth: 200 }}><LuSearch /><input className="input sm" placeholder="Search by title or description…" value={f.search} onChange={(e) => set("search", e.target.value)} aria-label="Search" /></div>
          <select className="select sm" style={{ width: 190 }} value={f.project_id} onChange={(e) => set("project_id", e.target.value)} aria-label="Project"><option value="">All projects</option>{projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select className="select sm" style={{ width: 160 }} value={f.assignee_id} onChange={(e) => set("assignee_id", e.target.value)} aria-label="Assignee"><option value="">All assignees</option>{users.data?.filter((u) => u.role !== "Client").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <select className="select sm" style={{ width: 130 }} value={f.status} onChange={(e) => set("status", e.target.value)} aria-label="Status"><option value="">All statuses</option>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="select sm" style={{ width: 130 }} value={f.priority} onChange={(e) => set("priority", e.target.value)} aria-label="Priority"><option value="">All priorities</option>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select>
          <button className={`chip toggle ${f.overdue ? "on" : ""}`} onClick={() => set("overdue", !f.overdue)} aria-pressed={f.overdue}>Overdue only</button>
        </div>
        {loading && !data ? <div style={{ padding: 20 }}><Skeleton h={220} /></div> : error ? <ErrorState error={error} retry={refetch} /> : <TaskTable tasks={data ?? []} onOpen={setOpen} />}
      </div>
      <div className="xs muted mt-12">{data ? `${data.length} task${data.length === 1 ? "" : "s"}` : ""}</div>
      {open && <TaskDrawer id={open} onClose={() => setOpen(null)} />}
      {creating && <TaskForm onClose={() => setCreating(false)} />}
    </>
  );
}
