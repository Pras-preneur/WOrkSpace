import { ReactNode, useEffect, useRef, useState } from "react";
import { LuX, LuInbox, LuCheck } from "react-icons/lu";
import { cx, initials, STATUS_TONE, PRIORITY_TONE } from "../lib/utils";

export function Avatar({ name, color, size = 32, title }: { name?: string | null; color?: string | null; size?: number; title?: string }) {
  return (
    <span className="avatar" title={title ?? name ?? ""} style={{ ["--s" as any]: size + "px", background: color || "#94a3b8" }}>
      {name ? initials(name) : "?"}
    </span>
  );
}
export function AvatarStack({ people, max = 4, size = 28 }: { people: { name: string; avatar_color: string }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max), extra = people.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map((p, i) => <Avatar key={i} name={p.name} color={p.avatar_color} size={size} />)}
      {extra > 0 && <span className="avatar" style={{ ["--s" as any]: size + "px", background: "var(--slate)" }}>+{extra}</span>}
    </span>
  );
}

export const StatusBadge = ({ status }: { status: string }) => (
  <span className={cx("badge", STATUS_TONE[status])}><span className="dot" />{status}</span>
);
export const PriorityBadge = ({ priority }: { priority: string }) => (
  <span className={cx("badge", PRIORITY_TONE[priority])}><span className={`pri ${priority}`} style={{ boxShadow: "none" }} />{priority}</span>
);

export function Button({ variant, size, icon, className, children, ...rest }: any) {
  return <button className={cx("btn", variant, size, icon && "icon", className)} {...rest}>{children}</button>;
}

export function Field({ label, error, children, className }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return <div className={cx("field", className)}><label>{label}</label>{children}{error && <span className="err">{error}</span>}</div>;
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx("modal", wide && "wide")} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><Button variant="ghost" size="sm" icon onClick={onClose} aria-label="Close"><LuX /></Button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ onClose, header, children }: { onClose: () => void; header: ReactNode; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="drawer-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">{header}<Button variant="ghost" size="sm" icon onClick={onClose} aria-label="Close panel"><LuX /></Button></div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ico">{icon ?? <LuInbox size={24} />}</div>
      <h4>{title}</h4>{text && <div>{text}</div>}{action && <div className="mt-16">{action}</div>}
    </div>
  );
}

export const Skeleton = ({ h = 16, w = "100%", r }: { h?: number; w?: string | number; r?: number }) => (
  <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />
);
export function PageSkeleton() {
  return (
    <div className="col gap-20">
      <div className="grid g-kpi">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={118} r={14} />)}</div>
      <div className="grid g-21"><Skeleton h={300} r={14} /><Skeleton h={300} r={14} /></div>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return <Empty title="Something went wrong" text={error.message} action={retry && <Button onClick={retry}>Try again</Button>} />;
}

export function Progress({ value, tone }: { value: number; tone?: "success" | "danger" }) {
  return <div className={cx("progress", tone)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${value}%` }} /></div>;
}
export function Ring({ value, size = 56, stroke = 6, color = "var(--primary)" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: "stroke-dashoffset .6s" }} />
      </svg>
      <b>{value}%</b>
    </span>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; icon?: ReactNode; count?: number }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={cx("tab", value === t.id && "active")} onClick={() => onChange(t.id)}>
          {t.icon}{t.label}{t.count !== undefined && <span className="n">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Segmented<T extends string | number>({ options, value, onChange }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return <div className="seg">{options.map((o) => <button key={String(o.id)} className={cx(value === o.id && "on")} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>;
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" className={cx("cbx", checked && "on")} role="checkbox" aria-checked={checked} aria-label={label} onClick={(e) => { e.stopPropagation(); onChange(!checked); }}>
      {checked && <LuCheck />}
    </button>
  );
}

/** Dismiss-on-outside-click wrapper for menus/popovers. */
export function useOutside<T extends HTMLElement>(onOut: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [onOut]);
  return ref;
}
export function Dropdown({ trigger, children, align }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(() => setOpen(false));
  return <div ref={ref} style={{ position: "relative" }}>{trigger(open, () => setOpen((o) => !o))}{open && children(() => setOpen(false))}</div>;
}

export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState("");
  const add = () => { const t = text.trim(); if (t && !value.includes(t)) onChange([...value, t]); setText(""); };
  return (
    <div>
      <input className="input" value={text} placeholder={placeholder || "Type and press Enter"} onChange={(e) => setText(e.target.value)}
             onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} onBlur={add} />
      {value.length > 0 && (
        <div className="row wrap gap-6 mt-8">
          {value.map((t) => <span key={t} className="chip">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}
            style={{ border: 0, background: "none", padding: 0, color: "inherit", display: "grid" }}><LuX size={13} /></button></span>)}
        </div>
      )}
    </div>
  );
}
