import "server-only";
import path from "node:path";
import FontStore from "@react-pdf/font";
import layoutDocument, { type DocumentNode, type Node } from "@react-pdf/layout";
import * as P from "@react-pdf/primitives";
import renderPdfDocument from "@react-pdf/render";
import PDFDocument from "pdfkit";
import { isolateResumeRtlText, languageLabel, safeResumeLink, type ResumePdfData } from "./pdf-policy";
import { credentialRecordTypeLabels } from "../candidate-credentials/validation";

const fontStore = new FontStore();
const fontDirectory = path.join(process.cwd(), "node_modules", "vazirmatn", "fonts", "ttf");
fontStore.register({
  family: "Vazirmatn",
  fonts: [
    { src: path.join(fontDirectory, "Vazirmatn-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDirectory, "Vazirmatn-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(fontDirectory, "Vazirmatn-Bold.ttf"), fontWeight: 700 },
  ],
});
fontStore.registerHyphenationCallback((word) => [word]);

const palette = {
  ink: "#172033",
  muted: "#5f6b7a",
  accent: "#146c72",
  accentSoft: "#e9f5f4",
  border: "#dce3e8",
  paper: "#ffffff",
};

const styles = {
  page: { direction: "rtl", backgroundColor: palette.paper, color: palette.ink, fontFamily: "Vazirmatn", fontSize: 10, lineHeight: 1.65, paddingTop: 42, paddingBottom: 48, paddingHorizontal: 46 },
  header: { borderBottomWidth: 1.5, borderBottomColor: palette.accent, paddingBottom: 18, marginBottom: 20 },
  name: { fontSize: 24, fontWeight: 700, textAlign: "right", lineHeight: 1.35 },
  title: { marginTop: 4, color: palette.accent, fontSize: 13, fontWeight: 600, textAlign: "right" },
  city: { marginTop: 5, color: palette.muted, fontSize: 9.5, textAlign: "right" },
  section: { marginBottom: 18 },
  sectionHeading: { fontSize: 13, fontWeight: 700, color: palette.accent, textAlign: "right", marginBottom: 8 },
  paragraph: { textAlign: "right", color: palette.ink, lineHeight: 1.8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: palette.accentSoft, borderRadius: 4, color: palette.accent, paddingVertical: 4, paddingHorizontal: 8, fontSize: 9 },
  item: { borderRightWidth: 2, borderRightColor: palette.border, paddingRight: 10, marginBottom: 12 },
  itemTitle: { fontWeight: 600, fontSize: 10.5, textAlign: "right" },
  itemSubtitle: { color: palette.muted, marginTop: 2, textAlign: "right" },
  date: { color: palette.accent, fontSize: 8.5, marginTop: 3, textAlign: "right" },
  description: { color: palette.ink, marginTop: 5, textAlign: "right", lineHeight: 1.75 },
  links: { gap: 5 },
  link: { color: palette.accent, fontSize: 9, textAlign: "right", textDecoration: "none" },
  languageRow: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 16, borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: 5 },
  languageName: { fontWeight: 600, textAlign: "right" },
  languageLevel: { color: palette.muted, textAlign: "left" },
  footer: { position: "absolute", bottom: 18, left: 46, right: 46, color: palette.muted, fontSize: 7.5, textAlign: "center" },
} as const;

type PdfNode = Node;

function text(value: string, style: object, props: Record<string, unknown> = {}): PdfNode {
  return {
    type: P.Text,
    style,
    props,
    children: [{ type: P.TextInstance, value: isolateResumeRtlText(value) }],
  } as PdfNode;
}

function view(children: PdfNode[], style: object, props: Record<string, unknown> = {}): PdfNode {
  return { type: P.View, style, props, children } as PdfNode;
}

function link(value: string, href: string): PdfNode {
  return {
    type: P.Link,
    style: styles.link,
    props: { src: href },
    children: [{ type: P.TextInstance, value: isolateResumeRtlText(value) }],
  } as PdfNode;
}

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", timeZone: "UTC" });
function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function dateRange(startDate: string, endDate: string | null, isCurrent: boolean) {
  return `${formatDate(startDate)} تا ${isCurrent ? "اکنون" : endDate ? formatDate(endDate) : "—"}`;
}

function section(title: string, children: PdfNode[]): PdfNode {
  return view([
    text(title, styles.sectionHeading, { minPresenceAhead: 44 }),
    ...children,
  ], styles.section);
}

