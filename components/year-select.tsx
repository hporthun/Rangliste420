"use client";

import { useRouter } from "next/navigation";

type Props = {
  years: number[];
  selected: string; // year as string or "all"
  basePath: string; // e.g. "/admin/regatten"
};

export function YearSelect({ years, selected, basePath }: Props) {
  const router = useRouter();

  function handleChange(value: string) {
    // Persist across navigations
    document.cookie = `admin-year=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    const params = new URLSearchParams(window.location.search);
    params.set("year", value);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <select
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {years.map((y) => (
        <option key={y} value={String(y)}>
          {y}
        </option>
      ))}
      <option value="all">Alle Jahre</option>
    </select>
  );
}
