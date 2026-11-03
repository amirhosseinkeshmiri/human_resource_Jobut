"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { searchIranCities } from "@/lib/iran-cities";

interface IranCityComboboxProps {
  id?: string;
  name?: string;
  defaultValue?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export function IranCityCombobox({
  id,
  name = "location",
  defaultValue = "",
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: IranCityComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? `iran-city-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(defaultValue);
  const [selectedCity, setSelectedCity] = useState(defaultValue);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => searchIranCities(query), [query]);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  function choose(city: string, code: string) {
    setQuery(city);
    setSelectedCity(city);
    setSelectedCode(code);
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function clear() {
    setQuery("");
    setSelectedCity("");
    setSelectedCode(null);
    setOpen(true);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  return <div ref={wrapperRef} className="relative min-w-0">
    <input type="hidden" name={name} value={selectedCity} />
    <div className="relative">
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        role="combobox"
        autoComplete="off"
        value={query}
        placeholder="جست‌وجوی نام شهر یا استان"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && results[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        className="min-h-11 w-full rounded-md border bg-surface px-3 py-2 pe-20 text-start text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/20"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedCity("");
          setSelectedCode(null);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.min(index + 1, results.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && open && results[activeIndex]) {
            event.preventDefault();
            choose(results[activeIndex].city, results[activeIndex].code);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {query ? <button type="button" onClick={clear} className="absolute end-2 top-1/2 min-h-9 -translate-y-1/2 rounded-md px-2 text-xs font-semibold text-text-muted outline-none hover:bg-surface-elevated hover:text-text-primary focus-visible:ring-2 focus-visible:ring-focus" aria-label="پاک کردن شهر">پاک کردن</button> : null}
    </div>
    {open ? <div id={listboxId} role="listbox" aria-label="شهرهای ایران" className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-30 max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-ui-border bg-surface p-1.5 shadow-[0_14px_36px_rgb(20_33_145/0.16)]">
      {results.length ? results.map((item, index) => <button
        id={`${listboxId}-${index}`}
        key={item.code}
        type="button"
        role="option"
        aria-selected={selectedCode === item.code}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-start text-sm outline-none ${activeIndex === index ? "bg-surface-elevated text-action" : "hover:bg-surface-elevated"}`}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(item.city, item.code)}
      ><span className="font-semibold">{item.city}</span><span className="text-xs text-text-muted">{item.province}</span></button>) : <p className="px-3 py-5 text-center text-sm text-text-muted">شهری با این عبارت پیدا نشد.</p>}
    </div> : null}
    {query && !selectedCity ? <p className="text-helper mt-1.5" role="status">برای اعمال فیلتر، یک شهر را از فهرست انتخاب کنید.</p> : null}
  </div>;
}
