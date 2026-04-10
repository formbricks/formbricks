import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { type ExportableSurvey, type ExportableQuestion, type ExportableSection } from "./types";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const C = {
  primary: "0EA5E9",
  accent: "8B5CF6",
  dark: "0F172A",
  muted: "64748B",
  light: "F1F5F9",
  border: "E2E8F0",
  white: "FFFFFF",
  required: "DC2626",
};

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: C.border },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: C.border },
  left: { style: BorderStyle.SINGLE, size: 1, color: C.border },
  right: { style: BorderStyle.SINGLE, size: 1, color: C.border },
};

function txt(text: string, opts: Partial<{ bold: boolean; size: number; color: string; font: string; italics: boolean }> = {}): TextRun {
  return new TextRun({ text, bold: opts.bold, size: opts.size || 20, color: opts.color || C.dark, font: opts.font || "Calibri", italics: opts.italics });
}

function para(runs: TextRun[], spacing?: { before?: number; after?: number }): Paragraph {
  return new Paragraph({ children: runs, spacing: { before: spacing?.before || 0, after: spacing?.after || 40 } });
}

function buildQuestionContent(q: ExportableQuestion): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];

  // Header: Q# + headline
  content.push(para([
    txt(`Q${q.index}  `, { bold: true, size: 24, color: C.primary }),
    txt(q.headline, { bold: true, size: 24 }),
  ], { before: 200, after: 60 }));

  // Type + required
  const metaRuns: TextRun[] = [txt(q.type, { size: 18, color: C.accent, bold: true })];
  if (q.required) {
    metaRuns.push(txt("  |  ", { size: 18, color: C.border }));
    metaRuns.push(txt("REQUIRED", { size: 18, color: C.required, bold: true }));
  }
  content.push(para(metaRuns, { after: 60 }));

  // Subheader
  if (q.subheader) {
    content.push(para([txt(q.subheader, { size: 20, color: C.muted, italics: true })], { after: 80 }));
  }

  // Render based on question type
  if ((q.elementType === "multipleChoiceSingle" || q.elementType === "multipleChoiceMulti") && q.choices) {
    const marker = q.elementType === "multipleChoiceSingle" ? "○" : "☐";
    for (const choice of q.choices) {
      content.push(para([
        txt(`  ${marker}  `, { size: 20, color: C.muted }),
        txt(choice.label, { size: 20 }),
        ...(choice.isOther ? [txt("  (Other)", { size: 16, color: C.muted, italics: true })] : []),
      ]));
    }
  } else if (q.elementType === "ranking" && q.choices) {
    q.choices.forEach((choice, i) => {
      content.push(para([
        txt(`  ${i + 1}.  `, { size: 20, color: C.muted, bold: true }),
        txt(`☰  ${choice.label}`, { size: 20 }),
      ]));
    });
  } else if (q.elementType === "nps" && q.npsScale) {
    // NPS as a single-row table 0-10
    const cells = Array.from({ length: 11 }, (_, i) =>
      new TableCell({
        children: [new Paragraph({ children: [txt(String(i), { size: 18, bold: true, color: i <= 6 ? C.required : i <= 8 ? "92400E" : "065F46" })], alignment: AlignmentType.CENTER })],
        width: { size: 818, type: WidthType.DXA },
        borders: thinBorder,
        shading: { type: ShadingType.SOLID, color: i <= 6 ? "FEE2E2" : i <= 8 ? "FEF3C7" : "D1FAE5", fill: i <= 6 ? "FEE2E2" : i <= 8 ? "FEF3C7" : "D1FAE5" },
      })
    );
    content.push(new Table({ rows: [new TableRow({ children: cells })], width: { size: 9000, type: WidthType.DXA }, layout: TableLayoutType.FIXED }));
    if (q.npsScale.lowerLabel || q.npsScale.upperLabel) {
      content.push(para([
        txt(q.npsScale.lowerLabel || "", { size: 16, color: C.muted }),
        txt("                                                    ", { size: 16 }),
        txt(q.npsScale.upperLabel || "", { size: 16, color: C.muted }),
      ]));
    }
  } else if (q.elementType === "rating" && q.ratingScale) {
    const symbols: string[] = [];
    for (let i = 1; i <= q.ratingScale.range; i++) {
      if (q.ratingScale.style === "star") symbols.push("☆");
      else if (q.ratingScale.style === "smiley") symbols.push(["😞", "😟", "😐", "😊", "😁"][Math.round(((i - 1) / (q.ratingScale.range - 1)) * 4)]);
      else symbols.push(String(i));
    }
    content.push(para([txt(`  ${symbols.join("   ")}`, { size: q.ratingScale.style === "number" ? 22 : 28, color: q.ratingScale.style === "star" ? "F59E0B" : C.dark })]));
    if (q.ratingScale.lowerLabel || q.ratingScale.upperLabel) {
      content.push(para([
        txt(q.ratingScale.lowerLabel || "", { size: 16, color: C.muted }),
        txt("                                                    ", { size: 16 }),
        txt(q.ratingScale.upperLabel || "", { size: 16, color: C.muted }),
      ]));
    }
  } else if (q.elementType === "matrix" && q.matrix) {
    // Matrix as table
    const headerCells = [
      new TableCell({ children: [new Paragraph({ children: [] })], width: { size: 3000, type: WidthType.DXA }, borders: thinBorder, shading: { type: ShadingType.SOLID, color: C.light, fill: C.light } }),
      ...q.matrix.columns.map((col) =>
        new TableCell({
          children: [new Paragraph({ children: [txt(col, { size: 16, bold: true, color: C.muted })], alignment: AlignmentType.CENTER })],
          width: { size: Math.floor(6000 / q.matrix!.columns.length), type: WidthType.DXA },
          borders: thinBorder,
          shading: { type: ShadingType.SOLID, color: C.light, fill: C.light },
        })
      ),
    ];
    const dataRows = q.matrix.rows.map((row) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [txt(row, { size: 18 })] })], borders: thinBorder }),
          ...q.matrix!.columns.map(() =>
            new TableCell({
              children: [new Paragraph({ children: [txt("○", { size: 18, color: C.muted })], alignment: AlignmentType.CENTER })],
              borders: thinBorder,
            })
          ),
        ],
      })
    );
    content.push(new Table({
      rows: [new TableRow({ children: headerCells }), ...dataRows],
      width: { size: 9000, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
    }));
  } else if (q.elementType === "openText" && q.inputConfig) {
    const ph = q.inputConfig.placeholder || "Type your answer here...";
    content.push(para([txt(ph, { size: 20, color: C.muted, italics: true })]));
  } else if (q.elementType === "consent" && q.consentLabel) {
    content.push(para([txt("☐  ", { size: 20, color: C.muted }), txt(q.consentLabel, { size: 20 })]));
  } else if (q.elementType === "date") {
    content.push(para([txt("📅  MM / DD / YYYY", { size: 20, color: C.muted })]));
  } else if (q.elementType === "fileUpload") {
    content.push(para([txt("📎  Click or drag to upload files", { size: 20, color: C.muted, italics: true })]));
  } else if (q.elementType === "address" && q.addressFields) {
    for (const f of q.addressFields) {
      content.push(para([
        txt(`${f.name}${f.required ? " *" : ""}`, { size: 18, bold: true, color: C.muted }),
      ]));
      content.push(para([txt(f.placeholder || "", { size: 18, color: C.muted, italics: true })]));
    }
  } else if (q.elementType === "contactInfo" && q.contactFields) {
    for (const f of q.contactFields) {
      content.push(para([txt(`${f.name}${f.required ? " *" : ""}`, { size: 18, bold: true, color: C.muted })]));
      content.push(para([txt(f.placeholder || "", { size: 18, color: C.muted, italics: true })]));
    }
  }

  // Extra details
  if (q.details.length > 0) {
    for (const d of q.details) {
      content.push(para([txt(`${d.label}: `, { size: 16, bold: true, color: C.muted }), txt(d.value, { size: 16, color: C.muted })]));
    }
  }

  // Logic
  if (q.logic && q.logic.length > 0) {
    content.push(para([txt("Skip Logic:", { size: 16, bold: true, color: C.muted })], { before: 60 }));
    for (const rule of q.logic) {
      content.push(para([txt(`  ${rule.summary}`, { size: 16, color: C.muted })]));
    }
  }

  // Divider
  content.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  return content;
}

