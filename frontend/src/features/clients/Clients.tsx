import { useState } from "react";
import { LuPlus, LuSearch, LuMail, LuPhone, LuArrowLeft, LuBuilding2, LuPencil, LuTrash2 } from "react-icons/lu";
import { api, qs } from "../../lib/api";
import { invalidate, useQuery } from "../../lib/query";
import { useAuth, useToast } from "../../lib/store";
import { navigate } from "../../lib/router";
import { fieldErrors } from "../../lib/hooks";
import { Button, Empty, ErrorState, Field, Modal, Progress, Skeleton, StatusBadge } from "../../components/ui";
import { Client } from "../../lib/types";
import { fmtDate } from "../../lib/utils";

export default function Clients() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState(""), [status, setStatus] = useState(""), [form, setForm] = useState<Client | "new" | null>(null);
  const key = `/clients${qs({ search, status })}`;
  const { data, loading, error, refetch } = useQuery<Client[]>(key, () => api.get(key));
  return (
    <>
      <div className="page-head"><div><h2>Clients</h2><p>Track every client relationship and the projects behind it.</p></div><Button variant="primary" onClick={() => setForm("new")}><LuPlus />Add client</Button></div>
      <div className="row wrap mb-16">
        <div className="search" style={{ width: 280 }}><LuSearch /><input className="input" placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search clients" /></div>
        <select className="select" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option><option>Active</option><option>Lead</option><option>Inactive</option></select>
      </div>
      {loading && !data ? <Skeleton h={260} r={14} /> : error ? <ErrorState error={error} retry={refetch} /> :
        !data?.length ? <div className="card"><Empty icon={<LuBuilding2 size={26} />} title="No clients yet" action={<Button variant="primary" onClick={() => setForm("new")}><LuPlus />Add client</Button>} /></div> : (
        <div className="card table-wrap"><table className="t"><thead><tr><th>Client</th><th>Contact</th><th>Status</th><th>Projects</th><th>Active</th></tr></thead><tbody>
          {data.map((c) => (
            <tr key={c.id} className="click" onClick={() => navigate(`/clients/${c.id}`)}>
              <td><div className="row"><span className="tl-ico" style={{ borderRadius: 11, width: 38, height: 38 }}><LuBuilding2 size={18} /></span><div><div className="bold">{c.name}</div><div className="xs muted">{c.company}</div></div></div></td>
              <td><div className="small bold">{c.contact_person || "—"}</div><div className="xs muted">{c.email}</div></td>
              <td><StatusBadge status={c.status} /></td><td className="bold mono">{c.project_count}</td><td className="mono">{c.active_projects}</td></tr>))}</tbody></table></div>)}
      {form && <ClientForm client={form === "new" ? undefined : form} onClose={() => setForm(null)} />}
    </>
  );
}

export function ClientDetail({ id }: { id: number }) {
  const { isAdmin } = useAuth(); const toast = useToast();
  const { data: c, loading, error, refetch } = useQuery<Client>(`/clients/${id}`, () => api.get(`/clients/${id}`));
  const [edit, setEdit] = useState(false);
  if (error) return <div className="card"><ErrorState error={error} retry={refetch} /></div>;
  if (loading && !c) return <Skeleton h={300} r={14} />;
  if (!c) return null;
  return (
    <>
      <a className="small muted row gap-6 bold mb-12" href="#/clients" style={{ width: "fit-content" }}><LuArrowLeft size={15} />Clients</a>
      <div className="card card-pad row between wrap" style={{ marginBottom: 20, alignItems: "flex-start", gap: 20 }}>
        <div><div className="row gap-8"><h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em" }}>{c.name}</h2><StatusBadge status={c.status} /></div>
          <div className="text-2">{c.company}</div>
          <div className="row wrap small muted mt-12" style={{ gap: 18 }}><span className="bold text-2">{c.contact_person}</span>{c.email && <span className="row gap-6"><LuMail size={14} />{c.email}</span>}{c.phone && <span className="row gap-6"><LuPhone size={14} />{c.phone}</span>}</div></div>
        <div className="row"><Button onClick={() => setEdit(true)}><LuPencil />Edit</Button>
          {isAdmin && <Button variant="danger" icon aria-label="Archive client" onClick={async () => { if (confirm(`Archive ${c.name}?`)) { await api.del(`/clients/${id}`); invalidate(); toast("Client archived"); navigate("/clients"); } }}><LuTrash2 /></Button>}</div>
      </div>
      <div className="grid g-21">
        <div className="card"><div className="card-head"><h3>Projects ({c.projects?.length ?? 0})</h3></div><div style={{ marginTop: 8 }}>
          {!c.projects?.length && <Empty title="No projects for this client yet" />}
          {c.projects?.map((p: any) => (
            <div key={p.id} className="list-item click" onClick={() => navigate(`/projects/${p.id}`)}>
              <div className="grow"><div className="bold">{p.name}</div><div className="xs muted">Deadline {fmtDate(p.deadline, true)}</div></div>
              <div style={{ width: 150 }}><div className="row"><div className="grow"><Progress value={p.progress} /></div><b className="xs mono">{p.progress}%</b></div></div><StatusBadge status={p.status} /></div>))}</div></div>
        <div className="card card-pad"><h3 style={{ fontSize: 15 }}>Notes</h3><p className="text-2" style={{ whiteSpace: "pre-wrap", margin: "10px 0 0" }}>{c.notes || "No notes yet."}</p></div>
      </div>
      {edit && <ClientForm client={c} onClose={() => setEdit(false)} />}
    </>
  );
}

function ClientForm({ client, onClose }: { client?: Client; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<any>({ name: client?.name ?? "", company: client?.company ?? "", contact_person: client?.contact_person ?? "", email: client?.email ?? "", phone: client?.phone ?? "", status: client?.status ?? "Active", notes: client?.notes ?? "" });
  const [err, setErr] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const save = async () => {
    setBusy(true); setErr({});
    try { client ? await api.patch(`/clients/${client.id}`, f) : await api.post("/clients", f); toast(client ? "Client updated" : "Client added"); invalidate(); onClose(); }
    catch (e: any) { setErr(fieldErrors(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title={client ? "Edit client" : "Add client"} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || f.name.trim().length < 2} onClick={save}>{busy ? "Saving…" : "Save client"}</Button></>}>
      {err._ && <div className="badge danger mb-12" role="alert" style={{ height: "auto", padding: "8px 12px", whiteSpace: "normal" }}>{err._}</div>}
      <div className="form-grid">
        <Field label="Client name" error={err.name}><input className="input" value={f.name} autoFocus onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Company"><input className="input" value={f.company} onChange={(e) => set("company", e.target.value)} /></Field>
        <Field label="Contact person"><input className="input" value={f.contact_person} onChange={(e) => set("contact_person", e.target.value)} /></Field>
        <Field label="Status"><select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}><option>Lead</option><option>Active</option><option>Inactive</option></select></Field>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Notes" className="full"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
