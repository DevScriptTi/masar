"use client";

import React, { createContext, useContext, useState } from "react";

interface CollapsibleContextType {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const CollapsibleContext = createContext<CollapsibleContextType>({
  isOpen: false,
  setIsOpen: () => {},
});

export interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Collapsible({
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className = "",
  children,
  ...props
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const setIsOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof next === "function" ? next(isOpen) : next;
    if (!isControlled) {
      setUncontrolledOpen(nextVal);
    }
    onOpenChange?.(nextVal);
  };

  return (
    <CollapsibleContext.Provider value={{ isOpen, setIsOpen: (val: any) => setIsOpen(val) }}>
      <div
        data-state={isOpen ? "open" : "closed"}
        className={className}
        {...props}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

export interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function CollapsibleTrigger({
  className = "",
  children,
  onClick,
  ...props
}: CollapsibleTriggerProps) {
  const { isOpen, setIsOpen } = useContext(CollapsibleContext);

  return (
    <button
      type="button"
      data-state={isOpen ? "open" : "closed"}
      onClick={(e) => {
        setIsOpen((prev) => !prev);
        onClick?.(e);
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}

export interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {
  forceMount?: boolean;
}

export function CollapsibleContent({
  className = "",
  children,
  forceMount = false,
  ...props
}: CollapsibleContentProps) {
  const { isOpen } = useContext(CollapsibleContext);

  if (!isOpen && !forceMount) {
    return null;
  }

  return (
    <div
      data-state={isOpen ? "open" : "closed"}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
}
