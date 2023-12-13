import { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  // collectCoverage: true,
  // on node 14.x coverage provider v8 offers good speed and more or less good report
  // coverageProvider: "v8",
  testMatch: ["**/*.test.ts"],
  // collectCoverageFrom: [
  //   "**/*.{js,jsx,ts,tsx}",
  //   "!**/*.d.ts",
  //   "!**/node_modules/**",
  //   "!<rootDir>/out/**",
  //   "!<rootDir>/.next/**",
  //   "!<rootDir>/*.config.js",
  //   "!<rootDir>/*.config.ts",
  //   "!<rootDir>/coverage/**",
  //   "!<rootDir>/jest/**",
  // ],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
  setupFilesAfterEnv: ["<rootDir>/jest/jestSetup.ts", "<rootDir>/../database/src/jestClient.ts"],
  transform: {
    // Use babel-jest to transpile tests with the next/babel preset
    // https://jestjs.io/docs/configuration#transform-objectstring-pathtotransformer--pathtotransformer-object
    "^.+\\.(ts|tsx)$": "ts-jest",
    "^.+\\.(js|jsx)$": ["babel-jest", { presets: ["next/babel"] }],
    "^.+\\.mjs$": "babel-jest",
  },
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
