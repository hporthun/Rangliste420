import Link from "next/link";
import { RegattaListImport } from "./regatta-list-import";

export default function RegattenImportPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/regatten" className="text-sm text-blue-600 hover:underline">
          ← Zurück zur Regattenliste
        </Link>
        <h1 className="text-xl font-semibold mt-2">Regatten importieren</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Regatten direkt aus Manage2Sail laden oder manuell per Text einfügen.
        </p>
      </div>

      <RegattaListImport />
    </div>
  );
}
