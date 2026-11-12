import { LuFolderPlus, LuSquarePlus, LuArrowRightLeft, LuUserCheck, LuMessageSquare, LuPencil, LuUsers, LuBuilding2, LuUserX, LuMegaphone, LuTrash2, LuUserPlus } from "react-icons/lu";
import { Activity } from "../lib/types";
import { Avatar } from "./ui";
import { timeAgo } from "../lib/utils";
import { navigate } from "../lib/router";

const META: Record<string, { icon: any; tone: string; text: (d: string) => string }> = {
  created_project: { icon: LuFolderPlus, tone: "primary", text: (d) => `created project “${d}”` },
  created_task: { icon: LuSquarePlus, tone: "info", text: (d) => `created task “${d}”` },
  assigned: { icon: LuUserCheck, tone: "primary", text: (d) => { const [t, n] = d.split(" → "); return `assigned “${t}” to ${n}`; } },
  status_changed: { icon: LuArrowRightLeft, tone: "success", text: (d) => { const i = d.lastIndexOf(": "); const [a, b] = d.slice(i + 2).split(" → "); return `moved “${d.slice(0, i)}” from ${a} to ${b}`; } },
  updated_task: { icon: LuPencil, tone: "slate", text: (d) => `updated “${d}”` },
  commented: { icon: LuMessageSquare, tone: "slate", text: (d) => `commented on “${d}”` },
  posted_update: { icon: LuMegaphone, tone: "warning", text: (d) => `posted an update: “${d}”` },
  updated_project: { icon: LuPencil, tone: "slate", text: (d) => `updated project (${d})` },
  updated_team: { icon: LuUsers, tone: "slate", text: (d) => `updated the project team (${d})` },
  deleted_task: { icon: LuTrash2, tone: "danger", text: (d) => `deleted task “${d}”` },
  deleted_project: { icon: LuTrash2, tone: "danger", text: (d) => `deleted project “${d}”` },
  created_client: { icon: LuBuilding2, tone: "info", text: (d) => `added client ${d}` },
  updated_client: { icon: LuBuilding2, tone: "slate", text: (d) => `updated client ${d}` },
  archived_client: { icon: LuBuilding2, tone: "slate", text: () => `archived a client` },
  created_user: { icon: LuUserPlus, tone: "success", text: (d) => `added ${d} to the team` },
  updated_user: { icon: LuPencil, tone: "slate", text: (d) => `updated ${d}'s profile` },
  deactivated_user: { icon: LuUserX, tone: "danger", text: (d) => `deactivated ${d}` },
};

export function ActivityRow({ a, showProject = true }: { a: Activity; showProject?: boolean }) {
  const m = META[a.action] || { icon: LuPencil, tone: "slate", text: (d: string) => a.action.replace(/_/g, " ") + (d ? ` ${d}` : "") };
  const Icon = m.icon;
  return (
    <div className="tl-item">
      <span className={`tl-ico tone-${m.tone}`}><Icon size={15} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="small" style={{ lineHeight: 1.5 }}>
          <b>{a.actor_name || "System"}</b> <span className="text-2">{m.text(a.detail || "")}</span>
        </div>
        <div className="xs muted row gap-6">
          <span>{timeAgo(a.created_at)}</span>
          {showProject && a.project_name && <><span>·</span><a href={`#/projects/${a.project_id}`} style={{ color: "var(--primary-ink)", fontWeight: 600 }} onClick={(e) => { e.preventDefault(); navigate(`/projects/${a.project_id}`); }}>{a.project_name}</a></>}
        </div>
      </div>
    </div>
  );
}
export function ActivityFeed({ items, showProject = true }: { items: Activity[]; showProject?: boolean }) {
  return <div className="timeline">{items.map((a) => <ActivityRow key={a.id} a={a} showProject={showProject} />)}</div>;
}
