import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { ids, tokens } from "./fixtures";

const employerCookie = "jobut_employer_session";
const candidateCookie = "jobut_candidate_session";

async function authenticate(context: BrowserContext, kind: "employer" | "candidate", token: string) {
  await context.addCookies([{
    name: kind === "employer" ? employerCookie : candidateCookie,
    value: token,
    url: "http://127.0.0.1:3100",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

async function storageValue(page: Page, storage: "local" | "session", key: string) {
  return page.evaluate(({ storage, key }) => {
    const target = storage === "session" ? window.sessionStorage : window.localStorage;
    return target.getItem(key);
  }, { storage, key });
}

async function completeJobForm(page: Page, title: string) {
  await page.locator('input[name="title"]').fill(title);
  await page.locator('select[name="workplaceType"]').selectOption("remote");
  await page.locator('select[name="employmentType"]').selectOption("full_time");
  await page.locator('input[name="location"]').fill("تهران");
  await page.locator('select[name="seniorityLevel"]').selectOption("mid_level");
  await page.getByText("حقوق توافقی", { exact: true }).click();
  await page.locator("#skill-input").fill("TypeScript");
  await page.locator("#skill-input").press("Enter");
  await page.locator('[contenteditable="true"]').fill("شرح کامل موقعیت شغلی برای آزمون مرورگر");
}

test.describe("Phase 4 browser draft persistence", () => {
  test("Job drafts survive refresh/navigation, separate new and existing IDs, fail safely, discard, and clear only on success", async ({ context, page }) => {
    await authenticate(context, "employer", tokens.employerA);
    const newKey = `jobut:form-draft:${ids.employerA}:job-post:new`;
    const companyKey = `jobut:form-draft:${ids.employerA}:company-profile:${ids.companyA}`;

    await page.goto("/employer/jobs/new");
    await page.locator('input[name="title"]').fill("پیش‌نویس بازیابی‌شونده");
    await page.waitForTimeout(450);
    await page.reload();
    await expect(page.locator('input[name="title"]')).toHaveValue("پیش‌نویس بازیابی‌شونده");
    await page.goto("/employer/jobs");
    await page.goto("/employer/jobs/new");
    await expect(page.locator('input[name="title"]')).toHaveValue("پیش‌نویس بازیابی‌شونده");

    await page.goto(`/employer/jobs/${ids.jobA}`);
    await expect(page.locator('input[name="title"]')).toHaveValue("آگهی موجود آزمون");
    await page.goto("/employer/jobs/new");
    await page.locator('input[name="title"]').fill("");
    await page.getByRole("button", { name: "ذخیره پیش‌نویس" }).click();
    await expect(page.getByText("عنوان شغلی را وارد کنید.")).toBeVisible();

    await context.setOffline(true);
    await completeJobForm(page, "خطای شبکه قابل بازیابی");
    await page.getByRole("button", { name: "ذخیره پیش‌نویس" }).click();
    await page.waitForTimeout(500);
    await context.setOffline(false);
    await page.reload();
    await expect(page.locator('input[name="title"]')).toHaveValue("خطای شبکه قابل بازیابی");

    await page.getByRole("button", { name: "حذف پیش‌نویس محلی" }).click();
    expect(await storageValue(page, "local", newKey)).toBeNull();
    await completeJobForm(page, "آگهی موفق E2E");
    await page.evaluate(({ key }) => localStorage.setItem(key, "unrelated"), { key: companyKey });
    await page.getByRole("button", { name: "ذخیره پیش‌نویس" }).click();
    await expect(page).toHaveURL(/\/employer\/jobs\/[0-9a-f-]+\?created=1/);
    await page.waitForTimeout(100);
    expect(await storageValue(page, "local", newKey)).toBeNull();
    expect(await storageValue(page, "local", companyKey)).toBe("unrelated");
  });

  test("Company profile restores safe fields, excludes files/contact data, handles stale drafts, manual discard, and success cleanup", async ({ context, page }) => {
    await authenticate(context, "employer", tokens.employerA);
    const key = `jobut:form-draft:${ids.employerA}:company-profile:${ids.companyA}`;
    await page.goto("/employer/onboarding");
    await page.locator('input[name="name"]').fill("شرکت بازیابی‌شده");
    await page.locator('textarea[name="address"]').fill("تهران، نشانی ویرایش‌نشده آزمون");
    await page.waitForTimeout(450);
    await page.reload();
    await expect(page.locator('input[name="name"]')).toHaveValue("شرکت بازیابی‌شده");
    const stored = JSON.parse((await storageValue(page, "local", key))!);
    expect(Object.keys(stored.values).sort()).toEqual(["address", "benefitIds", "foundingYear", "industryId", "name"]);
    expect(JSON.stringify(stored)).not.toContain("email");
    expect(JSON.stringify(stored)).not.toContain("logo");
    expect(JSON.stringify(stored)).not.toContain("gallery");

    await context.clearCookies();
    await authenticate(context, "employer", tokens.employerB);
    await page.goto("/employer/onboarding");
    await expect(page.locator('input[name="name"]')).toHaveValue("شرکت آزمون ب");
    await context.clearCookies();
    await authenticate(context, "employer", tokens.employerA);
    await page.goto("/employer/onboarding");
    await expect(page.locator('input[name="name"]')).toHaveValue("شرکت بازیابی‌شده");

    await page.evaluate(({ key, accountId, companyId }) => localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1,
      scope: { accountId, formId: "company-profile", entityId: companyId },
      updatedAt: 1,
      values: { name: "داده قدیمی" },
    })), { key, accountId: ids.employerA, companyId: ids.companyA });
    await page.reload();
    await expect(page.locator('input[name="name"]')).toHaveValue("شرکت آزمون الف");
    await page.locator('input[name="name"]').fill("حذف دستی");
    await page.waitForTimeout(450);
    await page.getByRole("button", { name: "حذف پیش‌نویس محلی" }).click();
    expect(await storageValue(page, "local", key)).toBeNull();

    await page.locator('input[name="name"]').fill("شرکت ذخیره‌شده E2E");
    await page.getByRole("button", { name: "ثبت و ادامه" }).click();
    await expect(page).toHaveURL(/\/employer\?companySaved=1/);
    await page.waitForTimeout(100);
    expect(await storageValue(page, "local", key)).toBeNull();
  });

  test("Candidate preferences restore only approved groups, isolate accounts, reject stale state, discard, and clear on save", async ({ context, page }) => {
    await authenticate(context, "candidate", tokens.candidateA);
    const keyA = `jobut:form-draft:${ids.candidateA}:candidate-job-preferences:self`;
    await page.goto("/candidate/preferences");
    await page.locator('input[name="preferredLocations"]').first().fill("کرج");
    await page.locator('input[name="preferredWorkplaceTypes"][value="hybrid"]').check();
    await page.waitForTimeout(450);
    await page.reload();
    await expect(page.locator('input[name="preferredLocations"]').first()).toHaveValue("کرج");
    const stored = JSON.parse((await storageValue(page, "local", keyA))!);
    expect(Object.keys(stored.values).sort()).toEqual(["preferredEmploymentTypes", "preferredLocations", "preferredSeniorityLevels", "preferredWorkplaceTypes"]);

    await context.clearCookies();
    await authenticate(context, "candidate", tokens.candidateB);
    await page.goto("/candidate/preferences");
    await expect(page.locator('input[name="preferredLocations"]').first()).toHaveValue("شیراز");
    await context.clearCookies();
    await authenticate(context, "candidate", tokens.candidateA);
    await page.goto("/candidate/preferences");
    await page.getByRole("button", { name: "حذف پیش‌نویس محلی" }).click();
    expect(await storageValue(page, "local", keyA)).toBeNull();
    await page.locator('input[name="preferredLocations"]').first().fill("اصفهان");
    await page.getByRole("button", { name: "ذخیره ترجیحات" }).click();
    await expect(page).toHaveURL(/saved=1/);
    await page.waitForTimeout(100);
    expect(await storageValue(page, "local", keyA)).toBeNull();
  });

  test("Resume uses tab-scoped sessionStorage, restores nested sections, discards, clears on success, and does not survive a new tab session", async ({ context, page }) => {
    await authenticate(context, "candidate", tokens.candidateA);
    const key = `jobut:form-draft:${ids.candidateA}:candidate-resume:${ids.resumeA}`;
    await page.goto("/candidate/resume?mode=edit");
    await page.locator('input[name="professionalTitle"]').fill("عنوان موقت رزومه");
    await page.getByRole("button", { name: "افزودن سابقه" }).click();
    await page.locator('input[name="experiences.0.jobTitle"]').fill("توسعه‌دهنده");
    await page.locator('input[name="experiences.0.companyName"]').fill("شرکت سابق");
    await page.locator('input[name="experiences.0.startDate"]').fill("2024-01-01");
    await page.locator('input[name="experiences.0.isCurrent"]').check();
    await page.getByRole("button", { name: "افزودن تحصیلات" }).click();
    await page.locator('input[name="educations.0.fieldOfStudy"]').fill("مهندسی نرم‌افزار");
    await page.locator('input[name="educations.0.institutionName"]').fill("دانشگاه آزمون");
    await page.locator('input[name="educations.0.degree"]').fill("کارشناسی");
    await page.locator('input[name="educations.0.startDate"]').fill("2018-01-01");
    await page.locator('input[name="educations.0.endDate"]').fill("2022-01-01");
    await page.getByRole("button", { name: "افزودن زبان" }).click();
    await page.locator('input[name="languages.0.name"]').fill("انگلیسی");
    await page.waitForTimeout(450);
    expect(await storageValue(page, "local", key)).toBeNull();
    expect(await storageValue(page, "session", key)).not.toBeNull();
    await page.reload();
    await expect(page.locator('input[name="professionalTitle"]')).toHaveValue("عنوان موقت رزومه");
    await expect(page.locator('input[name="experiences.0.companyName"]')).toHaveValue("شرکت سابق");
    await expect(page.locator('input[name="educations.0.institutionName"]')).toHaveValue("دانشگاه آزمون");
    await expect(page.locator('input[name="languages.0.name"]')).toHaveValue("انگلیسی");

    const freshTab = await context.newPage();
    await freshTab.goto("/candidate/resume?mode=edit");
    await expect(freshTab.locator('input[name="professionalTitle"]')).toHaveValue("عنوان ذخیره‌شده");
    await freshTab.close();

    await page.getByRole("button", { name: "حذف پیش‌نویس موقت" }).click();
    expect(await storageValue(page, "session", key)).toBeNull();
    await page.locator('input[name="professionalTitle"]').fill("عنوان نهایی E2E");
    await page.getByRole("button", { name: "ذخیره رزومه" }).click();
    await expect(page).toHaveURL(/saved=1/);
    await page.waitForTimeout(100);
    expect(await storageValue(page, "session", key)).toBeNull();

    await page.goto("/candidate/resume?mode=edit");
    await page.locator('input[name="professionalTitle"]').fill("فقط تا پایان زبانه");
    await page.waitForTimeout(450);
    await page.close();
    const replacementTab = await context.newPage();
    await replacementTab.goto("/candidate/resume?mode=edit");
    await expect(replacementTab.locator('input[name="professionalTitle"]')).toHaveValue("عنوان نهایی E2E");
  });
});
