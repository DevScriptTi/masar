"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2 } from "lucide-react";

interface AlertDialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextType | null>(null);

export function AlertDialog({
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
    <AlertDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

export function AlertDialogTrigger({
  asChild,
  children,
  onClick,
  ...props
}: {
  asChild?: boolean;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(AlertDialogContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (onClick) onClick(e);
    ctx?.setOpen(true);
  };

  if (asChild && React.isValidElement(children)) {
    const existingOnClick = (children.props as any)?.onClick;
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        if (existingOnClick) existingOnClick(e);
        handleClick(e as any);
      },
      ...props,
    });
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

export function AlertDialogContent({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(AlertDialogContext);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!ctx?.open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      dir="rtl"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`bg-surface border border-outline/20 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 relative animate-scaleUp text-right ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function AlertDialogHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`space-y-2 text-right ${className}`}>{children}</div>;
}

export function AlertDialogTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-error/10 text-error flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h3 className={`text-base font-extrabold text-on-surface ${className}`}>
        {children}
      </h3>
    </div>
  );
}

export function AlertDialogDescription({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-xs font-semibold text-on-surface-variant/80 leading-relaxed pr-11 ${className}`}>
      {children}
    </p>
  );
}

export function AlertDialogFooter({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`pt-3 border-t border-outline/10 flex items-center justify-end gap-2.5 ${className}`}>
      {children}
    </div>
  );
}

export function AlertDialogCancel({
  children = "إلغاء",
  onClick,
  className = "",
}: {
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  const ctx = React.useContext(AlertDialogContext);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) onClick(e);
    ctx?.setOpen(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`h-10 px-4 rounded-xl bg-surface-variant/40 hover:bg-surface-variant text-on-surface font-extrabold text-xs transition-colors cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

export function AlertDialogAction({
  children = "حذف",
  onClick,
  disabled = false,
  className = "",
}: {
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  className?: string;
}) {
  const ctx = React.useContext(AlertDialogContext);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (onClick) onClick(e);
    ctx?.setOpen(false);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={`h-10 px-5 rounded-xl bg-error text-on-error hover:bg-error/90 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-error font-extrabold text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${className}`}
    >
      <Trash2 className="w-3.5 h-3.5" />
      <span>{children}</span>
    </button>
  );
}
