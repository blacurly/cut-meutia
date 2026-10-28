import Link from "next/link";

export default function AyomiLogo({ href = "/", label = "Ayomi — halaman awal" }) {
  return (
    <Link href={href} aria-label={label} className="inline-flex w-fit items-center gap-2.5 rounded-md text-current outline-offset-8 focus-visible:outline-2 focus-visible:outline-[#e9c46a]">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <path d="M33 7.8A17 17 0 1 0 35.8 33" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
        <circle cx="27.5" cy="16" r="5" fill="currentColor" />
        <path d="M19 30.5c0-5 3.5-8 8.5-8s8.5 3 8.5 8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <span className="text-[35px] leading-none font-bold tracking-[-1.8px]">ayomi<span className="text-[#e9c46a]">.</span></span>
    </Link>
  );
}
