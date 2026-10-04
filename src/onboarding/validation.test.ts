import assert from "node:assert/strict";
import test from "node:test";
import { ImageValidationError, validateCompanyImageFile } from "./image-storage";
import {
  isCompanyOnboardingComplete,
  validateCompanyOnboardingForm,
} from "./validation";

const industryId = "11111111-1111-4111-8111-111111111111";
const benefitId = "22222222-2222-4222-8222-222222222222";

function validFormData() {
  const data = new FormData();
  data.set("name", " شرکت نمونه ");
  data.set("industryId", industryId);
  data.set("address", "تهران، خیابان نمونه");
  data.set("foundingYear", "۱۴۰۰");
  data.append("benefitIds", benefitId);
  return data;
}

test("normalizes and accepts valid Persian onboarding input", () => {
  const result = validateCompanyOnboardingForm(validFormData(), new Date("2026-10-04"));
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.name, "شرکت نمونه");
    assert.equal(result.data.foundingYear, 1400);
    assert.deepEqual(result.data.benefitIds, [benefitId]);
  }
});

test("rejects an invalid selected benefit ID", () => {
  const data = validFormData();
  data.set("benefitIds", "not-a-uuid");
  assert.equal(validateCompanyOnboardingForm(data).success, false);
});

test("accepts onboarding with zero selected benefits", () => {
  const data = validFormData();
  data.delete("benefitIds");
  const result = validateCompanyOnboardingForm(data, new Date("2026-10-04"));
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data.benefitIds, []);
});

test("considers required company fields complete without benefits or gallery", () => {
  assert.equal(
    isCompanyOnboardingComplete({
      name: "شرکت نمونه",
      address: "تهران، خیابان نمونه",
      foundingYear: 1400,
      logoUrl: "/company/logo.png",
    }),
    true,
  );
});

test("still validates an optional gallery file when supplied", async () => {
  const invalidGallery = new File(["not-an-image"], "gallery.gif", { type: "image/gif" });
  await assert.rejects(
    validateCompanyImageFile(invalidGallery, "gallery"),
    ImageValidationError,
  );
});

test("rejects a future founding year", () => {
  const data = validFormData();
  data.set("foundingYear", "1500");
  assert.equal(validateCompanyOnboardingForm(data, new Date("2026-10-04")).success, false);
});
