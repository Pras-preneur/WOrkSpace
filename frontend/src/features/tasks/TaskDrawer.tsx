import { useEffect, useState } from "react";
import { LuTrash2, LuSend, LuPlus, LuCalendar, LuClock, LuMessageSquare, LuFolder } from "react-icons/lu";
import { api } from "../../lib/api";
import { invalidate, useQuery } from "../../lib/query";
import { useAuth, useToast } from "../../lib/store";
import { useUsers } from "../../lib/hooks";
import { Avatar, Button, Checkbox, Drawer, Empty, Field, PriorityBadge, Progress, Skeleton, StatusBadge } from "../../components/ui";
import { PRIORITIES, TASK_STATUSES, cx, dueLabel, fmtDate, timeAgo } from "../../lib/utils";
import { Task } from "../../lib/types";
import { navigate } from "../../lib/router";

export function TaskDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const { user } = useAuth(); const toast = useToast();
  const { data: t, loading, error, mutate } = useQuery<Task & { can_manage: boolean; can_edit: boolean }>(`/tasks/${id}`, () => api.get(`/tasks/${id}`));
  const users = useUsers();
  const [comment, setComment] = useState(""), [sub, setSub] = useState(""), [desc, setDesc] = useState(""), [title, setTitle] = useState("");
  useEffect(() => { if (t) { setDesc(t.description || ""); setTitle(t.title); } }, [t?.id, t?.description, t?.title]);

  const patch = async (body: any) => {
    try { const n = await api.patch<any>(`/tasks/${id}`, body); mutate(n); invalidate(); }
    catch (e: any) { toast(e.message, "error"); }
  };
  const wrap = async (fn: () => Promise<any>, ok?: string) => {
    try { await fn(); const n = await api.get<any>(`/tasks/${id}`); mutate(n); invalidate(); if (ok) toast(ok); } catch (e: any) { toast(e.message, "error"); }
  };

  const header = t ? (
    <div className="grow">
      <a className="xs muted row gap-6 bold" href={`#/projects/${t.project_id}`} onClick={(e) => { e.preventDefault(); onClose(); navigate(`/projects/${t.project_id}`); }}><LuFolder size={13} />{t.project_name}</a>
      {t.can_manage
        ? <input className="input" style={{ fontSize: 18, fontWeight: 700, border: "1px solid transparent", padding: "0 6px", marginLeft: -6, height: 36, background: "transparent" }} value={title}
                 onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim().length >= 2 && title !== t.title && patch({ title: title.trim() })} aria-label="Task title" />
        : <h3 style={{ fontSize: 18, marginTop: 4 }}>{t.title}</h3>}
      <div className="row gap-8 mt-8 wrap"><StatusBadge status={t.status} /><PriorityBadge priority={t.priority} />
        {t.overdue && <span className="badge danger"><LuClock size={12} />{dueLabel(t.days_left)}</span>}{t.due_soon && <span className="badge warning"><LuClock size={12} />Due {dueLabel(t.days_left).toLowerCase()}</span>}</div>
    </div>
  ) : <Skeleton h={50} />;

  return (
    <Drawer onClose={onClose} header={header}>
      {loading && !t && <div className="col"><Skeleton h={30} /><Skeleton h={30} /><Skeleton h={120} /></div>}
      {error && <Empty title="Task unavailable" text={error.message} />}
      {t && (
        <div className="col gap-20" style={{ gap: 24 }}>
          <div className="prop-grid">
            <span className="k">Status</span>
            <select className="select sm" value={t.status} disabled={!t.can_edit} onChange={(e) => patch({ status: e.target.value })}>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            <span className="k">Assignee</span>
            {t.can_manage ? (
              <select className="select sm" value={t.assignee_id ?? ""} onChange={(e) => patch({ assignee_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Unassigned</option>{users.data?.filter((u) => u.role !== "Client").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>) : <span className="row gap-8"><Avatar name={t.assignee_name} color={t.assignee_color} size={24} />{t.assignee_name || "Unassigned"}</span>}
            <span className="k">Priority</span>
            {t.can_manage ? <select className="select sm" value={t.priority} onChange={(e) => patch({ priority: e.target.value })}>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select> : <PriorityBadge priority={t.priority} />}
            <span className="k">Due date</span>
            {t.can_manage ? <input className="input sm" type="date" value={t.due_date ?? ""} onChange={(e) => patch({ due_date: e.target.value || null })} />
              : <span className={cx("due", t.overdue && "overdue", t.due_soon && "soon")}><LuCalendar />{fmtDate(t.due_date, true)}</span>}
            <span className="k">Estimate</span>
            {t.can_manage ? <input className="input sm" type="number" min={0} step={0.5} defaultValue={t.estimated_hours ?? ""} placeholder="hours" onBlur={(e) => patch({ estimated_hours: e.target.value === "" ? null : Number(e.target.value) })} />
              : <span>{t.estimated_hours ? `${t.estimated_hours} h` : "—"}</span>}
            <span className="k">Reporter</span><span>{t.reporter_name || "—"}</span>
            <span className="k">Labels</span><span className="row wrap gap-6">{t.labels.length ? t.labels.map((l) => <span key={l} className="chip">{l}</span>) : <span className="muted">—</span>}</span>
          </div>

          <div>
            <h4 className="small bold mb-12">Description</h4>
            <textarea className="textarea" value={desc} placeholder={t.can_edit ? "Add notes or context…" : "No description"} readOnly={!t.can_edit}
                      onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== (t.description || "") && patch({ description: desc })} />
          </div>

          <div>
            <div className="row between mb-12"><h4 className="small bold">Checklist {t.subtasks!.length > 0 && <span className="muted">· {t.subtasks!.filter((s) => s.done).length}/{t.subtasks!.length}</span>}</h4></div>
            {t.subtasks!.length > 0 && <div className="mb-12"><Progress value={Math.round(100 * t.subtasks!.filter((s) => s.done).length / t.subtasks!.length)} tone="success" /></div>}
            {t.subtasks!.map((s) => (
              <div className="check" key={s.id}>
                <Checkbox checked={s.done} label={s.title} onChange={(v) => t.can_edit && wrap(() => api.patch(`/subtasks/${s.id}`, { done: v }))} />
                <span className={cx("grow", s.done && "done-text")}>{s.title}</span>
                {t.can_edit && <Button variant="ghost" size="sm" icon aria-label="Remove item" onClick={() => wrap(() => api.del(`/subtasks/${s.id}`))}><LuTrash2 size={14} /></Button>}
              </div>
            ))}
            {t.can_edit && (
              <form className="row mt-8" onSubmit={(e) => { e.preventDefault(); if (sub.trim()) { wrap(() => api.post(`/tasks/${id}/subtasks`, { title: sub.trim() })); setSub(""); } }}>
                <input className="input sm" placeholder="Add checklist item…" value={sub} onChange={(e) => setSub(e.target.value)} /><Button size="sm" type="submit" disabled={!sub.trim()}><LuPlus />Add</Button>
              </form>
            )}
          </div>

          <div>
            <h4 className="small bold mb-12 row gap-8"><LuMessageSquare size={15} />Comments <span className="muted">· {t.comments!.length}</span></h4>
            <div className="col" style={{ gap: 14 }}>
              {t.comments!.map((c) => (
                <div className="comment" key={c.id}><Avatar name={c.author_name} color={c.author_color} size={30} />
                  <div className="bubble"><div className="row between"><b className="small">{c.author_name}</b><span className="xs muted">{timeAgo(c.created_at)}</span></div><div className="small mt-8" style={{ marginTop: 4 }}>{c.body}</div></div></div>
              ))}
              {!t.comments!.length && <div className="muted small">No comments yet. Start the conversation.</div>}
            </div>
            <form className="row mt-16" style={{ alignItems: "flex-start" }} onSubmit={(e) => { e.preventDefault(); if (comment.trim()) { wrap(() => api.post(`/tasks/${id}/comments`, { body: comment.trim() })); setComment(""); } }}>
              <Avatar name={user!.name} color={user!.avatar_color} size={30} />
              <textarea className="textarea" style={{ minHeight: 44, height: 44 }} placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit(); }} />
              <Button variant="primary" icon type="submit" disabled={!comment.trim()} aria-label="Send comment"><LuSend /></Button>
            </form>
          </div>

          {t.can_manage && (
            <div className="row between" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <span className="xs muted">Created {fmtDate(t.created_at, true)}{t.completed_at ? ` · Completed ${fmtDate(t.completed_at, true)}` : ""}</span>
              <Button variant="danger" size="sm" onClick={async () => { if (confirm("Delete this task? This can't be undone from the UI.")) { await api.del(`/tasks/${id}`); invalidate(); toast("Task deleted"); onClose(); } }}><LuTrash2 />Delete task</Button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