export function buildResumePdfDocument(resume: ResumePdfData): DocumentNode {
  const linkedinUrl = safeResumeLink(resume.linkedinUrl);
  const portfolioUrl = safeResumeLink(resume.portfolioUrl);
  const sections: PdfNode[] = [];

  if (resume.professionalSummary.trim()) {
    sections.push(section("درباره من", [text(resume.professionalSummary, styles.paragraph, { orphans: 2, widows: 2 })]));
  }
  if (resume.skills.length) {
    sections.push(section("مهارت‌ها", [view(resume.skills.map((skill) => text(skill, styles.chip)), styles.chips)]));
  }
  if (resume.experiences.length) {
    sections.push(section("سوابق شغلی", resume.experiences.map((item) => view([
      text(item.jobTitle, styles.itemTitle),
      text(item.companyName, styles.itemSubtitle),
      text(dateRange(item.startDate, item.endDate, item.isCurrent), styles.date),
      ...(item.description?.trim() ? [text(item.description, styles.description, { orphans: 2, widows: 2 })] : []),
    ], styles.item, { minPresenceAhead: 62 }))));
  }
  if (resume.educations.length) {
    sections.push(section("تحصیلات", resume.educations.map((item) => view([
      text(`${item.fieldOfStudy} · ${item.degree}`, styles.itemTitle),
      text(item.institutionName, styles.itemSubtitle),
      text(dateRange(item.startDate, item.endDate, item.isCurrent), styles.date),
    ], styles.item, { minPresenceAhead: 54 }))));
  }
  if (resume.languages.length) {
    sections.push(section("زبان‌ها", [view(resume.languages.map((item) => view([
      text(item.name, styles.languageName),
      text(languageLabel(item.proficiency), styles.languageLevel),
    ], styles.languageRow, { wrap: false })), {})]));
  }
  if (resume.credentials.length) {
    sections.push(section("گواهی‌ها و دوره‌های آموزشی", resume.credentials.map((item) => {
      const verificationUrl = safeResumeLink(item.verificationUrl);
      const dates = [
        item.issueDate ? `صدور/پایان: ${formatDate(item.issueDate)}` : null,
        item.expirationDate ? `انقضا: ${formatDate(item.expirationDate)}` : null,
      ].filter((value): value is string => value !== null).join(" · ");
      return view([
        text(`${item.title} · ${credentialRecordTypeLabels[item.recordType]}`, styles.itemTitle),
        text(item.issuer, styles.itemSubtitle),
        ...(dates ? [text(dates, styles.date)] : []),
        ...(item.credentialId ? [text(`شناسه گواهی: ${item.credentialId}`, styles.description)] : []),
        ...(item.description?.trim() ? [text(item.description, styles.description, { orphans: 2, widows: 2 })] : []),
        ...(verificationUrl ? [link("مشاهده لینک اعتبارسنجی", verificationUrl)] : []),
      ], styles.item, { minPresenceAhead: 62 });
    })));
  }
  if (linkedinUrl || portfolioUrl) {
    sections.push(section("پیوندهای حرفه‌ای", [view([
      ...(linkedinUrl ? [link(`LinkedIn: ${linkedinUrl}`, linkedinUrl)] : []),
      ...(portfolioUrl ? [link(`نمونه‌کار: ${portfolioUrl}`, portfolioUrl)] : []),
    ], styles.links)]));
  }

  return {
    type: P.Document,
    props: {
      title: `رزومه ${resume.firstName} ${resume.lastName}`,
      author: `${resume.firstName} ${resume.lastName}`,
      creator: "JobUT",
      producer: "JobUT",
      language: "fa-IR",
    },
    children: [{
      type: P.Page,
      props: { size: "A4", orientation: "portrait", wrap: true },
      style: styles.page,
      children: [
        view([
          text(`${resume.firstName} ${resume.lastName}`, styles.name),
          text(resume.professionalTitle, styles.title),
          text(`محل سکونت: ${resume.city}`, styles.city),
        ], styles.header),
        ...sections,
        text("رزومه ساخته‌شده در JobUT", styles.footer, { fixed: true }),
      ],
    }],
  } as DocumentNode;
}

export async function renderResumePdf(resume: ResumePdfData) {
  const document = buildResumePdfDocument(resume);
  const pdf = new PDFDocument({
    autoFirstPage: false,
    compress: true,
    pdfVersion: "1.7",
    lang: "fa-IR",
    displayTitle: true,
    info: {
      Title: document.props.title,
      Author: document.props.author,
      Creator: "JobUT",
      Producer: "JobUT",
      CreationDate: new Date(),
    },
  });
  const layoutWithFonts = layoutDocument as unknown as (
    value: DocumentNode,
    fonts: FontStore,
  ) => ReturnType<typeof layoutDocument>;
  const layout = await layoutWithFonts(document, fontStore);
  const stream = renderPdfDocument(pdf as Parameters<typeof renderPdfDocument>[0], layout);
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
