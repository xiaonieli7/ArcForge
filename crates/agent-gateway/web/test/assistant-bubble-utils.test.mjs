import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createWebModuleLoader } from "../../test/helpers/load-web-module.mjs";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const loader = createWebModuleLoader({ rootDir });
const { BUILTIN_TOOL_CATALOG } = loader.loadModule("src/lib/tools/builtinToolCatalog.ts");
const { isBuiltinShareToolName } = loader.loadModule(
  "src/pages/chat/assistant-bubble/assistantBubbleUtils.ts",
);

test("shared history recognizes every catalog tool as builtin", () => {
  for (const entry of BUILTIN_TOOL_CATALOG) {
    assert.equal(isBuiltinShareToolName(entry.toolName), true, entry.toolName);
  }
  assert.equal(isBuiltinShareToolName("mcp_docs_search"), true);
  assert.equal(isBuiltinShareToolName("CustomTool"), false);
});
