import { useMemo, useRef, useState } from "react";
import { LuPlus, LuCalendar, LuListChecks, LuMessageSquare, LuLayoutGrid, LuList, LuSearch, LuArrowUp, LuArrowDown } from "react-icons/lu";
import { api, qs } from "../../lib/api";
import { invalidate, useQuery } from "../../lib/query";
import { useAuth, useToast } from "../../lib/store";
import { useUsers } from "../../lib/hooks";
import { Avatar, Empty, PriorityBadge, Segmented, Skeleton, StatusBadge } from "../../components/ui";
import { PRIORITIES, STATUS_COLOR, TASK_STATUSES, cx, dueLabel, fmtDate } from "../../lib/utils";
import { Task } from "../../lib/types";
import { TaskDrawer } from "./TaskDrawer";
import { TaskForm } from "./TaskForm";

export const DueTag = ({ t }: { t: Task }) => t.due_date ? (
  <span className={cx("due", t.overdue && "overdue", t.due_soon && "soon")} title={fmtDate(t.due_date, true)}><LuCalendar />{t.overdue || t.due_soon ? dueLabel(t.days_left) : fmtDate(t.due_date)}</span>
) : null;

export function TaskCard({ t, draggable, onOpen, onDragStart, onDragEnd, dragging }: any) {
  return (
    <div className={cx("kcard", dragging && "dragging")} draggable={draggable} data-id={t.id} onClick={() => onOpen(t.id)}
         onDragStart={onDragStart} onDragEnd={onDragEnd} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(t.id)} role="button" aria-label={`Task: ${t.title}`}>
      <div className="row between"><span className="row gap-6"><span className={`pri ${t.priority}`} title={`${t.priority} priority`} /><span className="xs muted bold">{t.priority}</span></span><DueTag t={t} /></div>
      <div className="title">{t.title}</div>
      {t.labels.length > 0 && <div className="row wrap gap-4 mb-12" style={{ marginTop: -4 }}>{t.labels.slice(0, 3).map((l: string) => <span key={l} className="chip" style={{ height: 20, fontSize: 11 }}>{l}</span>)}</div>}
      <div className="row between">
        <div className="row gap-8 xs muted">
          {t.subtask_total > 0 && <span className="row gap-4"><LuListChecks size={13} />{t.subtask_done}/{t.subtask_total}</span>}
          {t.comment_count > 0 && <span className="row gap-4"><LuMessageSquare size={13} />{t.comment_count}</span>}
        </div>
        <Avatar name={t.assignee_name} color={t.assignee_color} size={24} />
      </div>
    </div>
  );
}

export function TaskTable({ tasks, onOpen, showProject = true }: { tasks: Task[]; onOpen: (id: number) => void; showProject?: boolean }) {
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: "due", dir: 1 });
  const rank: any = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
  const sorted = useMemo(() => [...tasks].sort((a: any, b: any) => {
    const g = (t: any) => sort.k === "due" ? (t.due_date || "9999") : sort.k === "priority" ? rank[t.priority] : sort.k === "status" ? TASK_STATUSES.indexOf(t.status as any) : (t[sort.k] || "").toString().toLowerCase();
    const x = g(a), y = g(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  }), [tasks, sort]);
  const Th = ({ k, children }: any) => (
    <th className="sortable" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : 1 }))} aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <span className="row gap-4">{children}{sort.k === k && (sort.dir === 1 ? <LuArrowUp size={12} /> : <LuArrowDown size={12} />)}</span></th>);
  if (!tasks.length) return <Empty title="No tasks match" text="Try adjusting the filters." />;
  return (
    <div className="table-wrap"><table className="t">
      <thead><tr><Th k="title">Task</Th>{showProject && <Th k="project_name">Project</Th>}<Th k="assignee_name">Assignee</Th><Th k="status">Status</Th><Th k="priority">Priority</Th><Th k="due">Due</Th></tr></thead>
      <tbody>{sorted.map((t) => (
        <tr key={t.id} className="click" onClick={() => onOpen(t.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(t.id)}>
          <td style={{ maxWidth: 360 }}><div className="bold truncate">{t.title}</div>{t.subtask_total > 0 && <div className="xs muted">{t.subtask_done}/{t.subtask_total} checklist</div>}</td>
          {showProject && <td className="small text-2">{t.project_name}</td>}
          <td><span className="row gap-8"><Avatar name={t.assignee_name} color={t.assignee_color} size={24} /><span className="small">{t.assignee_name || "Unassigned"}</span></span></td>
          <td><StatusBadge status={t.status} /></td><td><PriorityBadge priority={t.priority} /></td>
          <td>{t.due_date ? <DueTag t={t} /> : <span className="muted">—</span>}</td>
        </tr>))}</tbody>
    </table></div>
  );
}

