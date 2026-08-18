"use client";

import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";

export interface MathInputEngineRef {
  insert: (latex: string) => void;
  executeCommand: (command: any) => void;
  setValue: (latex: string) => void;
  getValue: () => string;
  focus: () => void;
  clear: () => void;
}

export interface MathInputEngineProps {
  value?: string;
  onChange?: (value: string) => void;
  onEnter?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const MathInputEngine = forwardRef<
  MathInputEngineRef,
  MathInputEngineProps
>(function MathInputEngine(
  {
    value = "",
    onChange,
    onEnter,
    placeholder = "ابتكر أو اصنع المعادلة الرياضية التفاعلية هنا...",
    disabled = false,
  },
  ref
) {
  const mathFieldRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load MathLive dynamically on client side to prevent Next.js SSR hydration errors
  useEffect(() => {
    import("mathlive")
      .then(() => {
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load MathLive:", err);
      });
  }, []);

  // Configure mathfield attributes after load
  useEffect(() => {
    const mfe = mathFieldRef.current;
    if (mfe) {
      // Task A: Strictly disable default full-screen black virtual keyboard
      mfe.setAttribute("math-virtual-keyboard-policy", "none");
    }
  }, [isLoaded]);

  // Sync internal mathfield value when parent clears or updates value
  useEffect(() => {
    const mfe = mathFieldRef.current;
    if (mfe && typeof mfe.setValue === "function") {
      if (value === "") {
        mfe.value = "";
      } else if (mfe.value !== value) {
        mfe.setValue(value);
      }
    }
  }, [value]);

  // Expose imperative handle to parent for toolbar snippet insertion & commands
  useImperativeHandle(
    ref,
    () => ({
      insert: (latex: string) => {
        const mfe = mathFieldRef.current;
        if (mfe) {
          if (typeof mfe.executeCommand === "function") {
            mfe.executeCommand(["insert", latex]);
          } else if (typeof mfe.insert === "function") {
            mfe.insert(latex, { focus: true });
          }
          if (typeof mfe.focus === "function") mfe.focus();
          if (onChange) onChange(mfe.value || "");
        }
      },
      executeCommand: (command: any) => {
        const mfe = mathFieldRef.current;
        if (mfe) {
          if (typeof mfe.executeCommand === "function") {
            mfe.executeCommand(command);
          } else if (typeof mfe.insert === "function") {
            const snippet = Array.isArray(command) ? command[1] || "" : command;
            mfe.insert(snippet, { focus: true });
          }
          if (typeof mfe.focus === "function") mfe.focus();
          if (onChange) onChange(mfe.value || "");
        }
      },
      setValue: (latex: string) => {
        const mfe = mathFieldRef.current;
        if (mfe) {
          mfe.value = latex;
          if (onChange) onChange(mfe.value || "");
        }
      },
      getValue: () => {
        return mathFieldRef.current?.value || "";
      },
      focus: () => {
        mathFieldRef.current?.focus();
      },
      clear: () => {
        if (mathFieldRef.current) {
          mathFieldRef.current.value = "";
          if (onChange) onChange("");
        }
      },
    }),
    [onChange]
  );

  // Attach event listeners for input change & Enter key submission
  useEffect(() => {
    const mfe = mathFieldRef.current;
    if (!mfe) return;

    const handleInput = () => {
      if (onChange) {
        onChange(mfe.value || "");
      }
    };

    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        if (onEnter) {
          onEnter(mfe.value || "");
        }
      }
    };

    mfe.addEventListener("input", handleInput);
    mfe.addEventListener("keydown", handleKeyDown);

    return () => {
      mfe.removeEventListener("input", handleInput);
      mfe.removeEventListener("keydown", handleKeyDown);
    };
  }, [onChange, onEnter, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="w-full h-11 px-4 rounded-2xl bg-surface-variant/30 border border-outline/10 flex items-center justify-between text-xs text-on-surface-variant animate-pulse">
        <span>جاري تحميل مسودة الرياضيات التفاعلية...</span>
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-2xl bg-surface border border-primary/30 px-3 py-2 text-on-surface focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary transition-all shadow-sm ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
      dir="ltr"
    >
      {React.createElement(
        "math-field",
        {
          ref: mathFieldRef,
          "math-virtual-keyboard-policy": "none",
          placeholder: placeholder,
          style: {
            width: "100%",
            fontSize: "1.1rem",
            background: "transparent",
            outline: "none",
            border: "none",
            color: "currentColor",
          },
        },
        value
      )}
    </div>
  );
});
