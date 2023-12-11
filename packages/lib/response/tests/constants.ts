import { randomUUID } from "crypto";

export function randUuid(): string {
  return randomUUID();
}

export function randBrowser(): string {
  const browsers = ["Chrome", "Firefox", "Safari", "Edge", "Opera"];
  return browsers[Math.floor(Math.random() * browsers.length)];
}

export function randUrl(): string {
  const protocols = ["http", "https"];
  const domains = ["com", "net", "org", "io"];
  const randText = (length: number): string => {
    let result = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };
  return `${protocols[Math.floor(Math.random() * protocols.length)]}://www.${randText(5)}.${
    domains[Math.floor(Math.random() * domains.length)]
  }`;
}

export function randBoolean(): boolean {
  return Math.random() >= 0.5;
}

export function randText(length: number = 8): string {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export function randFullName(): string {
  const firstNames = ["John", "Jane", "Alice", "Bob", "Emily"];
  const lastNames = ["Smith", "Doe", "Johnson", "White", "Brown"];
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${
    lastNames[Math.floor(Math.random() * lastNames.length)]
  }`;
}
