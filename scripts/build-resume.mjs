import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import {
  loadPortfolio,
  resumeExperience,
  resumeProjects,
  resumeStack,
} from "../src/lib/portfolio.mjs";

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));

/** Prepare plain JSON data, using the shared résumé selection rules.
 * @param {import("../src/lib/portfolio.mjs").Portfolio} portfolio
 */
export function prepareResumeData(portfolio) {
  return {
    ...portfolio.profile,
    skills: resumeStack(portfolio),
    experience: resumeExperience(portfolio),
    projects: resumeProjects(portfolio).map((project) => ({
      title: project.title,
      url: project.url,
      technologies: project.technologies,
      bullets:
        project.bullets.length > 0
          ? project.bullets
          : project.summary
            ? [project.summary]
            : [],
    })),
  };
}

/** Compile shared data with the bundled template and fonts, then write a PDF.
 * `root` selects portfolio data; template/fonts always come from this repository.
 * @param {{root?: string, outFile?: string}} [options]
 * @returns {Promise<{bytes: Buffer, pages: number}>}
 */
export async function buildResume({ root = sourceRoot, outFile } = {}) {
  const dataRoot = root.startsWith("file:")
    ? fileURLToPath(root)
    : resolve(root);
  const output = resolve(outFile ?? resolve(dataRoot, "public/resume.pdf"));
  const data = prepareResumeData(loadPortfolio({ root: dataRoot }));
  const compiler = NodeCompiler.create({
    fontArgs: [{ fontPaths: [resolve(sourceRoot, "resume/fonts")] }],
  });
  const compiled = compiler.compile({
    mainFileContent: await readFile(
      resolve(sourceRoot, "resume/resume.typ"),
      "utf8",
    ),
    inputs: { portfolio: JSON.stringify(data) },
  });
  const document = compiled.result;
  if (compiled.hasError() || !document) {
    compiled.printErrors();
    throw new Error("Résumé compilation failed; see Typst diagnostics above.");
  }
  const pages = document.numOfPages;
  const bytes = compiler.pdf(document);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes);
  if (pages > 1) {
    console.warn(
      `Warning: résumé overflowed to ${pages} pages. Try turning off resume on a project or trimming bullets.`,
    );
  }
  console.log(`Résumé: ${output} (${pages} ${pages === 1 ? "page" : "pages"})`);
  return { bytes, pages };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  buildResume().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