function buildSectionContent(section: ExportableSection): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];

  content.push(new Paragraph({
    text: section.name,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.border, space: 8 } },
  }));

  if (section.logic && section.logic.length > 0) {
    content.push(para([txt("Block Logic:", { size: 16, bold: true, color: C.muted })], { before: 60 }));
    for (const rule of section.logic) {
      content.push(para([txt(`  ${rule.summary}`, { size: 16, color: C.muted })]));
    }
  }

  for (const q of section.questions) {
    content.push(...buildQuestionContent(q));
  }
  return content;
}

export async function generateSurveyDocx(data: ExportableSurvey): Promise<Blob> {
  const totalQuestions = data.sections.reduce((sum, s) => sum + s.questions.length, 0);
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(para([txt(data.name, { bold: true, size: 40 })], { after: 120 }));
  children.push(new Paragraph({
    children: [txt(`Created: ${formatDate(data.createdAt)}  |  Status: ${data.status.toUpperCase()}  |  Type: ${data.type}  |  Questions: ${totalQuestions}`, { size: 20, color: C.muted })],
    spacing: { after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: C.primary, space: 12 } },
  }));

  // Welcome card
  if (data.welcomeCard) {
    children.push(new Paragraph({ text: "Welcome Screen", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }));
    if (data.welcomeCard.headline) children.push(para([txt(data.welcomeCard.headline, { bold: true, size: 24 })], { after: 40 }));
    if (data.welcomeCard.subheader) children.push(para([txt(data.welcomeCard.subheader, { size: 20, color: C.muted })], { after: 40 }));
    if (data.welcomeCard.buttonLabel) children.push(para([txt("Button: ", { bold: true, size: 20, color: C.muted }), txt(data.welcomeCard.buttonLabel, { size: 20 })], { after: 120 }));
  }

  // Sections
  for (const section of data.sections) {
    children.push(...buildSectionContent(section));
  }

  // Endings
  if (data.endings.length > 0) {
    children.push(new Paragraph({ text: "Endings", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 }, border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.border, space: 8 } } }));
    for (const ending of data.endings) {
      if (ending.type === "endScreen") {
        children.push(para([txt("End Screen", { bold: true, size: 20, color: C.accent })], { before: 80 }));
        if (ending.headline) children.push(para([txt(ending.headline, { bold: true, size: 22 })]));
        if (ending.subheader) children.push(para([txt(ending.subheader, { size: 20, color: C.muted })]));
      } else {
        children.push(para([txt("Redirect", { bold: true, size: 20, color: C.accent })], { before: 80 }));
        if (ending.redirectUrl) children.push(para([txt(`URL: ${ending.redirectUrl}`, { size: 20, color: C.muted })]));
      }
    }
  }

  // Footer
  children.push(new Paragraph({
    children: [txt(`Exported from Formbricks on ${formatDate(new Date())}`, { size: 18, color: C.muted, italics: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    border: { top: { style: BorderStyle.SINGLE, size: 1, color: C.border, space: 12 } },
  }));

  const doc = new Document({
    styles: { default: { heading2: { run: { size: 28, bold: true, color: C.dark, font: "Calibri" } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 } } }, children }],
  });

  return await Packer.toBlob(doc);
}
