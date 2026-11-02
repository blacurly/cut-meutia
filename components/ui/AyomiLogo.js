import Image from "next/image";
import Link from "next/link";
import logo from "@/public/images/ayomi-logo.png";

export default function AyomiLogo({ href = "/", label = "Ayomi" }) {
  return (
    <Link href={href} aria-label={label} className="inline-flex w-fit items-center gap-2.5 rounded-md text-current outline-offset-8 focus-visible:outline-2 focus-visible:outline-[#e9c46a]">
      <Image src={logo} alt="" width={44} height={44} unoptimized className="shrink-0" />
      <span className="text-[35px] leading-none font-bold tracking-[-1.8px]">ayomi<span className="text-[#e9c46a]">.</span></span>
    </Link>
  );
}
