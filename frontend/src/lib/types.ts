export type Role = "Admin" | "Project Manager" | "Team Member" | "Client";
export interface User {
  id: number; email: string; name: string; role: Role; title: string; primary_responsibility: string;
  responsibilities: string[]; skills: string[]; phone: string; bio: string; avatar_color: string; joined_at: string;
  active: boolean; must_change_password?: boolean; stats?: { assigned: number; open: number; done: number; overdue: number };
  projects?: { id: number; name: string; status: string }[]; open_tasks?: Task[];
}
export interface Subtask { id: number; task_id: number; title: string; done: boolean }
export interface Comment { id: number; body: string; created_at: string; author_name: string; author_color: string; author_role?: string }
export interface Task {
  id: number; project_id: number; project_name: string; title: string; description: string; status: string; priority: string;
  assignee_id: number | null; assignee_name: string | null; assignee_color: string | null; reporter_name: string | null;
  due_date: string | null; estimated_hours: number | null; labels: string[]; position: number; completed_at: string | null;
  created_at: string; overdue: boolean; due_soon: boolean; days_left: number | null;
  subtask_total: number; subtask_done: number; comment_count: number; subtasks?: Subtask[]; comments?: Comment[];
}
export interface Member { id: number; name: string; avatar_color: string; title: string; project_role: string }
export interface Project {
  id: number; name: string; description: string; client_id: number | null; client_name: string | null; manager_id: number;
  manager_name: string; manager_color: string; status: string; priority: string; start_date: string | null; deadline: string | null;
  budget: number | null; progress: number; task_total: number; task_done: number; task_overdue: number; overdue: boolean;
  due_soon: boolean; days_left: number | null; members: Member[]; can_manage?: boolean;
}
export interface Client {
  id: number; name: string; company: string; contact_person: string; email: string; phone: string; notes: string; status: string;
  project_count: number; active_projects: number; projects?: any[];
}
export interface Activity { id: number; actor_name: string | null; actor_color: string | null; action: string; detail: string; project_id: number | null; project_name: string | null; entity_type: string; entity_id: number; created_at: string }
