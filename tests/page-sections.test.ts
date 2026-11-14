import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx$/.test(name) ? [path] : [];
  });

const files = walk("src").map((path) => ({ path, text: readFileSync(path, "utf8") }));
const allText = files.map((file) => file.text).join("\n");

describe("ligações «Nesta página»", () => {
  it("cada âncora das secções existe como id no código", () => {
    let checked = 0;
    for (const { path, text } of files.filter((file) => file.path.includes("page.tsx"))) {
      const block = text.match(/sections=\{\[([\s\S]*?)\]\}/)?.[1] ?? "";
      for (const [, anchor] of block.matchAll(/href: "#([\w-]+)"/g)) {
        const defined = allText.includes(`id="${anchor}"`) || allText.includes(`id: "${anchor}"`);
        checked += 1;
        expect(defined, `${path}: #${anchor} não tem id`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
