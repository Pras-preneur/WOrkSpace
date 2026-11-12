import { useState } from "react";
import { api } from "../../lib/api";
import { invalidate } from "../../lib/query";
import { useAuth, useToast } from "../../lib/store";
import { fieldErrors, useProjectsList, useUsers } from "../../lib/hooks";
import { Button, Field, Modal, TagInput } from "../../components/ui";
import { PRIORITIES, TASK_STATUSES } from "../../lib/utils";

export function TaskForm({ projectId, defaultStatus, onClose, onSaved }: { projectId?: number; defaultStatus?: string; onClose: () => void; onSaved?: (t: any) => void }) {
  const { user, isAdmin } = useAuth(); const toast = useToast();
  const users = useUsers(), projects = useProjectsList();
  const manageable = (projects.data ?? []).filter((p) => isAdmin || p.manager_id === user!.id).filter((p) => !["Completed", "Cancelled"].includes(p.status) || p.id === projectId);
  const [f, setF] = useState<any>({ project_id: projectId ?? "", title: "", description: "", assignee_id: "", status: defaultStatus ?? "To Do", priority: "Medium", due_date: "", estimated_hours: "", labels: [] });
  const [err, setErr] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const pid = Number(f.project_id || manageable[0]?.id || 0);
  const project = projects.data?.find((p) => p.id === pid);
  const assignable = (users.data ?? []).filter((u) => u.role !== "Client");

  const save = async () => {
    setBusy(true); setErr({});
    try {
      const t = await api.post("/tasks", {
        project_id: pid, title: f.title.trim(), description: f.description, assignee_id: f.assignee_id ? Number(f.assignee_id) : null,
        status: f.status, priority: f.priority, due_date: f.due_date || null, estimated_hours: f.estimated_hours === "" ? null : Number(f.estimated_hours), labels: f.labels,
      });
      toast("Task created"); invalidate(); onSaved?.(t); onClose();
    } catch (e: any) { setErr(fieldErrors(e)); } finally { setBusy(false); }
  };
  return (
    <Modal wide title="New task" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || f.title.trim().length < 2 || !pid} onClick={save}>{busy ? "Creating…" : "Create task"}</Button></>}>
      {err._ && <div className="badge danger mb-12" role="alert" style={{ height: "auto", padding: "8px 12px", whiteSpace: "normal" }}>{err._}</div>}
      <div className="form-grid">
        <Field label="Title" error={err.title} className="full"><input className="input" autoFocus value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="What needs to be done?" /></Field>
        {!projectId && (
          <Field label="Project" className="full" error={err.project_id}>
            <select className="select" value={pid || ""} onChange={(e) => set("project_id", e.target.value)}>{manageable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </Field>
        )}
        <Field label="Assignee" error={err.assignee_id}>
          <select className="select" value={f.assignee_id} onChange={(e) => set("assignee_id", e.target.value)}>
            <option value="">Unassigned</option>
            {assignable.map((u) => <option key={u.id} value={u.id}>{u.name}{project?.members.some((m) => m.id === u.id) ? " ★" : ""}</option>)}
          </select>
        </Field>
        <Field label="Due date" error={err.due_date}><input className="input" type="date" value={f.due_date} onChange={(e) => set("due_date", e.target.value)} /></Field>
        <Field label="Priority"><select className="select" value={f.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Status"><select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Estimate (hours)" error={err.estimated_hours}><input className="input" type="number" min={0} step={0.5} value={f.estimated_hours} onChange={(e) => set("estimated_hours", e.target.value)} /></Field>
        <Field label="Labels"><TagInput value={f.labels} onChange={(v) => set("labels", v)} placeholder="frontend, urgent…" /></Field>
        <Field label="Description" className="full"><textarea className="textarea" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Details, acceptance criteria, links…" /></Field>
      </div>
    </Modal>
  );
}
