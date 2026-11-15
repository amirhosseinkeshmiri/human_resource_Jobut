import type { MetadataRoute } from "next";
import { BRAND_DESCRIPTION_FA, BRAND_NAME_EN, BRAND_NAME_FA } from "@/brand/identity";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND_NAME_FA} | ${BRAND_NAME_EN}`,
    short_name: BRAND_NAME_FA,
    description: BRAND_DESCRIPTION_FA,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#143091",
    lang: "fa",
    dir: "rtl",
  };
}
