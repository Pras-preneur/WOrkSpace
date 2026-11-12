import { LuActivity } from "react-icons/lu";
import { api } from "../../lib/api";
import { useQuery } from "../../lib/query";
import { Empty, ErrorState, Skeleton } from "../../components/ui";
import { ActivityRow } from "../../components/ActivityFeed";
import { Activity as A } from "../../lib/types";
import { parseDate } from "../../lib/utils";

export default function Activity() {
  const { data, loading, error, refetch } = useQuery<A[]>("/activity?limit=120", () => api.get("/activity?limit=120"));
  const groups: Record<string, A[]> = {};
  (data ?? []).forEach((a) => {
    const d = parseDate(a.created_at)!; const today = new Date(); const yest = new Date(Date.now() - 864e5);
    const label = d.toDateString() === today.toDateString() ? "Today" : d.toDateString() === yest.toDateString() ? "Yesterday" : d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    (groups[label] ||= []).push(a);
  });
  return (
    <>
      <div className="page-head"><div><h2>Activity</h2><p>A running log of everything that happens in your workspace.</p></div></div>
      {loading && !data ? <Skeleton h={300} r={14} /> : error ? <ErrorState error={error} retry={refetch} /> : !data?.length ? <div className="card"><Empty icon={<LuActivity size={24} />} title="No activity yet" /></div> :
        <div className="col" style={{ gap: 18, maxWidth: 860 }}>{Object.entries(groups).map(([label, items]) => (
          <section key={label}><div className="small muted bold mb-12" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontSize: 11.5 }}>{label}</div>
            <div className="card card-pad timeline">{items.map((a) => <ActivityRow key={a.id} a={a} />)}</div></section>))}</div>}
    </>
  );
}
