import { useState } from "react";
import { api } from "../../lib/api";
import { invalidate } from "../../lib/query";
import { useAuth, useToast } from "../../lib/store";
import { fieldErrors, useClientsList, useUsers } from "../../lib/hooks";
import { Button, Field, Modal } from "../../components/ui";
import { PRIORITIES, PROJECT_STATUSES, cx } from "../../lib/utils";
import { Project } from "../../lib/types";

export function ProjectForm({ project, onClose, onSaved }: { project?: Project; onClose: () => void; onSaved?: (p: Project) => void }) {
  const { user, isAdmin } = useAuth(); const toast = useToast();
  const users = useUsers(), clients = useClientsList();
  const [f, setF] = useState<any>({
    name: project?.name ?? "", description: project?.description ?? "", client_id: project?.client_id ?? "",
    manager_id: project?.manager_id ?? user!.id, status: project?.status ?? "Planning", priority: project?.priority ?? "Medium",
    start_date: project?.start_date ?? "", deadline: project?.deadline ?? "", budget: project?.budget ?? "",
    member_ids: [] as number[],
  });
  const [err, setErr] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const staff = users.data?.filter((u) => u.role === "Admin" || u.role === "Project Manager") ?? [];
  const people = users.data?.filter((u) => u.role === "Team Member") ?? [];

  const save = async () => {
    setBusy(true); setErr({});
    const body: any = {
      name: f.name.trim(), description: f.description, client_id: f.client_id ? Number(f.client_id) : null,
      status: f.status, priority: f.priority, start_date: f.start_date || null, deadline: f.deadline || null,
      budget: f.budget === "" ? null : Number(f.budget),
    };
    if (isAdmin) body.manager_id = Number(f.manager_id);
    try {
      let saved: Project;
      if (project) saved = await api.patch(`/projects/${project.id}`, body);
      else saved = await api.post("/projects", { ...body, member_ids: f.member_ids });
      toast(project ? "Project updated" : "Project created"); invalidate(); onSaved?.(saved); onClose();
    } catch (e: any) { setErr(fieldErrors(e)); } finally { setBusy(false); }
  };

  return (
    <Modal wide title={project ? "Edit project" : "New project"} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || f.name.trim().length < 2} onClick={save}>{busy ? "Saving…" : project ? "Save changes" : "Create project"}</Button></>}>
      {err._ && <div className="badge danger mb-12" role="alert" style={{ height: "auto", padding: "8px 12px", whiteSpace: "normal" }}>{err._}</div>}
      <div className="form-grid">
        <Field label="Project name" error={err.name} className="full"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Acme Website Revamp" autoFocus /></Field>
        <Field label="Client" error={err.client_id}>
          <select className="select" value={f.client_id} onChange={(e) => set("client_id", e.target.value)}>
            <option value="">Internal (no client)</option>{clients.data?.filter((c) => c.status !== "Inactive" || c.id === project?.client_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Project manager" error={err.manager_id}>
          <select className="select" value={f.manager_id} disabled={!isAdmin} onChange={(e) => set("manager_id", e.target.value)}>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
          </select>
        </Field>
        <Field label="Status"><select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>{PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Priority"><select className="select" value={f.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Start date" error={err.start_date}><input className="input" type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
        <Field label="Deadline" error={err.deadline || err[""]}><input className="input" type="date" value={f.deadline} min={f.start_date || undefined} onChange={(e) => set("deadline", e.target.value)} /></Field>
        <Field label="Budget (₹)" error={err.budget}><input className="input" type="number" min={0} value={f.budget} onChange={(e) => set("budget", e.target.value)} placeholder="Optional" /></Field>
        <div />
        <Field label="Description" className="full"><textarea className="textarea" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="What is this project about? Scope, goals, notes…" /></Field>
        {!project && (
          <Field label="Team members" className="full">
            <div className="row wrap gap-8">
              {people.map((u) => { const on = f.member_ids.includes(u.id); return (
                <button key={u.id} type="button" className={cx("chip toggle", on && "on")} onClick={() => set("member_ids", on ? f.member_ids.filter((x: number) => x !== u.id) : [...f.member_ids, u.id])}>{u.name}</button>); })}
            </div>
          </Field>
        )}
      </div>
    </Modal>
  );
}
