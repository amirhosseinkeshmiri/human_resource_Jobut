import { z } from "zod";
import {
  employmentTypes,
  seniorityLevels,
  workplaceTypes,
} from "@/jobs/validation";

export const PREFERRED_LOCATIONS_MAX = 5;
export const PREFERRED_LOCATION_MAX_LENGTH = 160;

const locationSchema = z.string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(z.string()
    .min(1, "محل کاری خالی معتبر نیست.")
    .max(PREFERRED_LOCATION_MAX_LENGTH, "نام محل کاری بیش از حد طولانی است."));

function uniqueValues<T extends string>(values: T[]) {
  return [...new Set(values)];
}

export const candidateJobPreferencesSchema = z.object({
  preferredLocations: z.array(locationSchema)
    .max(PREFERRED_LOCATIONS_MAX, "حداکثر ۵ محل کاری مجاز است.")
    .transform((locations) => {
      const seen = new Set<string>();
      return locations.filter((location) => {
        const key = location.toLocaleLowerCase("fa-IR");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }),
  preferredWorkplaceTypes: z.array(z.enum(workplaceTypes, { error: "نحوه حضور معتبر نیست." }))
    .transform(uniqueValues),
  preferredEmploymentTypes: z.array(z.enum(employmentTypes, { error: "نوع همکاری معتبر نیست." }))
    .transform(uniqueValues),
  preferredSeniorityLevels: z.array(z.enum(seniorityLevels, { error: "سطح شغلی معتبر نیست." }))
    .transform(uniqueValues),
});

export type CandidateJobPreferences = z.output<typeof candidateJobPreferencesSchema>;

export function candidateJobPreferencesFromFormData(formData: FormData) {
  return {
    preferredLocations: formData.getAll("preferredLocations")
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    preferredWorkplaceTypes: formData.getAll("preferredWorkplaceTypes"),
    preferredEmploymentTypes: formData.getAll("preferredEmploymentTypes"),
    preferredSeniorityLevels: formData.getAll("preferredSeniorityLevels"),
  };
}
