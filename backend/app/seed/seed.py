"""Demo data seeder.  Run:  python -m app.seed.seed [--reset]
Dates are generated relative to today so dashboards always look alive."""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

from ..core import config
from ..core.security import hash_password
from ..db.database import get_db, init_db

PW_ADMIN, PW_USER = "Admin@123", "Welcome@123"


def ts(days_ago=0, hour=10):
    d = datetime.now(timezone.utc).replace(hour=hour, minute=12, second=0, microsecond=0) - timedelta(days=days_ago)
    return d.strftime("%Y-%m-%dT%H:%M:%S")


def dt(offset):
    return (datetime.now(timezone.utc).date() + timedelta(days=offset)).isoformat()


USERS = [
    # key, email, name, role, title, primary, responsibilities, skills, color, pw
    ("admin", "admin@origintheory.io", "Aditi Rao", "Admin", "Founder & Managing Director", "Agency Operations",
     ["Client Relations", "Strategy", "Hiring"], ["Leadership", "Strategy", "Sales"], "#7c3aed", PW_ADMIN),
    ("pm", "pm@origintheory.io", "Rohan Mehta", "Project Manager", "Delivery Lead", "Project Management",
     ["Delivery Planning", "Client Communication", "Sprint Management"], ["Agile", "Scrum", "Roadmapping"], "#0ea5e9", PW_USER),
    ("sarvadnya", "sarvadnya@origintheory.io", "Sarvadnya Patil", "Team Member", "Full-Stack Developer",
     "Web Development / Software Development", ["Frontend Engineering", "Backend APIs", "DevOps"],
     ["React", "TypeScript", "Python", "FastAPI", "PostgreSQL"], "#6366f1", PW_USER),
    ("manmohan", "manmohan@origintheory.io", "Manmohan Havanur", "Team Member", "Security Analyst",
     "Cybersecurity / VAPT Analysis", ["Vulnerability Assessment", "Penetration Testing", "Security Reporting"],
     ["VAPT", "OWASP", "Burp Suite", "Network Security", "Threat Modeling"], "#ef4444", PW_USER),
    ("prasanna", "prasanna@origintheory.io", "Prasanna Hosmani", "Team Member", "AI/ML & Media Specialist",
     "Media Management / AI & ML", ["ML Modeling", "Content & Media", "Prompt Engineering"],
     ["Machine Learning", "LLMs", "Video Editing", "Python", "Design"], "#10b981", PW_USER),
]

CLIENTS = [
    ("Lumen Retail", "Lumen Retail Pvt Ltd", "Kavya Nair", "kavya@lumenretail.example", "+91 98450 11122", "Active",
     "D2C fashion brand. Prefers weekly Friday updates. Decision maker: Kavya."),
    ("Northwind Health", "Northwind Healthcare Ltd", "Dr. Imran Shaikh", "imran@northwindhealth.example", "+91 98860 22233", "Active",
     "Healthcare provider. Compliance-sensitive: all reports go through their CISO."),
    ("Aster Finance", "Aster Finance Technologies", "Meera Joshi", "meera@asterfin.example", "+91 99000 33344", "Active",
     "Fintech startup exploring AI-driven customer support."),
    ("Helix Logistics", "Helix Logistics", "Vikram Rao", "vikram@helixlogistics.example", "+91 97410 44455", "Lead",
     "Inbound lead. Discovery call scheduled; interested in dashboards."),
]

# key, name, desc, client_idx, status, priority, start_off, deadline_off, budget, member keys, role map
PROJECTS = [
    ("lumen_store", "Lumen Storefront Redesign", "Headless e-commerce storefront with new design system, faster checkout and product video support.",
     0, "Active", "High", -42, 18, 850000, ["sarvadnya", "prasanna"]),
    ("nw_vapt", "Northwind Security Assessment (VAPT)", "External + internal VAPT for patient portal and API surface, with executive reporting.",
     1, "Active", "Urgent", -25, 8, 620000, ["manmohan", "sarvadnya"]),
    ("aster_ai", "Aster AI Support Assistant", "RAG-based support assistant with escalation to human agents and analytics.",
     2, "Active", "Medium", -20, 52, 1200000, ["prasanna", "sarvadnya", "manmohan"]),
    ("ot_site", "OriginTheory Brand Website", "Internal: new agency website, case studies and AI-assisted lead capture.",
     None, "Planning", "Low", -5, 70, 150000, ["sarvadnya", "prasanna"]),
    ("lumen_lp", "Lumen Mobile Landing Pages", "Campaign landing pages for the Diwali sale. Delivered and signed off.",
     0, "Completed", "Medium", -80, -30, 240000, ["sarvadnya", "prasanna"]),
]

