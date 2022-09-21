import { useMemo } from "react";
import { generateId } from "../lib/utils";

function usePages({blocks, formId}) {
  
    //const pages = useMemo(() => {
        const pages = [];
        let currentPage = {
          id: formId, // give the first page the formId as id by default
          blocks: [],
        };
        for (const block of blocks) {
          if (block.type !== "pageTransition") {
            currentPage.blocks.push(block);
          } else {
            currentPage.blocks.push({
              id: generateId(10),
              data: {
                label: block.data.submitLabel,
              },
              type: "submitButton",
            });
            pages.push(currentPage);
            currentPage = {
              id: block.id,
              blocks: [],
            };
          }
        }
        pages.push(currentPage);
        return pages;
     // }, [blocks, formId]);
  //return pages
}

export default usePages