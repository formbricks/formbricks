# Testing Instructions

When generating test files inside the "/app/web" path, follow these rules:

- Use vitest
- Ensure 100% code coverage
- Add as few comments as possible
- The test file should be located in the same folder as the original file
- Use the `test` function instead of `it`
- Follow the same test pattern used for other files in the package were the file is located
- All imports should be at the top of the file, not inside individual tests
- For mocking inside "test" blocks use "vi.mocked"
- Add the original file path to the "test.coverage.include"array in the "apps/web/vite.config.mts" file
  
If it's a test for a ".tsx" file, follow these extra instructions:

- Add this code inside the "describe" block and before any test:

afterEach(() => {
    cleanup();
});

- For click events, import userEvent from "@testing-library/user-event"