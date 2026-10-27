import { Check } from "lucide-react";
import { PackageRequestDialog } from "@/components/PackageRequestDialog";
import type { Pkg } from "@/data/site";


export function SectionHeading({
  title,
  description,
  align = "center",
  light = false,
}: {
  title: string;
  description?: string;
  align?: "center" | "start";
  light?: boolean;
}) {
  return (
    <div className={`${align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}`}>
      <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h2>
      {description && (
        <p className={`mt-4 text-base leading-relaxed ${light ? "opacity-80" : "text-muted-foreground"}`}>
          {description}
        </p>
      )}
    </div>
  );
}

export function PackageCard({ pkg }: { pkg: Pkg }) {
  return (
    <article className="card-elevated flex h-full flex-col p-7">
      {pkg.featured && (
        <span className="mb-3 inline-flex w-fit rounded-full bg-gold px-3 py-1 text-[11px] font-extrabold text-gold-foreground">
          الأكثر طلباً
        </span>
      )}
      <h3 className="text-lg font-extrabold leading-snug">{pkg.title}</h3>
      <p className="mt-1 text-sm font-semibold text-primary dark:text-gold">{pkg.subtitle}</p>

      <ul className="mt-5 flex-1 space-y-3">
        {pkg.features.map((f) => (
          <li key={f} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-gold" aria-hidden />
            <span className="min-w-0">{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <PackageRequestDialog packageName={`${pkg.title} — ${pkg.subtitle}`} />
      </div>

    </article>
  );
}