# project key, title, assignee, status, priority, due_off, est_h, labels, created_ago, completed_ago, description, subtasks
TASKS = [
    # --- Lumen Storefront
    ("lumen_store", "Design system tokens & component library", "sarvadnya", "Done", "High", -20, 24, ["frontend", "design-system"], 40, 22,
     "Colors, typography, spacing and base components in Storybook.", [("Define tokens", 1), ("Build buttons/inputs", 1), ("Publish Storybook", 1)]),
    ("lumen_store", "Product listing page (PLP) with filters", "sarvadnya", "Done", "High", -9, 20, ["frontend"], 30, 11, "Faceted filters, sorting, infinite scroll.", []),
    ("lumen_store", "Product detail page + video gallery", "sarvadnya", "In Progress", "High", 3, 18, ["frontend", "media"], 14, None,
     "PDP with variant selector and embedded product videos.", [("Variant selector", 1), ("Video gallery component", 0), ("Zoom interaction", 0)]),
    ("lumen_store", "Checkout flow optimisation", "sarvadnya", "To Do", "Urgent", -2, 16, ["frontend", "payments"], 10, None,
     "Reduce checkout steps from 5 to 3; integrate UPI intent flow.", [("Audit current funnel", 0), ("Wireframe new flow", 0)]),
    ("lumen_store", "Hero video & lookbook edits", "prasanna", "In Review", "Medium", 2, 12, ["media"], 12, None,
     "Cut 3 hero videos (15s/30s) and lookbook stills for launch.", []),
    ("lumen_store", "Image CDN & performance budget", "sarvadnya", "Blocked", "Medium", 6, 8, ["performance"], 9, None,
     "Blocked: waiting for client to share CDN account access.", []),
    ("lumen_store", "Product copy tone-of-voice pass (AI-assisted)", "prasanna", "To Do", "Low", 12, 6, ["ai", "content"], 6, None, "", []),
    ("lumen_store", "Analytics events spec", "sarvadnya", "Done", "Medium", -14, 5, ["analytics"], 35, 15, "", []),
    # --- Northwind VAPT
    ("nw_vapt", "Scoping & rules of engagement sign-off", "manmohan", "Done", "High", -22, 6, ["planning"], 25, 23, "", []),
    ("nw_vapt", "External network reconnaissance", "manmohan", "Done", "High", -15, 16, ["recon"], 24, 16, "", []),
    ("nw_vapt", "Web application testing: patient portal", "manmohan", "In Progress", "Urgent", 2, 30, ["web", "owasp"], 18, None,
     "OWASP Top 10 coverage, auth/session testing, IDOR checks.",
     [("Auth & session mgmt", 1), ("Access control / IDOR", 1), ("Injection testing", 0), ("File upload review", 0)]),
    ("nw_vapt", "API security testing", "manmohan", "To Do", "High", 4, 20, ["api"], 12, None, "", []),
    ("nw_vapt", "Fix verification retest: critical findings", "sarvadnya", "To Do", "High", 7, 8, ["retest"], 4, None,
     "Coordinate with Northwind devs and verify patches for critical issues.", []),
    ("nw_vapt", "Executive summary & technical report", "manmohan", "To Do", "Urgent", -1, 14, ["reporting"], 8, None,
     "Report template reviewed by Northwind CISO. Draft is overdue.", [("Findings write-up", 0), ("Risk ratings", 0), ("Remediation roadmap", 0)]),
    ("nw_vapt", "Security hardening checklist for client devs", "sarvadnya", "In Review", "Medium", 3, 6, ["docs"], 7, None, "", []),
    # --- Aster AI
    ("aster_ai", "Knowledge base ingestion pipeline", "prasanna", "Done", "High", -6, 18, ["ai", "data"], 19, 7, "", []),
    ("aster_ai", "Embedding & retrieval evaluation", "prasanna", "In Progress", "High", 5, 22, ["ai", "evaluation"], 15, None,
     "Compare 3 embedding models on 200 labelled support questions.", [("Build eval set", 1), ("Run baseline", 1), ("Compare models", 0)]),
    ("aster_ai", "Chat backend API (FastAPI)", "sarvadnya", "In Progress", "High", 9, 24, ["backend"], 14, None, "", []),
    ("aster_ai", "Guardrails & PII redaction", "manmohan", "To Do", "High", 12, 14, ["security", "ai"], 10, None,
     "Prompt-injection tests, PII redaction before logging.", []),
    ("aster_ai", "Agent hand-off UX", "sarvadnya", "To Do", "Medium", 20, 12, ["frontend"], 8, None, "", []),
    ("aster_ai", "Weekly conversation analytics dashboard", "prasanna", "To Do", "Low", 30, 10, ["analytics"], 5, None, "", []),
    ("aster_ai", "Threat model workshop", "manmohan", "Done", "Medium", -10, 4, ["security"], 17, 11, "", []),
    # --- OT website
    ("ot_site", "Content strategy & sitemap", "prasanna", "In Progress", "Medium", 8, 8, ["content"], 4, None, "", []),
    ("ot_site", "Case study: Lumen redesign write-up", "prasanna", "To Do", "Low", 25, 6, ["content"], 3, None, "", []),
    ("ot_site", "Site architecture & tech spike", "sarvadnya", "To Do", "Medium", 14, 6, ["frontend"], 3, None, "", []),
    ("ot_site", "Security headers & CSP baseline", "manmohan", "To Do", "Low", 40, 4, ["security"], 2, None, "", []),
    # --- Completed Lumen LP
    ("lumen_lp", "Landing page build (3 variants)", "sarvadnya", "Done", "High", -38, 20, ["frontend"], 70, 41, "", []),
    ("lumen_lp", "Campaign creatives & short videos", "prasanna", "Done", "Medium", -36, 14, ["media"], 68, 38, "", []),
    ("lumen_lp", "A/B test setup & QA", "sarvadnya", "Done", "Medium", -33, 6, ["qa"], 60, 33, "", []),
    ("lumen_lp", "Client handover & training", "prasanna", "Done", "Low", -30, 3, ["handover"], 45, 31, "", []),
    ("lumen_lp", "Post-launch performance report", "sarvadnya", "Done", "Low", -26, 5, ["analytics"], 40, 27, "", []),
    ("lumen_lp", "Accessibility audit fixes", "sarvadnya", "Done", "Medium", -55, 8, ["a11y"], 75, 58, "", []),
]

