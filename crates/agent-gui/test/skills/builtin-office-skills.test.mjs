import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const spreadsheetSkill = readFileSync(
  new URL("../../src-tauri/prompt/skills/arcforge-spreadsheets/SKILL.md", import.meta.url),
  "utf8",
);
const spreadsheetScript = readFileSync(
  new URL(
    "../../src-tauri/prompt/skills/arcforge-spreadsheets/scripts/spreadsheet.py",
    import.meta.url,
  ),
  "utf8",
);
const slidesSkill = readFileSync(
  new URL("../../src-tauri/prompt/skills/arcforge-slides/SKILL.md", import.meta.url),
  "utf8",
);
const presentationScript = readFileSync(
  new URL(
    "../../src-tauri/prompt/skills/arcforge-slides/scripts/presentation.py",
    import.meta.url,
  ),
  "utf8",
);
const builtinRegistrySource = readFileSync(
  new URL("../../src-tauri/src/services/skills/builtin.rs", import.meta.url),
  "utf8",
);

test("built-in spreadsheet skill is registered with deterministic helpers", () => {
  assert.match(spreadsheetSkill, /^---\r?\nname: arcforge-spreadsheets\r?\n/m);
  assert.match(spreadsheetSkill, /`OfficeRuntime` tool/);
  assert.match(spreadsheetSkill, /action=patch/);
  assert.match(spreadsheetSkill, /action=inspect/);
  assert.match(spreadsheetSkill, /`SpreadsheetCode`/);
  assert.match(spreadsheetSkill, /references\/code-api\.md/);
  assert.match(spreadsheetSkill, /Never set "force=true"/);
  assert.doesNotMatch(spreadsheetSkill, /python spreadsheet\.py/);
  assert.match(spreadsheetScript, /from openpyxl import Workbook, load_workbook/);
  assert.match(spreadsheetScript, /def atomic_save/);
  assert.match(spreadsheetScript, /class SpreadsheetCodeValidator/);
  assert.match(spreadsheetScript, /def execute_spreadsheet_code/);
  assert.match(spreadsheetScript, /FORBIDDEN_CODE_NODES/);
  assert.match(spreadsheetScript, /formula_results_calculated/);
  assert.match(builtinRegistrySource, /name: "arcforge-spreadsheets"/);
  assert.match(
    builtinRegistrySource,
    /prompt\/skills\/arcforge-spreadsheets\/scripts\/spreadsheet\.py/,
  );
  assert.match(builtinRegistrySource, /references\/code-api\.md/);
});

test("built-in slides skill is registered with structural and visual verification paths", () => {
  assert.match(slidesSkill, /^---\r?\nname: arcforge-slides\r?\n/m);
  assert.match(slidesSkill, /"OfficeRuntime" tool/);
  assert.match(slidesSkill, /action=create/);
  assert.match(slidesSkill, /action=inspect/);
  assert.match(slidesSkill, /action=render/);
  assert.doesNotMatch(slidesSkill, /python presentation\.py/);
  assert.match(slidesSkill, /not visually rendered/);
  assert.match(presentationScript, /from pptx import Presentation/);
  assert.match(presentationScript, /def inspect_presentation/);
  assert.match(presentationScript, /def render_pdf/);
  assert.match(builtinRegistrySource, /name: "arcforge-slides"/);
  assert.match(
    builtinRegistrySource,
    /prompt\/skills\/arcforge-slides\/scripts\/presentation\.py/,
  );
});

test("ArcForge Office skills use ownership markers to preserve user collisions", () => {
  assert.match(builtinRegistrySource, /_arcforge_builtin\.json/);
  assert.match(builtinRegistrySource, /SPREADSHEETS_OWNERSHIP_MARKER_CONTENT/);
  assert.match(builtinRegistrySource, /SLIDES_OWNERSHIP_MARKER_CONTENT/);
  assert.match(builtinRegistrySource, /\\"owner\\":\\"ArcForge\\"/);
});
