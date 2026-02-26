import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 active:bg-emerald-700",
        destructive: "bg-red-600 text-white shadow-sm hover:bg-red-500 active:bg-red-700",
        outline: "border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100",
        secondary: "bg-zinc-800 text-zinc-100 shadow-sm hover:bg-zinc-700",
        ghost: "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
        link: "text-emerald-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
