import { describe, expect, test } from "vitest";
import { hasStylesInHeadScripts, setsTextOrBackgroundColor, shouldShowDarkPreviewHint } from "./hints";

describe("setsTextOrBackgroundColor", () => {
  test.each([
    ["#fbjs { color: #111; }"],
    ["#fbjs { font-weight: 600; background: white }"],
    ['[data-fb-part="card"] { BACKGROUND-COLOR : #fff !important; }'],
    ["@media (min-width: 1px) { .a { color: red } }"],
    [".a { &:hover { color: red; } }"],
    [".a { color: var(--acme-ink) }"],
  ])("finds a color declaration in %j", (css) => {
    expect(setsTextOrBackgroundColor(css)).toBe(true);
  });

  test.each([
    [""],
    ["#fbjs { --brand-color: #111; border-color: red; }"],
    ["a:hover { font-weight: 600 }"],
    ["@media (prefers-color-scheme: dark) { .a { font-size: 2px } }"],
    ["/* .a { color: red } */ .b { margin: 0 }"],
    ['.a::before { content: "color: red;" }'],
    ["color: red;"],
    [".a { background-image: none; outline-color: red }"],
  ])("finds none in %j", (css) => {
    expect(setsTextOrBackgroundColor(css)).toBe(false);
  });

  test("stays linear on a pathological input", () => {
    const css = `${"{".repeat(50_000)}${"a".repeat(50_000)}`;
    expect(setsTextOrBackgroundColor(css)).toBe(false);
  });
});

describe("shouldShowDarkPreviewHint", () => {
  test("shows when base CSS sets colors and the dark field is empty", () => {
    expect(shouldShowDarkPreviewHint({ light: "#fbjs { color: #111 }", dark: "  " })).toBe(true);
  });

  test("hides once dark CSS exists, or when base CSS sets no colors", () => {
    expect(shouldShowDarkPreviewHint({ light: "#fbjs { color: #111 }", dark: "#fbjs{}" })).toBe(false);
    expect(shouldShowDarkPreviewHint({ light: "#fbjs { margin: 0 }", dark: "" })).toBe(false);
    expect(shouldShowDarkPreviewHint(null)).toBe(false);
  });
});

describe("hasStylesInHeadScripts", () => {
  test.each([
    ["<style>body{}</style>"],
    ['<STYLE type="text/css">'],
    ["<style"],
    ['<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">'],
    ["<link href='/a.css' rel='preload stylesheet'>"],
    ["<link rel=stylesheet href=/a.css>"],
    ['<link\nREL="StyleSheet" href="a.css" />'],
  ])("detects page styles in %j", (scripts) => {
    expect(hasStylesInHeadScripts(scripts)).toBe(true);
  });

  test.each([
    [null],
    [""],
    ['<script src="https://example.com/a.js"></script>'],
    ['<link rel="icon" href="stylesheet.css">'],
    ['<link rel="preconnect" href="https://fonts.gstatic.com">'],
    ["<styles>not a tag</styles>"],
    ["<linker rel=stylesheet>"],
  ])("finds none in %j", (scripts) => {
    expect(hasStylesInHeadScripts(scripts)).toBe(false);
  });

  test("checks every link, not only the first", () => {
    expect(hasStylesInHeadScripts('<link rel="icon"><link rel="stylesheet" href="a.css">')).toBe(true);
  });
});
