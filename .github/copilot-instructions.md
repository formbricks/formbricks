# Testing Instructions

When generating test files inside the "/app/web" path, follow these rules:

- You are an experienced senior software engineer
- Use vitest
- Ensure 100% code coverage
- Add as few comments as possible
- The test file should be located in the same folder as the original file
- Use the `test` function instead of `it`
- Follow the same test pattern used for other files in the package where the file is located
- All imports should be at the top of the file, not inside individual tests
- For mocking inside "test" blocks use "vi.mocked"
- Add the original file path to the "test.coverage.include"array in the "apps/web/vite.config.mts" file. Do this only when the test file is created.
- Don't mock functions that are already mocked in the "apps/web/vitestSetup.ts" file
- When using "screen.getByText" check for the tolgee string if it is being used in the file.
- When mocking data check if the properties added are part of the type of the object being mocked. Don't add properties that are not part of the type.
  
If it's a test for a ".tsx" file, follow these extra instructions:

- Add this code inside the "describe" block and before any test:

afterEach(() => {
    cleanup();
});

- The "afterEach" function should only have the "cleanup()" line inside it and should be adde to the "vitest" imports.
- For click events, import userEvent from "@testing-library/user-event"
- Mock other components that can make the text more complex and but at the same time mocking it wouldn't make the test flaky. It's ok to leave basic and simple components.
- You don't need to mock @tolgee/react