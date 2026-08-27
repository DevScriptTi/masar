"use client";

import * as React from "react";
import { createPortal } from "react-dom";

interface DropdownMenuContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  coords: { top: number; left: number };
  setCoords: (coords: { top: number; left: number }) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextType | null>(null);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  return (
    <DropdownMenuContext.Provider
      value={{ open, setOpen, triggerRef, coords, setCoords }}
    >
      <div className="relative inline-block text-right">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
  asChild,
  children,
  ...props
}: {
  asChild?: boolean;
  children: React.ReactElement<any>;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) return children;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (ctx.triggerRef.current) {
      const rect = ctx.triggerRef.current.getBoundingClientRect();
      ctx.setCoords({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
      });
    }
    ctx.setOpen(!ctx.open);
  };

  return React.cloneElement(children, {
    ref: ctx.triggerRef,
    onClick: handleClick,
    ...props,
  });
}

export function DropdownMenuPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}

export function DropdownMenuContent({
  align = "end",
  className = "",
  children,
}: {
  align?: "start" | "end" | "center";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(DropdownMenuContext);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!ctx?.open) return;

    const handleOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        ctx.triggerRef.current &&
        !ctx.triggerRef.current.contains(e.target as Node)
      ) {
        ctx.setOpen(false);
      }
    };

    const handleScroll = () => {
      if (ctx.triggerRef.current) {
        const rect = ctx.triggerRef.current.getBoundingClientRect();
        ctx.setCoords({
          top: rect.bottom + window.scrollY + 6,
          left: rect.left + window.scrollX,
        });
      }
    };

    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [ctx]);

  if (!ctx?.open) return null;

  const style: React.CSSProperties = {
    position: "absolute",
    top: `${ctx.coords.top}px`,
    left: `${ctx.coords.left}px`,
  };

  return (
    <div
      ref={contentRef}
      style={style}
      dir="rtl"
      className={`bg-surface border border-outline/20 rounded-2xl shadow-2xl py-1.5 min-w-[12rem] text-xs font-semibold z-[9999] animate-fadeIn ${className}`}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  onClick,
  className = "",
  children,
}: {
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(DropdownMenuContext);

  return (
    <button
      type="button"
      onClick={() => {
        ctx?.setOpen(false);
        onClick?.();
      }}
      className={`w-full text-right px-4 py-2.5 flex items-center gap-2.5 text-on-surface hover:bg-surface-variant/60 transition-colors cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}
