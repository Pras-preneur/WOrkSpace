import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setAuthLostHandler, tokens } from "./api";
import { clearCache } from "./query";
import { User } from "./types";
import { LuCircleCheck, LuCircleAlert } from "react-icons/lu";

interface AuthCtx {
  user: User | null; ready: boolean; login: (e: string, p: string) => Promise<void>; logout: () => void;
  isAdmin: boolean; isStaff: boolean; reloadMe: () => Promise<void>;
}
const Auth = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Auth);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const logout = useCallback(() => { tokens.clear(); clearCache(); setUser(null); window.location.hash = "/login"; }, []);
  const reloadMe = useCallback(async () => { setUser(await api.get<User>("/auth/me")); }, []);

  useEffect(() => {
    setAuthLostHandler(() => { setUser(null); window.location.hash = "/login"; });
    if (!tokens.has()) { setReady(true); return; }
    reloadMe().catch(() => tokens.clear()).finally(() => setReady(true));
  }, [reloadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const d = await api.post("/auth/login", { email, password });
    tokens.set(d.access_token, d.refresh_token); clearCache(); setUser(d.user);
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    user, ready, login, logout, reloadMe,
    isAdmin: user?.role === "Admin", isStaff: user?.role === "Admin" || user?.role === "Project Manager",
  }), [user, ready, login, logout, reloadMe]);
  return <Auth.Provider value={value}>{children}</Auth.Provider>;
}

// ---- toasts ----
interface Toast { id: number; msg: string; kind: "success" | "error" }
const ToastCtx = createContext<(msg: string, kind?: "success" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === "success" ? <LuCircleCheck size={18} /> : <LuCircleAlert size={18} />}{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---- theme ----
export function useTheme() {
  const [theme, setTheme] = useState<string>(document.documentElement.dataset.theme || "light");
  const toggle = () => {
    const n = theme === "dark" ? "light" : "dark"; setTheme(n); document.documentElement.dataset.theme = n;
    try { localStorage.setItem("ot_theme", n); } catch {}
  };
  return { theme, toggle };
}
