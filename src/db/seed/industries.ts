import { sql } from "drizzle-orm";
import { db, sqlClient } from "@/db";
import { industries } from "@/db/schema";

const industrySeed = [
  ["نرم‌افزار و فناوری اطلاعات", "software-it"],
  ["خدمات مالی", "financial-services"],
  ["بانکداری", "banking"],
  ["بیمه", "insurance"],
  ["تجارت الکترونیک", "e-commerce"],
  ["خرده‌فروشی", "retail"],
  ["تولید", "manufacturing"],
  ["خودرو", "automotive"],
  ["ساخت‌وساز", "construction"],
  ["املاک و مستغلات", "real-estate"],
  ["سلامت و درمان", "healthcare"],
  ["داروسازی", "pharmaceutical"],
  ["آموزش", "education"],
  ["مخابرات", "telecommunications"],
  ["لجستیک", "logistics"],
  ["حمل‌ونقل", "transportation"],
  ["انرژی", "energy"],
  ["نفت و گاز", "oil-gas"],
  ["غذا و نوشیدنی", "food-beverage"],
  ["رسانه", "media"],
  ["تبلیغات و بازاریابی", "advertising-marketing"],
  ["مشاوره", "consulting"],
  ["گردشگری و هتلداری", "tourism-hospitality"],
  ["کشاورزی", "agriculture"],
  ["معدن و صنایع فلزی", "mining-metals"],
  ["پتروشیمی و صنایع شیمیایی", "petrochemical-chemicals"],
  ["کالاهای مصرفی", "consumer-goods"],
  ["پوشاک و نساجی", "fashion-textiles"],
  ["حقوقی", "legal"],
  ["منابع انسانی و کاریابی", "human-resources-recruitment"],
  ["پژوهش و توسعه", "research-development"],
  ["سازمان‌های مردم‌نهاد", "nonprofit"],
] as const;

async function seedIndustries() {
  await db
    .insert(industries)
    .values(industrySeed.map(([name, slug]) => ({ name, slug })))
    .onConflictDoUpdate({
      target: industries.slug,
      set: { name: sql`excluded.name`, updatedAt: new Date() },
    });

  console.log(`Seeded ${industrySeed.length} industries.`);
}

seedIndustries()
  .catch((error: unknown) => {
    console.error("Industry seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlClient.end();
  });
