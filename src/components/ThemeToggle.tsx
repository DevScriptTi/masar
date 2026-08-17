"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-full bg-surface-variant/30 animate-pulse" />
    );
  }

  const isDark = resolvedTheme === "dark" || theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex items-center justify-center w-10 h-10 rounded-full bg-surface-variant/60 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300 transform active:scale-95 shadow-sm"
      aria-label="تبديل المظهر (مظلم / مضيء)"
      title={isDark ? "الانتقال إلى الوضع المضيء" : "الانتقال إلى الوضع المظلم"}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-5 h-5 text-indigo-600 transition-transform duration-300 -rotate-12 hover:rotate-0" />
      )}
    </button>
  );
}

export default ThemeToggle;