export function TasksPanel({ projectId, canManage, openId, setOpenId }: { projectId: number; canManage: boolean; openId: number | null; setOpenId: (n: number | null) => void }) {
  const { user } = useAuth(); const toast = useToast();
  const key = `/tasks${qs({ project_id: projectId })}`;
  const { data, loading, mutate, refetch } = useQuery<Task[]>(key, () => api.get(key));
  const users = useUsers();
  const [view, setView] = useState<"board" | "list">("board");
  const [fAssignee, setFA] = useState(""), [fPriority, setFP] = useState(""), [search, setSearch] = useState("");
  const [drag, setDrag] = useState<number | null>(null), [drop, setDrop] = useState<{ status: string; index: number } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const cols = useRef<Record<string, HTMLDivElement | null>>({});

  const filtered = useMemo(() => (data ?? []).filter((t) =>
    (!fAssignee || String(t.assignee_id ?? "none") === fAssignee) && (!fPriority || t.priority === fPriority) &&
    (!search || t.title.toLowerCase().includes(search.toLowerCase()))), [data, fAssignee, fPriority, search]);
  const byStatus = (s: string) => filtered.filter((t) => t.status === s).sort((a, b) => a.position - b.position || a.id - b.id);
  const canDrag = (t: Task) => canManage || t.assignee_id === user!.id;

  const overCol = (e: React.DragEvent, status: string) => {
    e.preventDefault(); if (drag === null) return;
    const els = Array.from(cols.current[status]?.querySelectorAll<HTMLElement>(".kcard") ?? []).filter((el) => Number(el.dataset.id) !== drag);
    let idx = els.length;
    for (let i = 0; i < els.length; i++) { const r = els[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { idx = i; break; } }
    setDrop((d) => (d && d.status === status && d.index === idx ? d : { status, index: idx }));
  };
  const onDrop = async (status: string) => {
    if (drag === null || !drop || !data) return setDrag(null);
    const moved = data.find((t) => t.id === drag)!; const index = drop.index;
    const colIds = byStatus(status).filter((t) => t.id !== drag).map((t) => t.id); colIds.splice(index, 0, drag);
    const next = data.map((t) => t.id === drag ? { ...t, status, position: colIds.indexOf(t.id) }
      : t.status === status ? { ...t, position: colIds.indexOf(t.id) } : t);
    mutate(next); setDrag(null); setDrop(null);
    try { await api.patch(`/tasks/${moved.id}/move`, { status, position: index }); invalidate(); if (moved.status !== status) toast(`Moved to ${status}`); }
    catch (e: any) { toast(e.message, "error"); refetch(); }
  };

  return (
    <div>
      <div className="row between wrap mb-16">
        <div className="row wrap">
          <div className="search" style={{ width: 220 }}><LuSearch /><input className="input sm" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search tasks" /></div>
          <select className="select sm" style={{ width: 160 }} value={fAssignee} onChange={(e) => setFA(e.target.value)} aria-label="Filter by assignee"><option value="">All assignees</option><option value="none">Unassigned</option>
            {users.data?.filter((u) => u.role !== "Client").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <select className="select sm" style={{ width: 140 }} value={fPriority} onChange={(e) => setFP(e.target.value)} aria-label="Filter by priority"><option value="">All priorities</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
        </div>
        <div className="row">
          <Segmented value={view} onChange={setView} options={[{ id: "board", label: <><LuLayoutGrid size={14} />Board</> }, { id: "list", label: <><LuList size={14} />List</> }]} />
          {canManage && <button className="btn primary" onClick={() => setAdding("To Do")}><LuPlus />Add task</button>}
        </div>
      </div>

      {loading && !data ? <div className="board">{TASK_STATUSES.map((s) => <Skeleton key={s} h={320} r={14} />)}</div> :
        view === "board" ? (
          <div className="board" onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null); }}>
            {TASK_STATUSES.map((s) => { const list = byStatus(s); return (
              <div key={s} className={cx("col-kb", drop?.status === s && drag !== null && "over")} onDragOver={(e) => overCol(e, s)} onDrop={() => onDrop(s)} aria-label={`${s} column`}>
                <div className="col-head"><span className="pri" style={{ background: STATUS_COLOR[s], width: 10, height: 10 }} />{s}<span className="n">{list.length}</span>
                  <span className="grow" />{canManage && <button className="btn ghost sm icon" aria-label={`Add task to ${s}`} onClick={() => setAdding(s)}><LuPlus size={15} /></button>}</div>
                <div ref={(el) => { cols.current[s] = el; }}>
                  {list.map((t, i) => (<div key={t.id}>
                    {drop?.status === s && drop.index === i && drag !== null && drag !== t.id && <div className="drop-line" />}
                    <TaskCard t={t} draggable={canDrag(t)} dragging={drag === t.id} onOpen={setOpenId}
                              onDragStart={(e: React.DragEvent) => { setDrag(t.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(t.id)); }}
                              onDragEnd={() => { setDrag(null); setDrop(null); }} /></div>))}
                  {drop?.status === s && drag !== null && drop.index >= list.filter((t) => t.id !== drag).length && <div className="drop-line" />}
                  {!list.length && <div className="xs muted" style={{ textAlign: "center", padding: "26px 8px" }}>{drag !== null ? "Drop here" : "No tasks"}</div>}
                </div>
              </div>); })}
          </div>
        ) : <div className="card"><TaskTable tasks={filtered} onOpen={setOpenId} showProject={false} /></div>}

      {adding && <TaskForm projectId={projectId} defaultStatus={adding} onClose={() => setAdding(null)} />}
      {openId && <TaskDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
