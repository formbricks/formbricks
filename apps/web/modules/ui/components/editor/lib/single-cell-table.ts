import { $isTableCellNode, $isTableRowNode, type TableNode } from "@lexical/table";

/** A spreadsheet cell is editable rich text in a survey, including after the survey is reopened. */
export const $unwrapSingleCellTable = (table: TableNode): void => {
  if (table.getChildrenSize() !== 1) return;
  const row = table.getFirstChild();
  if (!$isTableRowNode(row) || row.getChildrenSize() !== 1) return;

  const cell = row.getFirstChild();
  if (!$isTableCellNode(cell) || cell.getColSpan() !== 1 || cell.getRowSpan() !== 1) return;

  for (const child of cell.getChildren()) {
    table.insertBefore(child);
  }
  table.remove();
};
