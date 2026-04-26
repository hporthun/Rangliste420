import Link from "next/link";
import { RegattaForm } from "@/components/regatta-form";
import { createRegatta } from "@/lib/actions/regattas";

export default function NeueRegattaPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/regatten" className="hover:underline">Regatten</Link>
        <span>›</span>
        <span>Neue Regatta</span>
      </div>
      <h1 className="text-xl font-semibold">Neue Regatta</h1>
      <RegattaForm action={createRegatta} />
    </div>
  );
}
