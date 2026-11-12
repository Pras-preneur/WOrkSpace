import { FormEvent, useState } from "react";
import { LuArrowRight, LuShieldCheck, LuSparkles, LuLayoutDashboard, LuClock, LuEye, LuEyeOff } from "react-icons/lu";
import { Logo } from "../../components/Layout";
import { Avatar, Button, Field } from "../../components/ui";
import { useAuth } from "../../lib/store";
import { navigate } from "../../lib/router";

const DEMO = [
  { label: "Admin", name: "Aditi Rao", email: "admin@origintheory.io", pw: "Admin@123", color: "#7c3aed" },
  { label: "Project Manager", name: "Rohan Mehta", email: "pm@origintheory.io", pw: "Welcome@123", color: "#0ea5e9" },
  { label: "Web / Software", name: "Sarvadnya Patil", email: "sarvadnya@origintheory.io", pw: "Welcome@123", color: "#6366f1" },
  { label: "Cybersecurity", name: "Manmohan Havanur", email: "manmohan@origintheory.io", pw: "Welcome@123", color: "#ef4444" },
  { label: "AI / ML & Media", name: "Prasanna Hosmani", email: "prasanna@origintheory.io", pw: "Welcome@123", color: "#10b981" },
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [show, setShow] = useState(false);
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);

  const go = async (e: string, p: string) => {
    setBusy(true); setErr("");
    try { await login(e, p); navigate("/", { replace: true }); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  const submit = (ev: FormEvent) => { ev.preventDefault(); go(email, pw); };

  return (
    <div className="login">
      <section className="login-art" aria-hidden="true">
        <div className="row gap-14"><Logo size={44} /><div style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-.02em" }}>OriginTheory</div></div>
        <div>
          <h1>One workspace for every <span>team, project and deadline.</span></h1>
          <p style={{ color: "#aeb4d8", maxWidth: 470, fontSize: 16, marginTop: 18 }}>Plan work, assign ownership, track progress and see how the whole agency is performing, in real time.</p>
        </div>
        <div className="login-feats">
          <div className="login-feat"><LuLayoutDashboard size={20} /><div><b>Live dashboards</b>Team & project health at a glance</div></div>
          <div className="login-feat"><LuClock size={20} /><div><b>Deadline radar</b>Overdue & due-soon flagged everywhere</div></div>
          <div className="login-feat"><LuShieldCheck size={20} /><div><b>Role-based access</b>Admin, PM and member views</div></div>
          <div className="login-feat"><LuSparkles size={20} /><div><b>Built to scale</b>Ready for AI assist & client portal</div></div>
        </div>
      </section>
      <section className="login-form">
        <div className="login-box">
          <div className="row gap-8 mb-12" style={{ display: "none" }}><Logo /></div>
          <h2>Welcome back</h2>
          <p className="muted" style={{ margin: "6px 0 24px" }}>Sign in to your OriginTheory workspace.</p>
          <form className="col gap-14" onSubmit={submit} noValidate>
            <Field label="Work email"><input className="input" type="email" autoComplete="username" placeholder="you@origintheory.io" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
            <Field label="Password">
              <div style={{ position: "relative" }}>
                <input className="input" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} required style={{ paddingRight: 44 }} />
                <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)}
                        style={{ position: "absolute", right: 6, top: 6, border: 0, background: "none", color: "var(--muted)", width: 28, height: 28 }}>{show ? <LuEyeOff /> : <LuEye />}</button>
              </div>
            </Field>
            {err && <div role="alert" className="badge danger" style={{ height: "auto", padding: "9px 12px", borderRadius: 10, whiteSpace: "normal", fontWeight: 500 }}>{err}</div>}
            <Button variant="primary" type="submit" disabled={busy || !email || !pw} style={{ height: 44 }}>{busy ? "Signing in…" : <>Sign in <LuArrowRight /></>}</Button>
          </form>
          <div className="divider" style={{ margin: "26px 0 14px" }} />
          <div className="small muted bold">Demo accounts — click to sign in instantly</div>
          <div className="demo-grid">
            {DEMO.map((d) => (
              <button key={d.email} className="demo-btn" disabled={busy} onClick={() => go(d.email, d.pw)} style={d.label === "AI / ML & Media" ? { gridColumn: "1 / -1" } : {}}>
                <Avatar name={d.name} color={d.color} size={30} />
                <span style={{ minWidth: 0 }}><span className="bold small" style={{ display: "block" }}>{d.name}</span><span className="xs muted">{d.label}</span></span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
