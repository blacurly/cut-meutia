"use client";

import { cn } from "./utils";

const variants = {
  accent: "bg-[#2a9d8f] text-white hover:brightness-105 focus-visible:ring-[#2a9d8f]",
  primary: "bg-[#264653] text-white shadow-sm hover:bg-[#1f3944] focus-visible:ring-[#264653]",
  secondary: "border border-[#264653] bg-white text-[#264653] hover:bg-[#eef6f4] focus-visible:ring-[#264653]",
  ghost: "text-[#264653] hover:bg-[#eef6f4] focus-visible:ring-[#264653]",
};

const sizes = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-13 px-6 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  disabled = false,
  fullWidth = false,
  onClick,
  children,
  type = "button",
  className,
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        fullWidth && "w-full",
        className,
      )}
    >
      {icon && iconPosition === "left" ? icon : null}
      {children}
      {icon && iconPosition === "right" ? icon : null}
    </button>
  );
}
