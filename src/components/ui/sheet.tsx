"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface SheetContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextType | null>(null);

export function Sheet({
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (onOpenChange) {
        onOpenChange(newOpen);
      }
      if (!isControlled) {
        setUncontrolledOpen(newOpen);
      }
    },
    [isControlled, onOpenChange]
  );

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetTrigger({
  asChild,
  children,
  onClick,
  ...props
}: {
  asChild?: boolean;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(SheetContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (onClick) onClick(e);
    if (ctx) ctx.setOpen(true);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        (children as any).props?.onClick?.(e);
        handleClick(e as any);
      },
    });
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

export function SheetClose({
  asChild,
  children,
  onClick,
  ...props
}: {
  asChild?: boolean;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(SheetContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (onClick) onClick(e);
    if (ctx) ctx.setOpen(false);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        (children as any).props?.onClick?.(e);
        handleClick(e as any);
      },
    });
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children || <X className="w-4 h-4" />}
    </button>
  );
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom" | "left" | "right";
}

export function SheetContent({
  className = "",
  children,
  side = "bottom",
  dir = "rtl",
  ...props
}: SheetContentProps) {
  const ctx = React.useContext(SheetContext);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (ctx?.open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [ctx?.open]);

  if (!mounted || !ctx?.open) return null;

  const sideClasses = {
    top: "inset-x-0 top-0 border-b border-border/50 max-h-[85vh] rounded-b-3xl",
    bottom: "inset-x-0 bottom-0 border-t border-border/50 max-h-[85vh] rounded-t-3xl",
    left: "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r border-border/50",
    right: "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l border-border/50",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
      onClick={() => ctx.setOpen(false)}
      dir={dir}
    >
      <div
        className={`fixed z-50 bg-card text-card-foreground p-6 shadow-2xl transition ease-in-out duration-300 animate-in ${sideClasses[side]} ${className}`}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        <div className="absolute top-4 left-4">
          <SheetClose className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-hidden" />
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function SheetHeader({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col space-y-1.5 text-right mb-4 ${className}`}
      {...props}
    />
  );
}

export function SheetTitle({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-base font-extrabold text-foreground ${className}`}
      {...props}
    />
  );
}

export function SheetDescription({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`text-xs text-muted-foreground font-medium ${className}`}
      {...props}
    />
  );
}
