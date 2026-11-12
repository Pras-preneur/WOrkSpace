export const initials = (name = "") => name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const parseDate = (s?: string | null) => (s ? new Date(s.length <= 10 ? s + "T00:00:00" : s + "Z") : null);
export function fmtDate(s?: string | null, withYear = false) {
  const d = parseDate(s); if (!d) return "—";
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return withYear || d.getFullYear() !== new Date().getFullYear() ? `${base} ${d.getFullYear()}` : base;
}
export function timeAgo(s?: string | null) {
  const d = parseDate(s); if (!d) return "";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  return fmtDate(s);
}
export function dueLabel(daysLeft: number | null | undefined) {
  if (daysLeft === null || daysLeft === undefined) return "No date";
  if (daysLeft < 0) return `${-daysLeft}d overdue`;
  if (daysLeft === 0) return "Today";
  if (daysLeft === 1) return "Tomorrow";
  return `In ${daysLeft}d`;
}
export const money = (n?: number | null) => (n == null ? "—" : "₹" + new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n));
export const todayISO = () => new Date().toISOString().slice(0, 10);

export const TASK_STATUSES = ["To Do", "In Progress", "In Review", "Done", "Blocked"] as const;
export const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export const PROJECT_STATUSES = ["Planning", "Active", "On Hold", "Completed", "Cancelled"] as const;
export const STATUS_COLOR: Record<string, string> = {
  "To Do": "#8b93ad", "In Progress": "#2f7cf6", "In Review": "#9b5de5", Done: "#12a06a", Blocked: "#e5484d",
  Planning: "#8b93ad", Active: "#2f7cf6", "On Hold": "#d98a06", Completed: "#12a06a", Cancelled: "#e5484d",
};
export const STATUS_TONE: Record<string, string> = {
  "To Do": "", "In Progress": "info", "In Review": "review", Done: "success", Blocked: "danger",
  Planning: "", Active: "info", "On Hold": "warning", Completed: "success", Cancelled: "danger",
  Lead: "warning", Inactive: "",
};
export const PRIORITY_TONE: Record<string, string> = { Low: "", Medium: "info", High: "warning", Urgent: "danger" };
export const AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#ef4444", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#7c3aed"];
export const download = (name: string, text: string, type = "text/csv") => {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
