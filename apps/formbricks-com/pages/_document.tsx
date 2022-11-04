import { Head, Html, Main, NextScript } from "next/document";

const themeScript = `
  let isDarkMode = window.matchMedia('(prefers-color-scheme: dark)')

  function updateTheme(theme) {
    theme = theme ?? window.localStorage.theme ?? 'system'

    if (theme === 'dark' || (theme === 'system' && isDarkMode.matches)) {
      document.documentElement.classList.add('dark')
    } else if (theme === 'light' || (theme === 'system' && !isDarkMode.matches)) {
      document.documentElement.classList.remove('dark')
    }

    return theme
  }
  
  function updateThemeWithoutTransitions(theme) {
    updateTheme(theme)
    document.documentElement.classList.add('[&_*]:!transition-none')
    window.setTimeout(() => {
      document.documentElement.classList.remove('[&_*]:!transition-none')
    }, 0)
  }

  document.documentElement.setAttribute('data-theme', updateTheme())

  new MutationObserver(([{ oldValue }]) => {
    let newValue = document.documentElement.getAttribute('data-theme')
    if (newValue !== oldValue) {
      try {
        window.localStorage.setItem('theme', newValue)
      } catch {}
      updateThemeWithoutTransitions(newValue)
    }
  }).observe(document.documentElement, { attributeFilter: ['data-theme'], attributeOldValue: true })

  isDarkMode.addEventListener('change', () => updateThemeWithoutTransitions())
`;

export default function Document() {
  return (
    <Html className="antialiased [font-feature-settings:'ss01']" lang="en" dir="ltr">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />

        <link rel="apple-touch-icon" sizes="180x180" href="/faveicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/faveicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/faveicon/favicon-16x16.png" />
        <link rel="manifest" href="/faveicon/site.webmanifest" />
        <link rel="mask-icon" href="/faveicon/safari-pinned-tab.svg" color="#002941" />
        <link rel="shortcut icon" href="/faveicon/favicon.ico" />
        <meta name="msapplication-TileColor" content="#002941" />
        <meta name="msapplication-config" content="/faveicon/browserconfig.xml" />
        <meta name="theme-color" content="#ffffff" />
      </Head>
      <body className="bg-blue-100 dark:bg-blue">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
