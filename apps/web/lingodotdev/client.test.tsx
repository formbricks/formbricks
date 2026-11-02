import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useTranslation } from "react-i18next";
import { describe, expect, test } from "vitest";
import { I18nProvider } from "./client";

const Greeting = () => {
  const { t } = useTranslation();
  return <p>{t("greeting")}</p>;
};

const EN = { greeting: "Hello" };
const DE = { greeting: "Hallo" };

describe("I18nProvider", () => {
  // ENG-3771: the provider used to return null until a client-side effect had imported the locale,
  // so the server HTML of every route was empty.
  test("renders translated children in the server HTML", () => {
    const html = renderToString(
      <I18nProvider language="en-US" messages={EN}>
        <Greeting />
      </I18nProvider>
    );

    expect(html).toContain("Hello");
  });

  test("renders on the first client render without waiting for an effect", () => {
    render(
      <I18nProvider language="de-DE" messages={DE}>
        <Greeting />
      </I18nProvider>
    );

    expect(screen.getByText("Hallo")).toBeInTheDocument();
  });

  test("switches to the new locale's messages when the language changes", () => {
    const { rerender } = render(
      <I18nProvider language="en-US" messages={EN}>
        <Greeting />
      </I18nProvider>
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();

    rerender(
      <I18nProvider language="de-DE" messages={DE}>
        <Greeting />
      </I18nProvider>
    );

    expect(screen.getByText("Hallo")).toBeInTheDocument();
  });

  test("keeps concurrent renders in different locales apart", () => {
    const en = renderToString(
      <I18nProvider language="en-US" messages={EN}>
        <Greeting />
      </I18nProvider>
    );
    const de = renderToString(
      <I18nProvider language="de-DE" messages={DE}>
        <Greeting />
      </I18nProvider>
    );

    expect(en).toContain("Hello");
    expect(de).toContain("Hallo");
  });
});
