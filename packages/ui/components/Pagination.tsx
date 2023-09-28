function Pagination({
  baseUrl,
  currentPage,
  totalItems,
  itemsPerPage,
}: {
  baseUrl: string;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const previousPageLink = currentPage === 1 ? "#" : `${baseUrl}?page=${currentPage - 1}`;
  const nextPageLink = currentPage === totalPages ? "#" : `${baseUrl}?page=${currentPage + 1}`;

  const getDisplayedPages = () => {
    if (totalPages <= 20) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    } else {
      let range = [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
      return [1, ...range.filter((n) => n > 1 && n < totalPages), totalPages];
    }
  };

  return (
    <nav aria-label="Page navigation" className="flex justify-center">
      <ul className="mt-4 inline-flex -space-x-px text-sm">
        <li>
          <a
            href={previousPageLink}
            className={`ml-0 flex h-8 items-center justify-center rounded-l-lg border border-gray-300 bg-white px-3 text-gray-500 ${
              currentPage === 1
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            }`}>
            Previous
          </a>
        </li>

        {getDisplayedPages().map((pageNum) => {
          const pageLink = `${baseUrl}?page=${pageNum}`;
          return (
            <li key={pageNum} className="hidden sm:block">
              <a
                href={pageNum === currentPage ? "#" : pageLink}
                className={`flex h-8 items-center justify-center px-3 ${
                  pageNum === currentPage ? "bg-blue-50 text-green-500" : "bg-white text-gray-500"
                } border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white`}>
                {pageNum}
              </a>
            </li>
          );
        })}

        <li>
          <a
            href={nextPageLink}
            className={`ml-0 flex h-8 items-center justify-center rounded-r-lg border border-gray-300 bg-white px-3 text-gray-500 ${
              currentPage === totalPages
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            }`}>
            Next
          </a>
        </li>
      </ul>
    </nav>
  );
}

export { Pagination };
