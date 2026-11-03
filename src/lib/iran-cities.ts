import cityData from "./iran-cities-data.json";

export interface IranCity {
  /** Unique national city/urban-area code from the source dataset. */
  code: string;
  city: string;
  province: string;
}

export const IRAN_CITIES_SOURCE = {
  title: "تقسیمات کشوری ایران ۱۴۰۴",
  sourceOrganization: "مرکز آمار ایران",
  sourceYear: 1404,
  upstreamRepository: "https://github.com/Hameds/IranCountryDivisions",
  upstreamLicense: "MIT",
  upstreamSourceSha256: "d493adef35d7b7187ce3c14b69794f0f6c66b4a9c9cdbfe9834cdb00e026e9e0",
  cityCount: 1481,
  provinceCount: 31,
} as const;

export const iranCities: readonly IranCity[] = cityData;
export const iranProvinces = [...new Set(iranCities.map((item) => item.province))]
  .sort((left, right) => left.localeCompare(right, "fa-IR"));
export type IranProvince = (typeof iranProvinces)[number];

export function normalizeIranCitySearch(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u0640\u064b-\u065f\u0670]/g, "")
    .replace(/[\u200c\u200d]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fa-IR");
}

export function searchIranCities(query: string, limit = 80) {
  const normalized = normalizeIranCitySearch(query);
  const compact = normalized.replace(/\s/g, "");
  const matches = normalized
    ? iranCities.filter(({ city, province }) => {
      const searchable = normalizeIranCitySearch(`${city} ${province}`);
      return searchable.includes(normalized) || searchable.replace(/\s/g, "").includes(compact);
    })
    : iranCities;
  return matches.slice(0, Math.max(0, limit));
}

export function isIranProvince(value: string): value is IranProvince {
  return iranProvinces.includes(value);
}

export function getIranCitiesForProvince(province: string) {
  return isIranProvince(province)
    ? iranCities.filter((item) => item.province === province)
    : [];
}

function normalizedCityKey(value: string) {
  return normalizeIranCitySearch(value).replace(/\s/g, "");
}

export function searchIranCitiesInProvince(province: string, query: string, limit = 80) {
  const normalized = normalizeIranCitySearch(query);
  const compact = normalizedCityKey(query);
  const matches = getIranCitiesForProvince(province).filter(({ city }) => {
    if (!normalized) return true;
    const searchable = normalizeIranCitySearch(city);
    return searchable.includes(normalized) || normalizedCityKey(city).includes(compact);
  });
  return matches.slice(0, Math.max(0, limit));
}

export type IranLocationHydration =
  | { status: "empty"; province: ""; city: ""; cityCode: null }
  | { status: "province-only"; province: IranProvince; city: ""; cityCode: null }
  | { status: "resolved"; province: IranProvince; city: string; cityCode: string }
  | { status: "ambiguous" | "unknown"; province: ""; city: string; cityCode: null };

export function hydrateIranLocationSelection(provinceValue: string, cityValue: string): IranLocationHydration {
  const province = isIranProvince(provinceValue) ? provinceValue : "";
  const city = cityValue.trim();
  if (province) {
    if (!city) return { status: "province-only", province, city: "", cityCode: null };
    const match = getIranCitiesForProvince(province).find((item) => normalizedCityKey(item.city) === normalizedCityKey(city));
    return match
      ? { status: "resolved", province, city, cityCode: match.code }
      : { status: "province-only", province, city: "", cityCode: null };
  }
  if (!city) return { status: "empty", province: "", city: "", cityCode: null };
  const matches = iranCities.filter((item) => normalizedCityKey(item.city) === normalizedCityKey(city));
  const provinces = new Set(matches.map((item) => item.province));
  if (provinces.size === 1) {
    const [match] = matches;
    return { status: "resolved", province: match.province, city, cityCode: match.code };
  }
  return { status: matches.length ? "ambiguous" : "unknown", province: "", city, cityCode: null };
}

export function sanitizeIranProvinceCity(provinceValue: string, cityValue: string) {
  const province = isIranProvince(provinceValue) ? provinceValue : "";
  if (!province) return { province: "", city: cityValue };
  const validCity = getIranCitiesForProvince(province)
    .some((item) => normalizedCityKey(item.city) === normalizedCityKey(cityValue));
  return { province, city: validCity ? cityValue : "" };
}

export function changeIranProvince(provinceValue: string) {
  return {
    province: isIranProvince(provinceValue) ? provinceValue : "",
    city: "",
  };
}
