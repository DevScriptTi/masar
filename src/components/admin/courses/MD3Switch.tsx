"use client";

import React from "react";

interface MD3SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

export function MD3Switch({
  checked,
  onChange,
  disabled = false,
  label,
  id,
}: MD3SwitchProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <label
      htmlFor={id}
      onClick={handleClick}
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {label && (
        <span className="text-xs font-semibold text-on-surface-variant">
          {label}
        </span>
      )}
      <div
        className={`relative w-12 h-7 rounded-full transition-colors duration-200 ease-in-out border ${
          checked
            ? "bg-primary border-primary"
            : "bg-surface-variant/60 border-outline/30"
        }`}
      >
        <div
          className={`absolute top-[3px] right-[3px] w-5 h-5 rounded-full shadow-md transition-transform duration-200 ease-in-out ${
            checked
              ? "-translate-x-5 bg-on-primary scale-105"
              : "translate-x-0 bg-outline/70"
          }`}
        />
      </div>
    </label>
  );
}

export default MD3Switch;
