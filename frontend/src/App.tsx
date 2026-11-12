import { ReactNode } from "react";
import { LuCompass } from "react-icons/lu";
import { Layout } from "./components/Layout";
import { Button, Empty } from "./components/ui";
import { match, navigate, usePath } from "./lib/router";
import { useAuth } from "./lib/store";
import Login from "./features/auth/Login";
import Dashboard from "./features/dashboard/Dashboard";
import Projects from "./features/projects/Projects";
import ProjectDetail from "./features/projects/ProjectDetail";
import MyTasks from "./features/tasks/MyTasks";
import AllTasks from "./features/tasks/AllTasks";
import Team from "./features/team/Team";
import Profile from "./features/team/Profile";
import Clients, { ClientDetail } from "./features/clients/Clients";
import Analytics from "./features/analytics/Analytics";
import Activity from "./features/activity/Activity";

function Splash() { return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><div className="skeleton" style={{ width: 56, height: 56, borderRadius: 16 }} /></div>; }
const Forbidden = () => <div className="card"><Empty icon={<LuCompass size={26} />} title="You don't have access to this page" text="Ask an admin if you need permission." action={<Button onClick={() => navigate("/")}>Back to dashboard</Button>} /></div>;

export default function App() {
  const { user, ready, isStaff } = useAuth();
  const path = usePath().split("?")[0];
  if (!ready) return <Splash />;
  if (!user) { if (path !== "/login") setTimeout(() => navigate("/login", { replace: true }), 0); return <Login />; }
  if (path === "/login") { setTimeout(() => navigate("/", { replace: true }), 0); return <Splash />; }

  let page: ReactNode; let m: Record<string, string> | null;
  if (path === "/") page = <Dashboard />;
  else if (path === "/my-tasks") page = <MyTasks />;
  else if (path === "/projects") page = <Projects />;
  else if ((m = match("/projects/:id", path))) page = <ProjectDetail key={m.id} id={Number(m.id)} />;
  else if (path === "/tasks") page = isStaff ? <AllTasks /> : <Forbidden />;
  else if (path === "/team") page = <Team />;
  else if ((m = match("/team/:id", path))) page = <Profile key={m.id} id={Number(m.id)} />;
  else if (path === "/clients") page = isStaff ? <Clients /> : <Forbidden />;
  else if ((m = match("/clients/:id", path))) page = isStaff ? <ClientDetail key={m.id} id={Number(m.id)} /> : <Forbidden />;
  else if (path === "/analytics") page = isStaff ? <Analytics /> : <Forbidden />;
  else if (path === "/activity") page = <Activity />;
  else page = <div className="card"><Empty icon={<LuCompass size={26} />} title="Page not found" text="That page doesn't exist." action={<Button onClick={() => navigate("/")}>Go home</Button>} /></div>;
  return <Layout>{page}</Layout>;
}
