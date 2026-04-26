export default function PublicLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4 animate-pulse">
      <div className="h-8 w-64 rounded bg-muted" />
      <div className="h-4 w-full rounded bg-muted" />
      <div className="space-y-2 mt-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 w-full rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
