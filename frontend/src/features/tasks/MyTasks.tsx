import { useState } from "react";
import { LuChevronDown, LuPartyPopper } from "react-icons/lu";
import { api } from "../../lib/api";
import { invalidate, useQuery } from "../../lib/query";
import { useToast } from "../../lib/store";
import { Checkbox, Empty, ErrorState, PriorityBadge, Skeleton, StatusBadge } from "../../components/ui";
import { cx } from "../../lib/utils";
import { Task } from "../../lib/types";
import { DueTag } from "./Board";
import { TaskDrawer } from "./TaskDrawer";

export default function MyTasks() {
  const toast = useToast();
  const { data, loading, error, refetch, mutate } = useQuery<Task[]>("/tasks?mine=1&sort=due", () => api.get("/tasks?mine=1&sort=due"));
  const [open, setOpen] = useState<number | null>(null), [showDone, setShowDone] = useState(false);

  const toggle = async (t: Task, done: boolean) => {
    if (data) mutate(data.map((x) => (x.id === t.id ? { ...x, status: done ? "Done" : "To Do", overdue: done ? false : x.overdue } : x)));
    try { await api.patch(`/tasks/${t.id}/move`, { status: done ? "Done" : "To Do" }); invalidate(); toast(done ? "Nice, task completed ✔" : "Task reopened"); }
    catch (e: any) { toast(e.message, "error"); refetch(); }
  };

  const todo = (data ?? []).filter((t) => t.status !== "Done");
  const groups = [
    { id: "overdue", title: "Overdue", tone: "danger", items: todo.filter((t) => t.overdue) },
    { id: "today", title: "Today", tone: "warning", items: todo.filter((t) => !t.overdue && t.days_left === 0) },
    { id: "week", title: "This week", tone: "info", items: todo.filter((t) => t.days_left !== null && t.days_left >= 1 && t.days_left <= 7) },
    { id: "later", title: "Later", tone: "", items: todo.filter((t) => t.days_left !== null && t.days_left > 7) },
    { id: "none", title: "No due date", tone: "", items: todo.filter((t) => t.days_left === null) },
  ];
  const done = (data ?? []).filter((t) => t.status === "Done").sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || "")).slice(0, 10);

  return (
    <>
      <div className="page-head"><div><h2>My tasks</h2><p>Everything assigned to you, ordered by urgency.</p></div>
        <div className="row"><span className="badge danger">{groups[0].items.length} overdue</span><span className="badge info">{todo.length} open</span></div></div>
      {loading && !data ? <div className="col"><Skeleton h={90} r={14} /><Skeleton h={160} r={14} /></div> : error ? <ErrorState error={error} retry={refetch} /> : (
        <div className="col" style={{ gap: 18 }}>
          {!todo.length && <div className="card"><Empty icon={<LuPartyPopper size={26} />} title="Inbox zero!" text="No open tasks assigned to you. Check projects for what's next." /></div>}
          {groups.filter((g) => g.items.length).map((g) => (
            <section className="card" key={g.id} aria-label={g.title}>
              <div className="card-head" style={{ paddingBottom: 6 }}><h3 className="row gap-8"><span className={cx("badge", g.tone)}>{g.title}</span><span className="muted small">{g.items.length}</span></h3></div>
              <div>{g.items.map((t) => <Row key={t.id} t={t} onOpen={setOpen} onToggle={toggle} />)}</div>
            </section>
          ))}
          {done.length > 0 && (
            <section className="card">
              <button className="card-head" style={{ width: "100%", background: "none", border: 0, color: "inherit", paddingBottom: showDone ? 6 : 18 }} onClick={() => setShowDone((s) => !s)}>
                <h3 className="row gap-8"><span className="badge success">Recently completed</span><span className="muted small">{done.length}</span></h3><LuChevronDown style={{ transform: showDone ? "rotate(180deg)" : "none", transition: ".2s" }} /></button>
              {showDone && <div>{done.map((t) => <Row key={t.id} t={t} onOpen={setOpen} onToggle={toggle} />)}</div>}
            </section>
          )}
        </div>
      )}
      {open && <TaskDrawer id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Row({ t, onOpen, onToggle }: { t: Task; onOpen: (id: number) => void; onToggle: (t: Task, d: boolean) => void }) {
  const done = t.status === "Done";
  return (
    <div className="list-item click" onClick={() => onOpen(t.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(t.id)}>
      <Checkbox checked={done} label={`Mark "${t.title}" ${done ? "not done" : "done"}`} onChange={(v) => onToggle(t, v)} />
      <div className="grow"><div className={cx("bold small truncate", done && "done-text")}>{t.title}</div><div className="xs muted truncate">{t.project_name}{t.subtask_total ? ` · ${t.subtask_done}/${t.subtask_total} checklist` : ""}</div></div>
      <div className="row gap-14 wrap" style={{ justifyContent: "flex-end" }}><StatusBadge status={t.status} /><PriorityBadge priority={t.priority} /><div style={{ minWidth: 84, textAlign: "right" }}><DueTag t={t} /></div></div>
    </div>
  );
}
