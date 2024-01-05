/*!
 * Sanitize an HTML string
 * (c) 2021 Chris Ferdinandi, MIT License, https://gomakethings.com
 * @param  {String}          str   The HTML string to sanitize
 * @return {String}          The sanitized string
 */
export function cleanHtml(str: string): string {
  /**
   * Convert the string to an HTML document
   * @return {Node} An HTML document
   */
  function stringToHTML() {
    let parser = new DOMParser();
    let doc = parser.parseFromString(str, "text/html");
    return doc.body || document.createElement("body");
  }

  /**
   * Remove <script> elements
   * @param  {Node} html The HTML
   */
  function removeScripts(html: Element) {
    let scripts = html.querySelectorAll("script");
    scripts.forEach((script) => {
      script.remove();
    });
  }

  /**
   * Check if the attribute is potentially dangerous
   * @param  {String}  name  The attribute name
   * @param  {String}  value The attribute value
   * @return {Boolean}       If true, the attribute is potentially dangerous
   */
  /**
   * Check if the attribute is potentially dangerous
   */
  function isPossiblyDangerous(name: string, value: string): boolean {
    let val = value.replace(/\s+/g, "").toLowerCase();
    if (
      ["src", "href", "xlink:href", "srcdoc"].includes(name) &&
      (val.includes("javascript:") || val.includes("data:") || val.includes("<script>"))
    ) {
      return true;
    }
    if (name.startsWith("on")) {
      return true;
    }
    return false;
  }

  /**
   * Remove potentially dangerous attributes from an element
   * @param  {Node} elem The element
   */
  function removeAttributes(elem: Element) {
    // Loop through each attribute
    // If it's dangerous, remove it
    let atts = elem.attributes;
    for (let i = atts.length - 1; i >= 0; i--) {
      let { name, value } = atts[i];
      if (isPossiblyDangerous(name, value)) {
        elem.removeAttribute(name);
      } else if (name === "srcdoc") {
        // Recursively sanitize srcdoc content
        elem.setAttribute(name, cleanHtml(value));
      }
    }
  }

  /**
   * Remove dangerous stuff from the HTML document's nodes
   * @param  {Node} html The HTML document
   */
  /**
   * Clean the HTML nodes recursively
   * @param  {Element} html The HTML element
   */
  function clean(html: Element) {
    let nodes = Array.from(html.children);
    for (let node of nodes) {
      removeAttributes(node);
      clean(node);
    }
  }

  // Convert the string to HTML
  let html = stringToHTML();

  // Sanitize it
  removeScripts(html);
  clean(html);

  // If the user wants HTML nodes back, return them
  // Otherwise, pass a sanitized string back
  return html.innerHTML;
}
