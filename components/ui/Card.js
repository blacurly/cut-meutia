import { cn } from "./utils";

const colors = {
  white: "bg-white",
  yellow: "bg-[#fff8e8]",
  green: "bg-[#edf8f4]",
  blue: "bg-[#eef6f8]",
};

export default function Card({ color = "white", children, className }) {
  return (
    <section className={cn("rounded-2xl p-5 shadow-sm ring-1 ring-black/5", colors[color] || colors.white, className)}>
      {children}
    </section>
  );
}
