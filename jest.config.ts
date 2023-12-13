import { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  collectCoverage: true,
  coverageProvider: "v8",
  testMatch: ["<rootDir>/packages/**/*.test.ts"],
  projects: ["<rootDir>/packages/*"],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
  transformIgnorePatterns: [
    "/node_modules/",
    "^.+\\.module\\.(css|sass|scss)$",
    "node_modules/(?!uuid).+\\.js$",
  ],
  moduleNameMapper: {
    "^uuid$": "uuid",
  },
};

export default config;
