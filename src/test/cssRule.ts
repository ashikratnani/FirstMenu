// Test helper: read the declarations of the first rule in a CSS source string
// (imported with `?raw`) whose selector list contains `selector`. jsdom does
// not apply CSS modules, so this lets a test pin facts such as
// "min-height: 44px" on a control's class.
export function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.[\]()]/g, '\\$&');
  const match = new RegExp(`(?:^|[\\s,}])${escaped}(?:,[^{]*)?\\s*\\{([^}]*)\\}`).exec(css);
  if (match === null) throw new Error(`No rule for ${selector}`);
  return match[1];
}
