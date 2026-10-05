import "server-only";
import sanitizeHtml from "sanitize-html";

export function sanitizeJobDescription(value: unknown) {
  return sanitizeHtml(typeof value === "string" ? value : "", {
    allowedTags: ["p", "br", "strong", "b", "ul", "ol", "li"],
    allowedAttributes: {},
    transformTags: { b: "strong" },
    disallowedTagsMode: "discard",
  }).trim();
}
