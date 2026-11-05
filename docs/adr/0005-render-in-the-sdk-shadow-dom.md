# Render creatives in the always-loaded SDK, inside a Shadow DOM

Creatives are drawn by a tiny DOM renderer (`@formbricks/creatives`, `render` + `resolve`, about 6 KB gz) bundled into js-core, inside a Shadow DOM with a `:host { all: initial }` reset and px units (ENG-3911). The server sends ready-computed styles per mode and device. The survey bundle (about 238 KB gz) still loads only when a creative is clicked, and the editor preview mounts the same renderer.

## Considered Options

- **Loading the survey bundle on every page view**: too heavy.
- **Light DOM under `#fbjs`**: CSS leaks both ways.
- **A separate React preview**: drifts from what visitors see.
