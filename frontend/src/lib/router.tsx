import { createContext, useContext, useEffect, useState, ReactNode } from "react";

const get = () => (window.location.hash.replace(/^#/, "") || "/").split("?")[0];
const getQuery = () => new URLSearchParams((window.location.hash.split("?")[1]) || "");

export function navigate(path: string, opts?: { replace?: boolean }) {
  if (opts?.replace) window.history.replaceState(null, "", "#" + path); else window.location.hash = path;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

const Ctx = createContext<string>("/");
export function Router({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(get());
  useEffect(() => {
    const on = () => { setPath(get()); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on);
  }, []);
  return <Ctx.Provider value={path}>{children}</Ctx.Provider>;
}
export const usePath = () => useContext(Ctx);
export const useQueryParams = () => { usePath(); return getQuery(); };

/** match("/projects/:id", "/projects/4") => { id: "4" } | null */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/").filter(Boolean), b = path.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function Link({ to, children, className, onClick, ...rest }: any) {
  const path = usePath();
  const active = to === "/" ? path === "/" : path === to || path.startsWith(to + "/");
  return (
    <a href={"#" + to} className={`${className || ""}${rest.nav && active ? " active" : ""}`}
       onClick={(e) => { onClick?.(e); e.stopPropagation(); }} {...(({ nav, ...r }) => r)(rest)}>{children}</a>
  );
}
