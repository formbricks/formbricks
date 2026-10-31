import { zipOf } from "../../core/__fixtures__/zip-builders";

/**
 * Word files for the reader's tests, written part by part: a `.docx` is a zip of XML parts, and the
 * cases the reader must handle (numbering, tracked changes, merged cells, hidden text) are easiest to
 * state as the XML Word writes for them.
 */

export const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** A run of text. */
export const r = (text: string, rPr = "") =>
  `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${escape(text)}</w:t></w:r>`;

/** A paragraph of `content` (runs, or plain text made one run), with its paragraph properties. */
export const p = (
  content: string,
  { style, num, pPr = "" }: { style?: string; num?: [number, number]; pPr?: string } = {}
) => {
  const runs = content.startsWith("<") ? content : r(content);
  const properties = [
    style ? `<w:pStyle w:val="${style}"/>` : "",
    num ? `<w:numPr><w:ilvl w:val="${num[1]}"/><w:numId w:val="${num[0]}"/></w:numPr>` : "",
    pPr,
  ].join("");
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ""}${runs}</w:p>`;
};

/** A table cell holding `content` (paragraphs, or plain text made one), with its cell properties. */
export const tc = (content: string, tcPr = "") =>
  `<w:tc>${tcPr ? `<w:tcPr>${tcPr}</w:tcPr>` : ""}${content.startsWith("<") ? content : p(content)}</w:tc>`;

/** A table row of cells (each a `tc`, or plain text made one). */
export const tr = (cells: string[], trPr = "") =>
  `<w:tr>${trPr ? `<w:trPr>${trPr}</w:trPr>` : ""}${cells.map((cell) => (cell.startsWith("<w:tc") ? cell : tc(cell))).join("")}</w:tr>`;

/** A table of rows (each a `tr`, or a list of cell texts). */
export const tbl = (rows: (string | string[])[]) =>
  `<w:tbl><w:tblPr/>${rows.map((row) => (Array.isArray(row) ? tr(row) : row)).join("")}</w:tbl>`;

/** A numbering level: `[format, text]`, e.g. `["decimal", "%1."]`. */
type TLevel = [format: string, text: string, extra?: string];

/** `numbering.xml` with one abstract numbering per entry, and a `w:num` pointing at each, same ids. */
export const numbering = (
  abstracts: Record<number, TLevel[]>,
  nums: Record<number, { abstract: number; overrides?: string }> = {}
) => {
  const abstractXml = Object.entries(abstracts)
    .map(
      ([id, levels]) =>
        `<w:abstractNum w:abstractNumId="${id}">${levels
          .map(
            ([format, text, extra = ""], ilvl) =>
              `<w:lvl w:ilvl="${ilvl}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${escape(text)}"/>${extra}</w:lvl>`
          )
          .join("")}</w:abstractNum>`
    )
    .join("");
  const allNums: Record<string, { abstract: number; overrides?: string }> = {
    ...Object.fromEntries(Object.keys(abstracts).map((id) => [id, { abstract: Number(id) }])),
    ...nums,
  };
  const numXml = Object.entries(allNums)
    .map(
      ([id, num]) =>
        `<w:num w:numId="${id}"><w:abstractNumId w:val="${num.abstract}"/>${num.overrides ?? ""}</w:num>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="${W_NS}">${abstractXml}${numXml}</w:numbering>`;
};

/** `styles.xml` with the given paragraph styles: `{ id: { name, basedOn?, pPr? } }`. */
export const styles = (defs: Record<string, { name: string; basedOn?: string; pPr?: string }>) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W_NS}">${Object.entries(defs)
    .map(
      ([id, def]) =>
        `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${def.name}"/>${
          def.basedOn ? `<w:basedOn w:val="${def.basedOn}"/>` : ""
        }${def.pPr ? `<w:pPr>${def.pPr}</w:pPr>` : ""}</w:style>`
    )
    .join("")}</w:styles>`;

/** The namespaces Word declares on a document, for content that uses more than `w:`. */
const DOCUMENT_NAMESPACES = [
  `xmlns:w="${W_NS}"`,
  `xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"`,
  `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"`,
  `xmlns:v="urn:schemas-microsoft-com:vml"`,
  `xmlns:o="urn:schemas-microsoft-com:office:office"`,
  `xmlns:r="${OFFICE_REL}"`,
  `xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"`,
].join(" ");

/** `word/document.xml` with `body` as its body. */
export const documentXml = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${DOCUMENT_NAMESPACES}><w:body>${body}<w:sectPr/></w:body></w:document>`;

/**
 * A `.docx` whose body is `body`, with its numbering, styles and title when given. `documentPath` puts
 * the document elsewhere than `word/document.xml`, which only the package's relationships then name.
 * `parts` adds or replaces parts as they are. `stored` writes the parts uncompressed: a body that
 * repeats one element thousands of times compresses past the zip guard's ratio limit otherwise.
 */
export const docx = ({
  body,
  numbering: numberingXml,
  styles: stylesXml,
  title,
  documentPath = "word/document.xml",
  parts = {},
  stored = false,
}: {
  body: string;
  numbering?: string;
  styles?: string;
  title?: string;
  documentPath?: string;
  parts?: Record<string, string | Uint8Array>;
  stored?: boolean;
}): Uint8Array<ArrayBuffer> => {
  const directory = documentPath.slice(0, documentPath.lastIndexOf("/"));
  const fileName = documentPath.slice(documentPath.lastIndexOf("/") + 1);
  const documentRels = [
    numberingXml ? `<Relationship Id="rId1" Type="${OFFICE_REL}/numbering" Target="numbering.xml"/>` : "",
    stylesXml ? `<Relationship Id="rId2" Type="${OFFICE_REL}/styles" Target="styles.xml"/>` : "",
  ].join("");
  return zipOf(
    {
      "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
      "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${RELS_NS}"><Relationship Id="rId1" Type="${OFFICE_REL}/officeDocument" Target="/${documentPath}"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
      "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">${
        title === undefined ? "" : `<dc:title>${escape(title)}</dc:title>`
      }</cp:coreProperties>`,
      [documentPath]: documentXml(body),
      [`${directory}/_rels/${fileName}.rels`]: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${RELS_NS}">${documentRels}</Relationships>`,
      ...(numberingXml ? { [`${directory}/numbering.xml`]: numberingXml } : {}),
      ...(stylesXml ? { [`${directory}/styles.xml`]: stylesXml } : {}),
      ...parts,
    },
    stored ? 0 : 6
  );
};
