export default function AdminLoading() {
  return (
    <div className="space-y-4 animate-pulse p-6">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="h-4 w-full rounded bg-muted" />
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-4 w-5/6 rounded bg-muted" />
      <div className="space-y-2 mt-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 w-full rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
