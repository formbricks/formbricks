/**
 * Generates the document fixture pack next to this script. Run from `apps/web`:
 *
 *   npx tsx modules/survey/import/lanes/document/__fixtures__/scripts/generate-fixtures.ts
 *
 * Every binary is committed and small (<200 KB); this script makes them reproducible and keeps the
 * zip bomb synthetic. The PDFs are hand-assembled (uncompressed streams, standard Type1 font), which
 * pdf.js reads fine and which keeps the fixtures diffable.
 */
import JSZip from "jszip";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(OUT, { recursive: true });

// --- DOCX -------------------------------------------------------------------------------------------

const xmlEscape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const paragraph = (text: string, style?: string, numbering?: { numId: number; level: number }) =>
  `<w:p>${
    style || numbering
      ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${
          numbering
            ? `<w:numPr><w:ilvl w:val="${numbering.level}"/><w:numId w:val="${numbering.numId}"/></w:numPr>`
            : ""
        }</w:pPr>`
      : ""
  }<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;

const pageBreak = () => `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;

const table = (rows: string[][]) =>
  `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/></w:tblPr>${rows
    .map((cells) => `<w:tr>${cells.map((cell) => `<w:tc>${paragraph(cell)}</w:tc>`).join("")}</w:tr>`)
    .join("")}</w:tbl>`;

const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2)"/></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val=""/></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style>
</w:styles>`;

