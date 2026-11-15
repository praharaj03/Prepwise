import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInThisContext } from "node:vm";
import ts from "typescript";

// Compile the installed project's TS/TSX while replacing external service boundaries.
export function loadModule(filename, mocks = {}, cache = new Map()) {
  const absolute = resolve(filename);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const loadedModule = { exports: {} };
  cache.set(absolute, loadedModule);
  const require = createRequire(absolute);
  const importModule = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith("@/") || id.startsWith(".")) {
      const base = id.startsWith("@/") ? resolve(id.slice(2)) : resolve(absolute, "..", id);
      const path = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")]
        .find((path) => existsSync(path) && statSync(path).isFile());
      if (!path) throw new Error(`Cannot resolve ${id}`);
      return loadModule(path, mocks, cache);
    }
    return require(id);
  };
  const { outputText } = ts.transpileModule(readFileSync(absolute, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: absolute,
  });
  runInThisContext(`(function(require, module, exports) {\n${outputText}\n})`, { filename: absolute })(
    importModule, loadedModule, loadedModule.exports,
  );
  return loadedModule.exports;
}
