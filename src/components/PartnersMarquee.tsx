import type { ReactNode } from "react";
import jood from "@/assets/partner-jood.png.asset.json";
import ghaith from "@/assets/partner-ghaith.png.asset.json";
import ataa from "@/assets/partner-ataa.png.asset.json";
import type { CmsPartner } from "@/lib/cms";

const builtinLogos = [
  { name: "جمعية الجود للخدمات الإنسانية", src: jood.url },
  { name: "جمعية غيث للخدمات الإنسانية", src: ghaith.url },
  { name: "جمعية عطاء للخدمات الإنسانية", src: ataa.url },
];

type Item = { key: string; content: ReactNode };

type Props = {
  partners?: CmsPartner[];
  namesOnlyFallback?: string[];
};

export function PartnersMarquee({ partners, namesOnlyFallback }: Props) {
  const logoItems: Item[] = builtinLogos.map((p) => ({
    key: p.name,
    content: (
      <div className="group flex h-32 items-center justify-center rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg dark:border-white/10">
        <img
          src={p.src}
          alt={`شعار ${p.name}`}
          loading="lazy"
          className="max-h-[65px] w-auto max-w-full object-contain opacity-90 transition-all duration-300 group-hover:opacity-100 dark:[filter:brightness(0)_invert(1)]"
        />
      </div>
    ),
  }));

  const textItems: Item[] = [];

  if (partners && partners.length > 0) {
    for (const p of partners) {
      if (p.logo_url) {
        logoItems.push({
          key: p.id,
          content: (
            <div className="group flex h-32 items-center justify-center rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg dark:border-white/10">
              <img
                src={p.logo_url}
                alt={p.name}
                loading="lazy"
                className="max-h-[65px] w-auto max-w-full object-contain opacity-90 transition-all duration-300 group-hover:opacity-100 dark:[filter:brightness(0)_invert(1)]"
              />
            </div>
          ),
        });
      } else {
        textItems.push({
          key: p.id,
          content: (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-border bg-card px-6 text-center text-sm font-bold text-muted-foreground shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg dark:border-white/10">
              {p.name}
            </div>
          ),
        });
      }
    }
  } else if (namesOnlyFallback && namesOnlyFallback.length > 0) {
    for (const name of namesOnlyFallback) {
      textItems.push({
        key: name,
        content: (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-border bg-card px-6 text-center text-sm font-bold text-muted-foreground shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg dark:border-white/10">
            {name}
          </div>
        ),
      });
    }
  }

  const items: Item[] = [...logoItems, ...textItems];

  const duplicatedItems = [...items, ...items];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="marquee-container rounded-3xl" dir="ltr">
        <div className="marquee-track">
          {duplicatedItems.map((item, index) => (
            <div className="partner-card" key={`${item.key}-${index}`}>
              {item.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
