import { api } from "./api";
import { useQuery } from "./query";
import { Client, Project, User } from "./types";

export const useUsers = () => useQuery<User[]>("/users", () => api.get("/users"));
export const useProjectsList = () => useQuery<Project[]>("/projects", () => api.get("/projects"));
export const useClientsList = (enabled = true) => useQuery<Client[]>(enabled ? "/clients" : null, () => api.get("/clients"));

/** Turn an ApiError into { field: message } for form display. */
export function fieldErrors(e: any): Record<string, string> {
  const out: Record<string, string> = {};
  (e?.details || []).forEach((d: any) => { out[d.field.replace(/^body\./, "")] = d.message; });
  if (!Object.keys(out).length) out._ = e?.message || "Something went wrong";
  return out;
}