PROJECT_COMMENTS = [
    ("lumen_store", "pm", "Kickoff notes shared with Kavya. Launch window is firm, so we're prioritising PDP and checkout.", 30),
    ("lumen_store", "sarvadnya", "PLP is live on staging. Filters are stable. Starting on PDP video gallery.", 9),
    ("lumen_store", "prasanna", "Hero video v2 is in review. Need approval on the music license before final export.", 3),
    ("lumen_store", "pm", "Checkout is slipping. Rohan to sync with Kavya on UPI intent requirements tomorrow.", 1),
    ("nw_vapt", "manmohan", "Recon complete. Found 2 exposed staging hosts. Escalated to Northwind's CISO the same day.", 14),
    ("nw_vapt", "pm", "Reminder: the report format needs CISO sign-off. Please share a draft outline early.", 4),
    ("nw_vapt", "manmohan", "Portal testing: two high-severity access control issues confirmed. Writing PoCs.", 2),
    ("aster_ai", "prasanna", "Ingestion pipeline is done. Initial retrieval accuracy at 71% on our eval set. We can do better.", 6),
    ("aster_ai", "admin", "Meera asked for a demo in 3 weeks. Let's make sure the hand-off flow is demo-ready.", 2),
]

TASK_COMMENTS = [
    ("Product detail page + video gallery", "pm", "Can we lazy-load the videos? Lighthouse score matters to Lumen.", 4),
    ("Product detail page + video gallery", "sarvadnya", "Yes, using IntersectionObserver with poster images. Will push today.", 3),
    ("Checkout flow optimisation", "pm", "This is overdue. Let's pull it into tomorrow's stand-up.", 1),
    ("Web application testing: patient portal", "manmohan", "IDOR confirmed on /api/records/{id}. Evidence saved in the shared vault.", 2),
    ("Executive summary & technical report", "pm", "Draft needed ASAP so the CISO has time to review.", 1),
    ("Embedding & retrieval evaluation", "prasanna", "Model B beats baseline by 9 points on recall@5. Running Model C next.", 2),
    ("Image CDN & performance budget", "sarvadnya", "Still waiting on CDN access from Lumen. Pinged Kavya twice.", 3),
]


