import { cn } from "@/utils/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300",
        variant === "primary"
          ? "bg-indigo-500 text-white hover:bg-indigo-400"
          : "glass text-white hover:opacity-80",
        className
      )}
      {...props}
    />
  );
}
