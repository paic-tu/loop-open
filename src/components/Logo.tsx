import { Link } from "@tanstack/react-router";

export function Logo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={`flex shrink-0 items-center ${className}`} aria-label="أوبن لوب | Open Loop">
      <img
        src="/favicon.png"
        alt="شعار أوبن لوب Open Loop"
        width={64}
        height={64}
        className={`h-10 w-auto sm:h-12 ${light ? "brightness-0 invert" : ""}`}
      />
    </Link>
  );
}
