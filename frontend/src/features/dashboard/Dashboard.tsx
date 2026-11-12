import { useState } from "react";
import { LuFolderKanban, LuListChecks, LuTriangleAlert, LuCalendarClock, LuTarget, LuPlus, LuFlame, LuArrowRight, LuShieldCheck, LuFlag } from "react-icons/lu";
import { api } from "../../lib/api";
import { useQuery } from "../../lib/query";
import { useAuth } from "../../lib/store";
import { navigate } from "../../lib/router";
import { Avatar, Button, Empty, ErrorState, PageSkeleton, PriorityBadge, Progress, Ring, Segmented, StatusBadge } from "../../components/ui";
import { Donut, HBars, Legend, TrendChart } from "../../components/charts";
import { ActivityFeed } from "../../components/ActivityFeed";
import { STATUS_COLOR, TASK_STATUSES, cx, fmtDate, dueLabel, parseDate } from "../../lib/utils";
import { ProjectForm } from "../projects/ProjectForm";
import { TaskForm } from "../tasks/TaskForm";
import { TaskDrawer } from "../tasks/TaskDrawer";

function Kpi({ icon, tone, value, label, sub, onClick }: any) {
  return (
    <div className={cx("card kpi", onClick && "hover")} onClick={onClick}>
      <div className={`ico tone-${tone}`}>{icon}</div>
      <div className="val mono">{value}</div><div className="lab">{label}</div>
      {sub && <div className="sub muted">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user, isStaff } = useAuth();
  const [days, setDays] = useState(30);
  const [newProject, setNewProject] = useState(false), [newTask, setNewTask] = useState(false), [openTask, setOpenTask] = useState<number | null>(null);
  const { data, error, loading, refetch } = useQuery<any>(`/dashboard/overview?days=${days}`, () => api.get(`/dashboard/overview?days=${days}`));
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const personal = data?.scope === "personal";

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{greet}, {user!.name.split(" ")[0]} 👋</h2>
          <p>{personal ? "Here's your personal workload and what needs attention first." : data?.scope === "managed" ? "Health of the projects you manage." : "Here's how the whole agency is doing right now."}</p>
        </div>
        <div className="row wrap">
          <Segmented value={days} onChange={setDays} options={[{ id: 7, label: "7 days" }, { id: 30, label: "30 days" }, { id: 90, label: "90 days" }]} />
          {isStaff && <><Button onClick={() => setNewTask(true)}><LuPlus />New task</Button><Button variant="primary" onClick={() => setNewProject(true)}><LuPlus />New project</Button></>}
        </div>
      </div>

      {loading && !data ? <PageSkeleton /> : error ? <ErrorState error={error} retry={refetch} /> : data && (
        <div className="col gap-20" style={{ gap: 20 }}>
          <div className="grid g-kpi">
            <Kpi icon={<LuFolderKanban size={19} />} tone="primary" value={data.kpis.active_projects} label="Active projects" sub={`${data.projects_by_status.reduce((s: number, x: any) => s + x.count, 0)} total`} onClick={() => navigate("/projects")} />
            <Kpi icon={<LuListChecks size={19} />} tone="info" value={data.kpis.open_tasks} label={personal ? "My open tasks" : "Open tasks"} sub={`${data.kpis.blocked_tasks} blocked`} onClick={() => navigate(personal ? "/my-tasks" : "/tasks")} />
            <Kpi icon={<LuTriangleAlert size={19} />} tone={data.kpis.overdue_tasks ? "danger" : "success"} value={data.kpis.overdue_tasks} label="Overdue tasks"
                 sub={data.kpis.overdue_tasks ? <span style={{ color: "var(--danger)", fontWeight: 600 }}>Needs attention</span> : "Nothing overdue"} onClick={() => navigate(personal ? "/my-tasks" : "/tasks?overdue=1")} />
            <Kpi icon={<LuCalendarClock size={19} />} tone="warning" value={data.kpis.due_this_week} label="Due in next 7 days" sub={`${data.kpis.completed_in_period} completed (${days}d)`} />
            <div className="card kpi row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><div className="ico tone-success"><LuTarget size={19} /></div><div className="val mono">{data.kpis.completion_rate}%</div><div className="lab">Completion rate</div>
                <div className="sub muted">{data.kpis.total_tasks} tasks overall</div></div>
              <Ring value={data.kpis.completion_rate} size={62} color="var(--success)" />
            </div>
          </div>

          <div className="grid g-21">
            <div className="card">
              <div className="card-head"><div><h3>Completed vs created</h3><div className="xs muted">Tasks per week, last 8 weeks</div></div>
                <Legend items={[{ label: "Completed", color: "#6d5efc" }, { label: "Created", color: "#22b8cf" }]} /></div>
              <div className="card-body"><TrendChart data={data.completed_per_week.map((w: any) => ({ label: w.label, a: w.completed, b: w.created }))} /></div>
            </div>
            <div className="card">
              <div className="card-head"><div><h3>Tasks by status</h3><div className="xs muted">{personal ? "Your tasks" : "In scope"}</div></div></div>
              <div className="card-body col" style={{ alignItems: "center", gap: 14 }}>
                <Donut data={data.tasks_by_status.map((s: any) => ({ label: s.status, value: s.count, color: STATUS_COLOR[s.status] }))} center={{ value: data.kpis.total_tasks, label: "Tasks" }} />
                <Legend items={TASK_STATUSES.map((s) => ({ label: `${s} · ${data.tasks_by_status.find((x: any) => x.status === s)?.count ?? 0}`, color: STATUS_COLOR[s] }))} />
              </div>
            </div>
          </div>

          <div className="grid g-2">
            <div className="card">
              <div className="card-head"><div><h3>Upcoming deadlines</h3><div className="xs muted">Next 14 days, including overdue</div></div></div>
              <div style={{ marginTop: 10 }}>
                {!data.upcoming_deadlines.length && <Empty icon={<LuShieldCheck size={24} />} title="No deadlines in the next two weeks" text="You're clear. Enjoy the calm." />}
                {data.upcoming_deadlines.slice(0, 7).map((d: any, i: number) => {
                  const dt = parseDate(d.due_date)!; const tone = d.overdue ? "danger" : d.days_left <= 3 ? "warning" : "";
                  return (
                    <div key={i} className="list-item click" onClick={() => d.type === "task" ? setOpenTask(d.id) : navigate(`/projects/${d.id}`)}>
                      <div className={cx("date-pill", tone)}><b>{dt.getDate()}</b><span>{dt.toLocaleString("en", { month: "short" })}</span></div>
                      <div className="grow">
                        <div className="bold truncate small row gap-6">{d.type === "project" && <LuFlag size={13} color="var(--primary)" />}{d.title}</div>
                        <div className="xs muted truncate">{d.project_name}{d.assignee_name ? ` · ${d.assignee_name}` : ""}</div>
                      </div>
                      <div style={{ textAlign: "right" }}><div className={cx("due", d.overdue ? "overdue" : d.days_left <= 3 ? "soon" : "")}>{dueLabel(d.days_left)}</div><PriorityBadge priority={d.priority} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
            {personal ? (
              <div className="card">
                <div className="card-head"><div><h3>Recent activity</h3><div className="xs muted">What's been happening on your projects</div></div></div>
                <div className="card-body">{data.recent_activity.length ? <ActivityFeed items={data.recent_activity} /> : <Empty title="No activity yet" />}</div>
              </div>
            ) : (
              <div className="card">
                <div className="card-head"><div><h3>Team workload</h3><div className="xs muted">Open tasks per person</div></div>
                  <Legend items={[{ label: "On track", color: "#6d5efc" }, { label: "Overdue", color: "#e5484d" }]} /></div>
                <div className="card-body">
                  {!data.workload.length ? <Empty title="No assigned tasks" /> : <HBars rows={data.workload.map((w: any) => ({
                    label: w.name, avatar: <Avatar name={w.name} color={w.color} size={26} />, right: `${w.open} open`,
                    segments: [{ value: w.open - w.overdue, color: "#6d5efc", name: "On track" }, { value: w.overdue, color: "#e5484d", name: "Overdue" }] }))} />}
                  <div className="divider" />
                  <div className="small bold mb-12">Projects by status</div>
                  <HBars rows={data.projects_by_status.filter((x: any) => x.count).map((x: any) => ({ label: x.status, right: String(x.count), segments: [{ value: x.count, color: STATUS_COLOR[x.status], name: x.status }] }))} />
                </div>
              </div>
            )}
          </div>

          {!personal && (
            <div className="grid g-2">
              <div className="card">
                <div className="card-head"><div><h3 className="row gap-8"><LuFlame color="var(--danger)" size={18} />Projects at risk</h3><div className="xs muted">Overdue work, blockers or tight deadlines</div></div></div>
                <div className="card-body">
                  {!data.at_risk_projects.length && <Empty icon={<LuShieldCheck size={24} />} title="All active projects are healthy" />}
                  {data.at_risk_projects.map((p: any) => (
                    <div key={p.id} className="risk" onClick={() => navigate(`/projects/${p.id}`)}>
                      <div className="row between"><div className="bold small">{p.name}</div><span className="xs muted">{p.client_name || "Internal"}</span></div>
                      <div className="xs mt-8 row wrap gap-6" style={{ color: "var(--danger)", fontWeight: 600 }}>{p.reasons.map((r: string) => <span key={r} className="badge danger">{r}</span>)}</div>
                      <div className="row mt-12"><div className="grow"><Progress value={p.progress} tone="danger" /></div><span className="xs bold mono">{p.progress}%</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-head"><div><h3>Recent activity</h3><div className="xs muted">Latest updates across projects</div></div><Button variant="ghost" size="sm" onClick={() => navigate("/activity")}>View all <LuArrowRight /></Button></div>
                <div className="card-body">{data.recent_activity.length ? <ActivityFeed items={data.recent_activity} /> : <Empty title="No activity yet" />}</div>
              </div>
            </div>
          )}
        </div>
      )}
      {newProject && <ProjectForm onClose={() => setNewProject(false)} onSaved={(p) => navigate(`/projects/${p.id}`)} />}
      {newTask && <TaskForm onClose={() => setNewTask(false)} />}
      {openTask && <TaskDrawer id={openTask} onClose={() => setOpenTask(null)} />}
    </>
  );
}
