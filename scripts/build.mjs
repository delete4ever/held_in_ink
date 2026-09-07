import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateContentFile } from "./validate-content.mjs";

const projectRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const publicDirectory = resolve(projectRoot, "public");
const outputDirectory = resolve(projectRoot, "dist");

if (dirname(outputDirectory) !== projectRoot) {
  throw new Error("Refusing to build outside the project directory.");
}

await validateContentFile(projectRoot);
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(dirname(outputDirectory), { recursive: true });
await cp(publicDirectory, outputDirectory, { recursive: true });

console.log(`Built static site in ${outputDirectory}`);
