import assert from "node:assert/strict";
import test from "node:test";
import { iranCities, IRAN_CITIES_SOURCE, normalizeIranCitySearch, searchIranCities } from "./iran-cities";

test("verified 1404 dataset contains all 1481 city records across 31 provinces", () => {
  assert.equal(new Set(iranCities.map((item) => item.province)).size, 31);
  assert.equal(iranCities.length, 1481);
  assert.equal(IRAN_CITIES_SOURCE.cityCount, iranCities.length);
  assert.equal(IRAN_CITIES_SOURCE.sourceYear, 1404);
  assert.equal(new Set(iranCities.map((item) => item.code)).size, iranCities.length);
  assert.ok(iranCities.some((item) => item.city === "تهران" && item.province === "تهران"));
  assert.ok(iranCities.some((item) => item.city === "مشهد" && item.province === "خراسان رضوی"));
});

test("same-name cities remain distinct records with province context and unique codes", () => {
  const sardasht = iranCities.filter((item) => item.city === "سردشت");
  assert.ok(sardasht.length > 1);
  assert.equal(new Set(sardasht.map((item) => item.code)).size, sardasht.length);
  assert.ok(sardasht.some((item) => item.province === "آذربایجان غربی"));
  assert.ok(sardasht.some((item) => item.province === "خوزستان"));
  assert.deepEqual(searchIranCities("سردشت خوزستان").map((item) => item.province), ["خوزستان"]);
});

test("city search handles Persian Arabic variants, half-spaces and province context", () => {
  assert.equal(normalizeIranCitySearch(" كيش "), "کیش");
  assert.equal(normalizeIranCitySearch("بندر عباس"), "بندر عباس");
  assert.ok(searchIranCities("آذربایجان شرقی").some((item) => item.city === "تبریز"));
  assert.ok(searchIranCities("بندر‌عباس").some((item) => normalizeIranCitySearch(item.city).replace(/\s/g, "") === "بندرعباس"));
});

test("city search remains bounded", () => {
  assert.equal(searchIranCities("", 12).length, 12);
});
