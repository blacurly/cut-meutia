import { cn } from "./utils";

const styles = {
  green: "bg-[#d9f2e8] text-[#17634d]",
  white: "bg-white text-[#264653] ring-1 ring-inset ring-[#d8e3e0]",
  yellow: "bg-[#fff0bd] text-[#806000]",
  grey: "bg-[#edf1f0] text-[#60706d]",
};

export default function Badge({ variant = "grey", children }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", styles[variant] || styles.grey)}>
      {children}
    </span>
  );
}
