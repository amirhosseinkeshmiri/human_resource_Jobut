"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  changeIranProvince,
  hydrateIranLocationSelection,
  iranProvinces,
  searchIranCitiesInProvince,
} from "@/lib/iran-cities";
import { getCityComboboxKeyAction } from "./province-city-field-policy";

interface IranProvinceCityFieldsProps {
  defaultProvince?: string;
  defaultCity?: string;
  className?: string;
}

export function IranProvinceCityFields({
  defaultProvince = "",
  defaultCity = "",
  className,
}: IranProvinceCityFieldsProps) {
  const initial = useMemo(
    () => hydrateIranLocationSelection(defaultProvince, defaultCity),
    [defaultProvince, defaultCity],
  );
  const generatedId = useId();
  const cityInputId = `iran-city-${generatedId}`;
  const listboxId = `${cityInputId}-listbox`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [province, setProvince] = useState(initial.province);
  const [query, setQuery] = useState(initial.city);
  const [selectedCity, setSelectedCity] = useState(initial.city);
  const [selectedCode, setSelectedCode] = useState<string | null>(initial.cityCode);
  const [legacyStatus, setLegacyStatus] = useState(initial.status === "ambiguous" || initial.status === "unknown" ? initial.status : null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(
    () => searchIranCitiesInProvince(province, query),
    [province, query],
  );

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  function resetCity() {
    setQuery("");
    setSelectedCity("");
    setSelectedCode(null);
    setLegacyStatus(null);
    setActiveIndex(0);
    setOpen(false);
  }

  function choose(city: string, code: string) {
    setQuery(city);
    setSelectedCity(city);
    setSelectedCode(code);
    setLegacyStatus(null);
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  const cityDisabled = !province;
  return <div className={`grid min-w-0 gap-4 sm:grid-cols-2 ${className ?? ""}`} ref={wrapperRef}>
    <div className="grid min-w-0 gap-[var(--field-spacing)]">
      <label htmlFor={`iran-province-${generatedId}`} className="text-label">استان</label>
      <select
        id={`iran-province-${generatedId}`}
        name="province"
        value={province}
        className="min-h-11 w-full rounded-md border bg-surface px-3 py-2 text-start text-sm text-text-primary outline-none transition-colors focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/20"
        onChange={(event) => {
          const next = changeIranProvince(event.target.value);
          setProvince(next.province);
          resetCity();
        }}
      >
        <option value="">همه استان‌ها</option>
        {iranProvinces.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <p className="text-helper">برای انتخاب شهر، ابتدا استان را مشخص کنید.</p>
    </div>

    <div className="grid min-w-0 gap-[var(--field-spacing)]">
      <label htmlFor={cityInputId} className="text-label">شهر</label>
      <input type="hidden" name="location" value={selectedCity} />
      <div className="relative min-w-0">
        <input
          ref={inputRef}
          id={cityInputId}
          type="search"
          role="combobox"
          autoComplete="off"
          disabled={cityDisabled}
          value={query}
          placeholder={cityDisabled ? "ابتدا استان را انتخاب کنید" : "جست‌وجوی شهر"}
          aria-autocomplete="list"
          aria-expanded={!cityDisabled && open}
          aria-controls={listboxId}
          aria-activedescendant={open && results[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
          aria-describedby={`${cityInputId}-hint`}
          className="min-h-11 w-full rounded-md border bg-surface px-3 py-2 pe-20 text-start text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/20 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-text-muted"
          onFocus={() => { if (!cityDisabled) setOpen(true); }}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedCity("");
            setSelectedCode(null);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            const action = getCityComboboxKeyAction(event.key, activeIndex, results.length, open);
            if (action?.type === "navigate") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex(action.activeIndex);
            } else if (action?.type === "select" && results[action.activeIndex]) {
              event.preventDefault();
              choose(results[action.activeIndex].city, results[action.activeIndex].code);
            } else if (action?.type === "close") {
              setOpen(false);
            }
          }}
        />
        {query && !cityDisabled ? <button type="button" onClick={() => { resetCity(); setOpen(true); inputRef.current?.focus(); }} className="absolute end-2 top-1/2 min-h-9 -translate-y-1/2 rounded-md px-2 text-xs font-semibold text-text-muted outline-none hover:bg-surface-elevated hover:text-text-primary focus-visible:ring-2 focus-visible:ring-focus" aria-label="پاک کردن شهر">پاک کردن</button> : null}
        {!cityDisabled && open ? <div id={listboxId} role="listbox" aria-label={`شهرهای استان ${province}`} className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-30 max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-ui-border bg-surface p-1.5 shadow-[0_14px_36px_rgb(20_33_145/0.16)]">
          {results.length ? results.map((item, index) => <button id={`${listboxId}-${index}`} key={item.code} type="button" role="option" aria-selected={selectedCode === item.code} className={`flex min-h-11 w-full items-center rounded-md px-3 py-2 text-start text-sm outline-none ${activeIndex === index ? "bg-surface-elevated text-action" : "hover:bg-surface-elevated"}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(item.city, item.code)}>{item.city}</button>) : <p className="px-3 py-5 text-center text-sm text-text-muted">شهری با این عبارت در استان انتخاب‌شده پیدا نشد.</p>}
        </div> : null}
      </div>
      <p id={`${cityInputId}-hint`} className="text-helper">{legacyStatus === "ambiguous" ? `نام «${selectedCity}» در چند استان وجود دارد؛ برای تعیین استان، یک استان انتخاب کنید.` : legacyStatus === "unknown" ? `شهر «${selectedCity}» از URL قدیمی حفظ شده است؛ برای تغییر آن، استان را انتخاب کنید.` : query && !selectedCity ? "برای اعمال فیلتر، شهر را از فهرست انتخاب کنید." : province ? `فقط شهرهای استان ${province} نمایش داده می‌شوند.` : "انتخاب شهر اختیاری است."}</p>
    </div>
  </div>;
}