async function writeDocx(fileName: string, body: string, extraEntries: Record<string, string> = {}) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`
  );
  zip.file("word/styles.xml", STYLES_XML);
  zip.file("word/numbering.xml", NUMBERING_XML);
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  );
  for (const [name, content] of Object.entries(extraEntries)) {
    zip.file(name, content);
  }
  writeFileSync(join(OUT, fileName), await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

const BILINGUAL_QUESTIONS: [string, string][] = [
  ["How satisfied are you with our onboarding?", "Wie zufrieden sind Sie mit unserem Onboarding?"],
  ["Which features do you use weekly?", "Welche Funktionen nutzen Sie wöchentlich?"],
  ["How likely are you to recommend us?", "Wie wahrscheinlich ist es, dass Sie uns empfehlen?"],
  ["What would you improve first?", "Was würden Sie zuerst verbessern?"],
  ["How easy was the setup?", "Wie einfach war die Einrichtung?"],
  ["Did the documentation answer your questions?", "Hat die Dokumentation Ihre Fragen beantwortet?"],
  ["How often do you contact support?", "Wie oft kontaktieren Sie den Support?"],
  ["Which plan are you on?", "Welchen Tarif nutzen Sie?"],
  ["How many teammates use the product?", "Wie viele Kolleginnen und Kollegen nutzen das Produkt?"],
  ["Would you pay for priority support?", "Würden Sie für bevorzugten Support bezahlen?"],
  ["What is your role?", "Was ist Ihre Rolle?"],
  ["Anything else you want to tell us?", "Möchten Sie uns noch etwas mitteilen?"],
];

async function main() {
  await writeDocx(
    "survey-en-de-table.docx",
    [
      paragraph("Customer onboarding survey / Kundenumfrage Onboarding", "Title"),
      paragraph("Please answer in English or German.", undefined),
      table([["#", "English", "Deutsch"], ...BILINGUAL_QUESTIONS.map((q, i) => [String(i + 1), q[0], q[1]])]),
    ].join("")
  );

  await writeDocx(
    "survey-numbered-lists.docx",
    [
      paragraph("Product feedback survey", "Heading1"),
      paragraph("Section A: Usage", "Heading2"),
      paragraph("How often do you use the product?", undefined, { numId: 1, level: 0 }),
      paragraph("Daily", undefined, { numId: 1, level: 1 }),
      paragraph("Weekly", undefined, { numId: 1, level: 1 }),
      paragraph("Monthly", undefined, { numId: 1, level: 1 }),
      paragraph("Which devices do you use? (select all that apply)", undefined, { numId: 1, level: 0 }),
      paragraph("Laptop", undefined, { numId: 1, level: 1 }),
      paragraph("Phone", undefined, { numId: 1, level: 1 }),
      paragraph("Tablet", undefined, { numId: 1, level: 1 }),
      pageBreak(),
      paragraph("Section B: Satisfaction", "Heading2"),
      paragraph("How likely are you to recommend us to a colleague? (0-10)", undefined, {
        numId: 1,
        level: 0,
      }),
      paragraph("What is the one thing we should improve?", undefined, { numId: 1, level: 0 }),
      paragraph("Notes for the survey team:", undefined),
      paragraph("Keep it under five minutes", undefined, { numId: 2, level: 0 }),
      paragraph("Send on Tuesdays", undefined, { numId: 2, level: 0 }),
    ].join("")
  );

  // A synthetic "zip bomb": far too many entries. Small on disk, rejected before mammoth inflates it.
  {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "<Types/>");
    zip.file("word/document.xml", "<w:document/>");
    for (let index = 0; index < 600; index += 1) {
      zip.file(`word/media/blob-${index}.bin`, "x".repeat(64));
    }
    writeFileSync(
      join(OUT, "zip-bomb.docx"),
      await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
    );
  }

  // --- XLSX / CSV -------------------------------------------------------------------------------------

  const QUESTION_ROWS = [
    ["Question", "Type", "Options", "Required"],
    ["How satisfied are you with the checkout?", "rating", "1-5", "yes"],
    ["Which payment method did you use?", "single choice", "Card; PayPal; Invoice", "yes"],
    ["What nearly stopped you from buying?", "open text", "", "no"],
    ["Would you recommend the shop to a friend?", "nps", "0-10", "yes"],
    [
      "Which of these would you like to see?",
      "multiple choice",
      "Gift wrap; Same-day delivery; Loyalty points",
      "no",
    ],
  ];

  {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(QUESTION_ROWS), "Questions");
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Setting", "Value"],
        ["Language", "en-US"],
        ["Thank you text", "Thanks for shopping with us!"],
      ]),
      "Settings"
    );
    writeFileSync(
      join(OUT, "questions.xlsx"),
      XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true })
    );
  }

  writeFileSync(
    join(OUT, "questions.csv"),
    "﻿" +
      QUESTION_ROWS.map((row) => row.map((cell) => (cell.includes(";") ? `"${cell}"` : cell)).join(";")).join(
        "\r\n"
      ) +
      "\r\n"
  );

  // --- Markdown ---------------------------------------------------------------------------------------

  writeFileSync(
    join(OUT, "survey.md"),
    `# Employee pulse\r\n\r\n\r\n\r\nA short check-in, three questions.\r\n\r\n1. How was your week? (1-5)\r\n2. What blocked you?\r\n3. Which of these would help?\r\n   - Fewer meetings\r\n   - Clearer priorities\r\n   - More pairing\r\n`
  );

  // --- PDF ---------------------------------------------------------------------------------------------

  function pdfEscape(text: string): string {
    return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  /** Lines of text → a content stream using Helvetica, 14pt leading. */
  function textPage(lines: string[]): string {
    return [
      "BT",
      "/F1 12 Tf",
      "14 TL",
      "72 720 Td",
      ...lines.map((line) => `(${pdfEscape(line)}) Tj T*`),
      "ET",
    ].join("\n");
  }

  type TPdfObject = string;

  function assemblePdf(objects: TPdfObject[], trailerExtra = ""): Buffer {
    const parts: string[] = ["%PDF-1.4\n"];
    const offsets: number[] = [];
    let length = parts[0].length;
    objects.forEach((body, index) => {
      offsets.push(length);
      const chunk = `${index + 1} 0 obj\n${body}\nendobj\n`;
      parts.push(chunk);
      length += Buffer.byteLength(chunk, "latin1");
    });
    const xref = length;
    const table = [
      "xref",
      `0 ${objects.length + 1}`,
      "0000000000 65535 f ",
      ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
      "trailer",
      `<< /Size ${objects.length + 1} /Root 1 0 R ${trailerExtra} >>`,
      "startxref",
      String(xref),
      "%%EOF",
      "",
    ].join("\n");
    parts.push(table);
    return Buffer.from(parts.join(""), "latin1");
  }

  function stream(content: string): string {
    return `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
  }

  function textPdf(pages: string[][]): Buffer {
    // 1 catalog, 2 pages, 3 font, then per page: page object + content stream
    const pageIds = pages.map((_, index) => 4 + index * 2);
    const objects: TPdfObject[] = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ];
    pages.forEach((lines, index) => {
      const pageId = pageIds[index];
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`
      );
      objects.push(stream(textPage(lines)));
    });
    return assemblePdf(objects);
  }

  writeFileSync(
    join(OUT, "survey.pdf"),
    textPdf([
      [
        "Conference feedback survey",
        "",
        "1. How would you rate the keynote? (1-5)",
        "2. Which sessions did you attend?",
        "   a) Workshop A   b) Workshop B   c) Panel",
        "3. How likely are you to attend next year? (0-10)",
      ],
      [
        "4. What should we change about the venue?",
        "5. How did you hear about the conference?",
        "   - Newsletter   - Colleague   - Social media",
        "Thank you for your feedback!",
      ],
    ])
  );

  // Image-only page (a 1x1 gray pixel), no text operators → no_text_extracted.
  {
    const image =
      "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\x80\nendstream";
    const objects: TPdfObject[] = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>",
      stream("q 612 0 0 792 0 0 cm /Im1 Do Q"),
      image,
    ];
    writeFileSync(join(OUT, "survey-scanned.pdf"), assemblePdf(objects));
  }

  // Encrypted with a non-empty user password (standard security handler, RC4 40-bit). pdf.js rejects it
  // with PasswordException before reading any content, so the O/U entries only need to be well-formed.
  {
    const hex32 = (seed: number) =>
      Array.from({ length: 32 }, (_, index) =>
        ((seed * 31 + index * 17) % 256).toString(16).padStart(2, "0")
      ).join("");
    const objects: TPdfObject[] = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
      stream(textPage(["This text is unreadable without the password."])),
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Filter /Standard /V 1 /R 2 /Length 40 /P -1 /O <${hex32(7)}> /U <${hex32(13)}> >>`,
    ];
    writeFileSync(
      join(OUT, "encrypted.pdf"),
      assemblePdf(objects, `/Encrypt 6 0 R /ID [<${hex32(3).slice(0, 32)}> <${hex32(3).slice(0, 32)}>]`)
    );
  }

  console.log(`Fixtures written to ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
