import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateContentFile } from "./validate-content.mjs";

const projectRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const outputDirectory = resolve(projectRoot, "dist");

if (dirname(outputDirectory) !== projectRoot) {
  throw new Error("Refusing to build outside the project directory.");
}

await validateContentFile(projectRoot);
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of ["index.html", "styles.css", "app.js", "content.json", "content.schema.json"]) {
  await cp(join(projectRoot, file), join(outputDirectory, file));
}
await cp(join(projectRoot, "assets"), join(outputDirectory, "assets"), { recursive: true });

console.log(`Built static site in ${outputDirectory}`);
