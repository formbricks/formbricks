import { randomBytes } from "crypto";
import { Page } from "playwright";

export const getUser = () => {
  const name = randomBytes(4).toString("hex");
  const email = `${name}@gmail.com`;
  const password = `T${name}@123`;
  return { name, email, password };
};

export const getTeam = () => {
  let roles = ["Project Manager", "Engineer", "Founder", "Marketing Specialist"];
  let useCases = [
    "Increase conversion",
    "Improve user retention",
    "Increase user adoption",
    "Sharpen marketing messaging",
    "Support sales",
  ];
  const productName = randomBytes(8).toString("hex");
  const role = roles[Math.floor(Math.random() * roles.length)];
  const useCase = useCases[Math.floor(Math.random() * useCases.length)];
  return { role, useCase, productName };
};

export const signUpAndLogin = async (
  page: Page,
  name: string,
  email: string,
  password: string
): Promise<void> => {
  await page.goto("/auth/login");
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByRole("button", { name: "Continue with Email" }).click();
  await page.getByPlaceholder("Full Name").fill(name);
  await page.getByPlaceholder("work@email.com").fill(email);
  await page.getByPlaceholder("*******").fill(password);
  await page.press('input[name="password"]', "Enter");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("button", { name: "Login with Email" }).click();
  await page.getByPlaceholder("work@email.com").fill(email);
  await page.getByPlaceholder("*******").click();
  await page.getByPlaceholder("*******").fill(password);
  await page.getByRole("button", { name: "Login with Email" }).click();
};
