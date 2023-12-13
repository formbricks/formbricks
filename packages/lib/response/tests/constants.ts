export function randUuid(): string {
  return "123e4567-e89b-12d3-a456-426614174000"; // A fixed UUID for testing
}

export function randBrowser(): string {
  return "Chrome"; // Always return 'Chrome' for testing
}

export function randUrl(): string {
  return "https://www.example.com"; // A fixed URL for testing
}

export function randBoolean(): boolean {
  return true; // Always return 'true' for testing, or alternate based on test case if needed
}

export function randText(length: number = 8): string {
  return "Abc12345".slice(0, length); // Return a fixed string, truncated or repeated to the desired length
}

export function randFullName(): string {
  return "John Smith"; // Always return 'John Smith' for testing
}