def seed(reset=False):
    if reset and os.path.exists(config.DB_PATH):
        os.remove(config.DB_PATH)
    init_db()
    with get_db() as db:
        if db.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
            print("Database already seeded. Use --reset to rebuild.")
            return
        uid = {}
        for key, email, name, role, title, primary, resp, skills, color, pw in USERS:
            cur = db.execute(
                """INSERT INTO users (email,name,password_hash,role,title,primary_responsibility,responsibilities,skills,
                   phone,bio,avatar_color,joined_at,must_change_password,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)""",
                (email, name, hash_password(pw), role, title, primary, json.dumps(resp), json.dumps(skills),
                 "", f"{title} at OriginTheory.", color, dt(-200), ts(200), ts(200)))
            uid[key] = cur.lastrowid
        cid = []
        for name, company, contact, email, phone, status, notes in CLIENTS:
            cur = db.execute("INSERT INTO clients (name,company,contact_person,email,phone,notes,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
                             (name, company, contact, email, phone, notes, status, ts(120)))
            cid.append(cur.lastrowid)
        pid = {}
        for key, name, desc, ci, status, prio, s_off, d_off, budget, members in PROJECTS:
            cur = db.execute(
                """INSERT INTO projects (name,description,client_id,manager_id,status,priority,start_date,deadline,budget,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (name, desc, cid[ci] if ci is not None else None, uid["pm"], status, prio, dt(s_off), dt(d_off), budget,
                 ts(-s_off), ts(-s_off)))
            pid[key] = cur.lastrowid
            db.execute("INSERT INTO project_members VALUES (?,?,?)", (cur.lastrowid, uid["pm"], "Project Manager"))
            for m in members:
                role = {"sarvadnya": "Lead Developer", "manmohan": "Security Lead", "prasanna": "AI / Media Lead"}[m]
                db.execute("INSERT INTO project_members VALUES (?,?,?)", (cur.lastrowid, uid[m], role))
            db.execute("INSERT INTO activity_logs (actor_id,entity_type,entity_id,project_id,action,detail,created_at) VALUES (?,?,?,?,?,?,?)",
                       (uid["pm"], "project", cur.lastrowid, cur.lastrowid, "created_project", name, ts(-s_off)))
        tid, positions = {}, {}
        for pkey, title, who, status, prio, due_off, est, labels, created_ago, done_ago, desc, subs in TASKS:
            pos = positions.setdefault((pkey, status), 0)
            positions[(pkey, status)] += 1
            completed = ts(done_ago, 16) if status == "Done" else None
            cur = db.execute(
                """INSERT INTO tasks (project_id,title,description,assignee_id,reporter_id,status,priority,due_date,estimated_hours,
                   labels,position,created_at,updated_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (pid[pkey], title, desc, uid[who], uid["pm"], status, prio, dt(due_off), est, json.dumps(labels), pos,
                 ts(created_ago, 9), completed or ts(max(created_ago - 2, 0), 9), completed))
            tid[title] = cur.lastrowid
            for st, done in subs:
                db.execute("INSERT INTO subtasks (task_id,title,done) VALUES (?,?,?)", (cur.lastrowid, st, done))
            db.execute("INSERT INTO activity_logs (actor_id,entity_type,entity_id,project_id,action,detail,created_at) VALUES (?,?,?,?,?,?,?)",
                       (uid["pm"], "task", cur.lastrowid, pid[pkey], "created_task", title, ts(created_ago, 9)))
            db.execute("INSERT INTO activity_logs (actor_id,entity_type,entity_id,project_id,action,detail,created_at) VALUES (?,?,?,?,?,?,?)",
                       (uid["pm"], "task", cur.lastrowid, pid[pkey], "assigned", f"{title} → " + next(u[2] for u in USERS if u[0] == who), ts(created_ago, 9)))
            if completed:
                db.execute("INSERT INTO activity_logs (actor_id,entity_type,entity_id,project_id,action,detail,created_at) VALUES (?,?,?,?,?,?,?)",
                           (uid[who], "task", cur.lastrowid, pid[pkey], "status_changed", f"{title}: In Review → Done", completed))
            elif status in ("In Progress", "In Review", "Blocked"):
                db.execute("INSERT INTO activity_logs (actor_id,entity_type,entity_id,project_id,action,detail,created_at) VALUES (?,?,?,?,?,?,?)",
                           (uid[who], "task", cur.lastrowid, pid[pkey], "status_changed", f"{title}: To Do → {status}", ts(max(created_ago - 4, 0), 14)))
        for pkey, who, body, ago in PROJECT_COMMENTS:
            db.execute("INSERT INTO project_comments (project_id,author_id,body,created_at) VALUES (?,?,?,?)", (pid[pkey], uid[who], body, ts(ago, 15)))
            db.execute("INSERT INTO activity_logs (actor_id,entity_type,entity_id,project_id,action,detail,created_at) VALUES (?,?,?,?,?,?,?)",
                       (uid[who], "project", pid[pkey], pid[pkey], "posted_update", body[:80], ts(ago, 15)))
        for title, who, body, ago in TASK_COMMENTS:
            db.execute("INSERT INTO task_comments (task_id,author_id,body,created_at) VALUES (?,?,?,?)", (tid[title], uid[who], body, ts(ago, 12)))
    print(f"Seeded demo data into {config.DB_PATH}")
    print("  Admin : admin@origintheory.io  /", PW_ADMIN)
    print("  PM    : pm@origintheory.io     /", PW_USER)
    print("  Team  : sarvadnya@ | manmohan@ | prasanna@origintheory.io /", PW_USER)


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
