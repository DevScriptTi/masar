"use client";

import React, { useState, useEffect, useRef, FormEvent } from "react";
import {
  Calendar,
  GraduationCap,
  School,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Check,
} from "lucide-react";
import { RegisterFormData } from "@/src/app/register/page";

interface OptionItem {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  id: string;
  label?: string;
  value: string;
  options: OptionItem[];
  placeholder: string;
  icon?: React.ElementType;
  onChange: (val: string) => void;
  required?: boolean;
}

function CustomDropdown({
  label,
  value,
  options,
  placeholder,
  icon: Icon,
  onChange,
  required,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="space-y-1.5 relative" ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-semibold text-on-surface-variant">
          {label} {required && <span className="text-error">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full h-12 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-sm font-medium flex items-center justify-between focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all duration-200 shadow-sm ${
            Icon ? "pr-11 pl-10" : "px-3"
          }`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span
            className={
              selectedOption
                ? "text-on-surface font-semibold truncate"
                : "text-on-surface-variant/50 font-normal truncate"
            }
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-on-surface-variant/70 shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-primary" : ""
            }`}
          />
        </button>

        {/* Right Icon if provided */}
        {Icon && (
          <Icon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/70 pointer-events-none" />
        )}

        {/* Custom Dropdown List Container */}
        {isOpen && (
          <ul
            className="absolute right-0 left-0 top-full mt-1.5 bg-surface border border-outline/20 rounded-xl shadow-xl z-30 py-1.5 max-h-56 overflow-y-auto animate-fadeIn text-right"
            dir="rtl"
            role="listbox"
          >
            {options.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer text-right flex items-center justify-between ${
                    isSelected
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-on-surface hover:bg-surface-variant/60"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0 mr-1" />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

interface RegisterStep2Props {
  formData: RegisterFormData;
  updateFormData: (fields: Partial<RegisterFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function RegisterStep2({
  formData,
  updateFormData,
  onNext,
  onBack,
}: RegisterStep2Props) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parse existing DOB if available
  const dobParts = formData.dob ? formData.dob.split("-") : ["", "", ""];
  const selectedYear = dobParts[0] || "";
  const selectedMonth = dobParts[1] || "";
  const selectedDay = dobParts[2] || "";

  // Dynamic Date Options
  // Days: 1 to 31
  const dayOptions: OptionItem[] = Array.from({ length: 31 }, (_, i) => {
    const val = String(i + 1).padStart(2, "0");
    return { value: val, label: String(i + 1) };
  });

  // Months: 1 to 12 with Arabic Month Names
  const arabicMonthNames = [
    "يناير",
    "فبراير",
    "مارس",
    "أفريل",
    "ماي",
    "جوان",
    "جويلية",
    "أوت",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  const monthOptions: OptionItem[] = Array.from({ length: 12 }, (_, i) => {
    const val = String(i + 1).padStart(2, "0");
    return { value: val, label: `${i + 1} (${arabicMonthNames[i]})` };
  });

  // Years: 2000 to 2015 dynamically generated
  const yearOptionsDate: OptionItem[] = Array.from({ length: 16 }, (_, i) => {
    const yr = String(2000 + i);
    return { value: yr, label: yr };
  });

  const handleDatePartChange = (part: "day" | "month" | "year", val: string) => {
    const curDay = part === "day" ? val : selectedDay;
    const curMonth = part === "month" ? val : selectedMonth;
    const curYear = part === "year" ? val : selectedYear;

    if (curDay && curMonth && curYear) {
      updateFormData({ dob: `${curYear}-${curMonth}-${curDay}` });
    } else {
      updateFormData({ dob: `${curYear || ""}-${curMonth || ""}-${curDay || ""}` });
    }
  };

  // Level Options
  const levelOptions: OptionItem[] = [
    { value: "الثانوي", label: "التعليم الثانوي (High School)" },
    { value: "الجامعي", label: "التعليم الجامعي (University)" },
  ];

  // Year Options
  const yearOptions: OptionItem[] = [
    { value: "الأولى", label: "السنة الأولى ثانوي" },
    { value: "الثانية", label: "السنة الثانية ثانوي" },
    { value: "الثالثة", label: "السنة الثالثة ثانوي (بكالوريا)" },
  ];

  // Stream Options
  const streamOptions: OptionItem[] = [
    { value: "علوم تجريبية", label: "علوم تجريبية" },
    { value: "رياضيات", label: "رياضيات" },
    { value: "هندسة", label: "تقني رياضي / هندسة" },
    { value: "آداب وفلسفة", label: "آداب وفلسفة" },
    { value: "لغات", label: "لغات أجنبية" },
    { value: "تسيير واقتصاد", label: "تسيير واقتصاد" },
  ];

  const handleLevelChange = (newLevel: string) => {
    if (newLevel !== "الثانوي") {
      updateFormData({ level: newLevel, year: "", stream: "" });
    } else {
      updateFormData({ level: newLevel });
    }
  };

  const handleYearChange = (newYear: string) => {
    if (newYear !== "الثانية" && newYear !== "الثالثة") {
      updateFormData({ year: newYear, stream: "" });
    } else {
      updateFormData({ year: newYear });
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedDay || !selectedMonth || !selectedYear) {
      setErrorMessage("يرجى تحديد اليوم، الشهر، والسنة لتاريخ الميلاد.");
      return;
    }

    if (!formData.level) {
      setErrorMessage("يرجى اختيار الطور الدراسي.");
      return;
    }

    if (formData.level === "الثانوي") {
      if (!formData.year) {
        setErrorMessage("يرجى اختيار السنة الدراسية.");
        return;
      }

      if (
        (formData.year === "الثانية" || formData.year === "الثالثة") &&
        !formData.stream
      ) {
        setErrorMessage("يرجى اختيار الشعبة الدراسية.");
        return;
      }
    }

    onNext();
  };

  const showYear = formData.level === "الثانوي";
  const showStream =
    showYear && (formData.year === "الثانية" || formData.year === "الثالثة");

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fadeIn" noValidate dir="rtl">
      {/* Step Title */}
      <div className="text-right mb-4">
        <h2 className="text-xl font-bold text-on-surface">البيانات الشخصية والدراسية</h2>
        <p className="text-xs text-on-surface-variant mt-1">
          حدد طورك الدراسي وشعبتك لتأطير المحتوى المناسب لك
        </p>
      </div>

      {/* Error Alert Box */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-error-container/70 border border-error/30 text-on-error-container text-xs flex items-center gap-2.5 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-error shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Task A: 3 Custom Dropdowns for Date of Birth (No Native Input) */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-on-surface-variant flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-primary" />
          <span>تاريخ الميلاد</span> <span className="text-error">*</span>
        </label>

        <div className="grid grid-cols-3 gap-2">
          {/* Day Dropdown */}
          <CustomDropdown
            id="dobDay"
            value={selectedDay}
            options={dayOptions}
            placeholder="اليوم"
            onChange={(val) => handleDatePartChange("day", val)}
            required
          />

          {/* Month Dropdown */}
          <CustomDropdown
            id="dobMonth"
            value={selectedMonth}
            options={monthOptions}
            placeholder="الشهر"
            onChange={(val) => handleDatePartChange("month", val)}
            required
          />

          {/* Year Dropdown (2000-2015) */}
          <CustomDropdown
            id="dobYear"
            value={selectedYear}
            options={yearOptionsDate}
            placeholder="السنة"
            onChange={(val) => handleDatePartChange("year", val)}
            required
          />
        </div>
      </div>

      {/* Custom Dropdown 1: Level (الطور) */}
      <CustomDropdown
        id="level"
        label="الطور الدراسي"
        value={formData.level}
        options={levelOptions}
        placeholder="-- اختر الطور الدراسي --"
        icon={GraduationCap}
        onChange={handleLevelChange}
        required
      />

      {/* Custom Dropdown 2: Year (السنة - If Level === 'الثانوي') */}
      {showYear && (
        <div className="animate-fadeIn">
          <CustomDropdown
            id="year"
            label="السنة الدراسية"
            value={formData.year}
            options={yearOptions}
            placeholder="-- اختر السنة الدراسية --"
            icon={School}
            onChange={handleYearChange}
            required
          />
        </div>
      )}

      {/* Custom Dropdown 3: Stream (الشعبة - If Year === 'الثانية' or 'الثالثة') */}
      {showStream && (
        <div className="animate-fadeIn">
          <CustomDropdown
            id="stream"
            label="الشعبة والتخصص"
            value={formData.stream}
            options={streamOptions}
            placeholder="-- اختر الشعبة --"
            icon={BookOpen}
            onChange={(val) => updateFormData({ stream: val })}
            required
          />
        </div>
      )}

      {/* Navigation Action Buttons */}
      <div className="pt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 h-12 rounded-xl bg-surface-variant/60 text-on-surface-variant font-bold text-sm hover:bg-surface-variant focus:outline-none transition-colors flex items-center justify-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          <span>السابق</span>
        </button>

        <button
          type="submit"
          className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 transform active:scale-[0.99]"
        >
          <span>التالي: الصورة الرمزية</span>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}

export default RegisterStep2;
