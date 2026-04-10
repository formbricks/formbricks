declare module "pdfmake/build/pdfmake" {
  interface PdfMakeStatic {
    vfs: Record<string, string>;
    createPdf(docDefinition: Record<string, unknown>): {
      getBlob(callback: (blob: Blob) => void): void;
    };
  }
  const pdfMake: PdfMakeStatic;
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  export const pdfMake: { vfs: Record<string, string> } | undefined;
}
