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
