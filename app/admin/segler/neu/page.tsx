import { SailorForm } from "@/components/sailor-form";
import { createSailor } from "@/lib/actions/sailors";
import Link from "next/link";

export default function NeuerSeglerPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/segler" className="hover:underline">Segler</Link>
        <span>›</span>
        <span>Neuer Segler</span>
      </div>
      <h1 className="text-xl font-semibold">Neuer Segler</h1>
      <SailorForm action={createSailor} />
    </div>
  );
}
