/* eslint-disable @next/next/no-img-element */
import { cn } from "./utils";

const sizes = { sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-lg" };
const colors = ["bg-[#d9f2e8] text-[#17634d]", "bg-[#fff0bd] text-[#806000]", "bg-[#dceef2] text-[#285d6b]"];

export default function ProfilePicture({ src, name, size = "md", colorRandom = false }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const color = colorRandom ? colors[name.length % colors.length] : colors[0];
  return src ? <img src={src} alt={name} className={cn("rounded-full object-cover", sizes[size] || sizes.md)} /> : <span aria-label={name} className={cn("inline-flex items-center justify-center rounded-full font-bold", sizes[size] || sizes.md, color)}>{initials}</span>;
}
