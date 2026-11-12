import { useState } from "react";
import { LuDownload, LuUsers, LuCircleCheck, LuTriangleAlert, LuClock } from "react-icons/lu";
import { api } from "../../lib/api";
import { useQuery } from "../../lib/query";
import { navigate } from "../../lib/router";
import { Avatar, Button, Empty, ErrorState, Progress, Segmented, Skeleton, StatusBadge } from "../../components/ui";
import { HBars, Legend } from "../../components/charts";
import { cx, download, fmtDate } from "../../lib/utils";

export default function Analytics() {
  const [days, setDays] = useState(30);
  const team = useQuery<any>(`/analytics/team?days=${days}`, () => api.get(`/analytics/team?days=${days}`));
  const projects = useQuery<any[]>("/analytics/projects", () => api.get("/analytics/projects"));
  const exportCsv = () => {
    const rows = [["Name", "Role", "Assigned", "Open", `Completed (${days}d)`, "Overdue", "On-time %", "Avg completion days", "Completion rate %"],
      ...team.data.members.map((m: any) => [m.name, m.role, m.assigned, m.open, m.completed, m.overdue, m.on_time_pct ?? "", m.avg_completion_days ?? "", m.completion_rate])];
    download(`team-performance-${days}d.csv`, rows.map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"));
  };
  const T = team.data?.team;
  return (
    <>
      <div className="page-head"><div><h2>Analytics & reports</h2><p>Team performance and project health, computed live from your task data.</p></div>
        <div className="row"><Segmented value={days} onChange={setDays} options={[{ id: 7, label: "7 days" }, { id: 30, label: "30 days" }, { id: 90, label: "90 days" }]} />
          <Button onClick={exportCsv} disabled={!team.data}><LuDownload />Export CSV</Button></div></div>
      {team.error ? <ErrorState error={team.error} retry={team.refetch} /> : (
        <div className="col" style={{ gap: 20 }}>
          <div className="grid g-kpi" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {[{ i: <LuUsers size={19} />, t: "primary", v: T?.assigned, l: "Tasks assigned" }, { i: <LuClock size={19} />, t: "info", v: T?.open, l: "Currently open" },
              { i: <LuCircleCheck size={19} />, t: "success", v: T?.completed, l: `Completed (${days}d)` }, { i: <LuTriangleAlert size={19} />, t: "danger", v: T?.overdue, l: "Overdue" }].map((k, i) => (
              <div key={i} className="card kpi"><div className={`ico tone-${k.t}`}>{k.i}</div><div className="val mono">{team.loading && !T ? "–" : k.v}</div><div className="lab">{k.l}</div></div>))}
          </div>
          <div className="card">
            <div className="card-head"><div><h3>Individual performance</h3><div className="xs muted">On-time % = tasks finished on or before their due date, within the selected period</div></div></div>
            {team.loading && !team.data ? <div style={{ padding: 20 }}><Skeleton h={180} /></div> : (
              <div className="table-wrap" style={{ marginTop: 12 }}><table className="t"><thead><tr><th>Member</th><th>Assigned</th><th>Open</th><th>Completed ({days}d)</th><th>Overdue</th><th>On-time</th><th>Avg. cycle time</th><th style={{ width: 170 }}>Completion rate</th></tr></thead><tbody>
                {team.data.members.map((m: any) => (
                  <tr key={m.id} className="click" onClick={() => navigate(`/team/${m.id}`)}>
                    <td><div className="row"><Avatar name={m.name} color={m.avatar_color} size={34} /><div><div className="bold">{m.name}</div><div className="xs muted">{m.primary_responsibility || m.title}</div></div></div></td>
                    <td className="mono bold">{m.assigned}</td><td className="mono">{m.open}</td><td className="mono bold">{m.completed}</td>
                    <td className="mono">{m.overdue ? <span className="badge danger">{m.overdue}</span> : <span className="muted">0</span>}</td>
                    <td>{m.on_time_pct == null ? <span className="muted">–</span> : <span className={cx("badge", m.on_time_pct >= 80 ? "success" : m.on_time_pct >= 50 ? "warning" : "danger")}>{m.on_time_pct}%</span>}</td>
                    <td className="mono small">{m.avg_completion_days == null ? <span className="muted">–</span> : `${m.avg_completion_days} days`}</td>
                    <td><div className="row"><div className="grow"><Progress value={m.completion_rate} tone={m.completion_rate >= 70 ? "success" : undefined} /></div><b className="xs mono">{m.completion_rate}%</b></div></td></tr>))}</tbody></table></div>)}
          </div>
          <div className="grid g-2">
            <div className="card"><div className="card-head"><div><h3>Workload distribution</h3><div className="xs muted">Open vs overdue tasks</div></div><Legend items={[{ label: "Open", color: "#6d5efc" }, { label: "Overdue", color: "#e5484d" }]} /></div>
              <div className="card-body">{team.data && <HBars rows={team.data.members.filter((m: any) => m.assigned).map((m: any) => ({ label: m.name, avatar: <Avatar name={m.name} color={m.avatar_color} size={26} />, right: `${m.open} open`,
                segments: [{ value: m.open - m.overdue, color: "#6d5efc", name: "On track" }, { value: m.overdue, color: "#e5484d", name: "Overdue" }] }))} />}</div></div>
            <div className="card"><div className="card-head"><div><h3>Throughput</h3><div className="xs muted">Tasks completed in the last {days} days</div></div></div>
              <div className="card-body">{team.data && <HBars rows={[...team.data.members].filter((m: any) => m.assigned).sort((a: any, b: any) => b.completed - a.completed).map((m: any) => ({ label: m.name, avatar: <Avatar name={m.name} color={m.avatar_color} size={26} />, right: `${m.completed} done`,
                segments: [{ value: m.completed, color: "#12a06a", name: "Completed" }] }))} />}</div></div>
          </div>
          <div className="card"><div className="card-head"><div><h3>Project analytics</h3><div className="xs muted">Progress, workload and risk per project</div></div></div>
            {projects.loading && !projects.data ? <div style={{ padding: 20 }}><Skeleton h={150} /></div> : !projects.data?.length ? <Empty title="No projects" /> : (
              <div className="table-wrap" style={{ marginTop: 12 }}><table className="t"><thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Tasks</th><th>Overdue</th><th>Est. hours</th><th>Deadline</th><th style={{ width: 170 }}>Progress</th></tr></thead><tbody>
                {projects.data.map((p: any) => (
                  <tr key={p.id} className="click" onClick={() => navigate(`/projects/${p.id}`)}>
                    <td className="bold">{p.name}</td><td className="small">{p.client_name || "Internal"}</td><td><StatusBadge status={p.status} /></td><td className="mono">{p.done}/{p.total}</td>
                    <td>{p.overdue ? <span className="badge danger">{p.overdue}</span> : <span className="muted">0</span>}</td><td className="mono">{p.est_hours || "–"}</td><td className="small">{fmtDate(p.deadline, true)}</td>
                    <td><div className="row"><div className="grow"><Progress value={p.progress} tone={p.progress === 100 ? "success" : p.overdue ? "danger" : undefined} /></div><b className="xs mono">{p.progress}%</b></div></td></tr>))}</tbody></table></div>)}
          </div>
        </div>)}
    </>
  );
}
