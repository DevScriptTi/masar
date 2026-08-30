"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

interface AccordionContextType {
  type: "single" | "multiple";
  collapsible?: boolean;
  value: string | string[];
  setValue: (value: string | string[]) => void;
}

const AccordionContext = React.createContext<AccordionContextType | null>(null);

interface AccordionItemContextType {
  value: string;
  isOpen: boolean;
}

const AccordionItemContext = React.createContext<AccordionItemContextType | null>(null);

export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple";
  collapsible?: boolean;
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: any) => void;
  children: React.ReactNode;
}

export function Accordion({
  type = "single",
  collapsible = true,
  defaultValue,
  value: controlledValue,
  onValueChange,
  className = "",
  children,
  ...props
}: AccordionProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | string[]>(
    defaultValue || (type === "single" ? "" : [])
  );

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const setValue = React.useCallback(
    (newValue: string | string[]) => {
      if (onValueChange) {
        onValueChange(newValue);
      }
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
    },
    [isControlled, onValueChange]
  );

  return (
    <AccordionContext.Provider value={{ type, collapsible, value, setValue }}>
      <div className={className} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function AccordionItem({
  value,
  className = "",
  children,
  ...props
}: AccordionItemProps) {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) {
    throw new Error("AccordionItem must be used within Accordion");
  }

  const isOpen =
    ctx.type === "single"
      ? ctx.value === value
      : Array.isArray(ctx.value) && ctx.value.includes(value);

  return (
    <AccordionItemContext.Provider value={{ value, isOpen }}>
      <div
        data-state={isOpen ? "open" : "closed"}
        className={className}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function AccordionTrigger({
  className = "",
  children,
  onClick,
  ...props
}: AccordionTriggerProps) {
  const accordionCtx = React.useContext(AccordionContext);
  const itemCtx = React.useContext(AccordionItemContext);

  if (!accordionCtx || !itemCtx) {
    throw new Error("AccordionTrigger must be used within AccordionItem");
  }

  const { isOpen, value: itemValue } = itemCtx;
  const { type, collapsible, value, setValue } = accordionCtx;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);

    if (type === "single") {
      if (isOpen) {
        if (collapsible) {
          setValue("");
        }
      } else {
        setValue(itemValue);
      }
    } else {
      const currentList = Array.isArray(value) ? value : [];
      if (isOpen) {
        setValue(currentList.filter((v) => v !== itemValue));
      } else {
        setValue([...currentList, itemValue]);
      }
    }
  };

  return (
    <button
      type="button"
      data-state={isOpen ? "open" : "closed"}
      onClick={handleClick}
      className={`flex flex-1 items-center justify-between font-medium transition-all ${className}`}
      {...props}
    >
      {children}
      <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
    </button>
  );
}

export interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  forceMount?: boolean;
}

export function AccordionContent({
  className = "",
  children,
  forceMount = false,
  ...props
}: AccordionContentProps) {
  const itemCtx = React.useContext(AccordionItemContext);

  if (!itemCtx) {
    throw new Error("AccordionContent must be used within AccordionItem");
  }

  const { isOpen } = itemCtx;

  if (!isOpen && !forceMount) {
    return null;
  }

  return (
    <div
      data-state={isOpen ? "open" : "closed"}
      className={`overflow-hidden transition-all animate-in fade-in-0 duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
