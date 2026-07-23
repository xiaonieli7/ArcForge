import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSources = [
  {
    label: "GUI",
    source: readFileSync(
      new URL("../../src/pages/skills-hub/SkillsHubPage.tsx", import.meta.url),
      "utf8",
    ),
  },
  {
    label: "WebUI",
    source: readFileSync(
      new URL(
        "../../../agent-gateway/web/src/pages/skills-hub/SkillsHubPage.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  },
];

function functionSource(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start);
  assert.notEqual(start, -1, `${startText.trim()} must exist`);
  assert.notEqual(end, -1, `${startText.trim()} must have an end boundary`);
  return source.slice(start, end);
}

for (const { label, source } of pageSources) {
  test(`${label} blocks direct and bulk deletion of built-in Skills`, () => {
    const directDelete = functionSource(
      source,
      "  async function deleteSkill(",
      "\n  function toggleSkill(",
    );
    const bulkDelete = functionSource(
      source,
      "  async function deleteBulkSelectedInstalledSkills(",
      "\n  useEffect(",
    );

    assert.match(directDelete, /skill\.builtIn === true/);
    assert.match(bulkDelete, /skill\.builtIn !== true/);
    assert.match(source, /const protectedFromDelete = alwaysEnabled \|\| builtIn/);
    assert.match(source, /\{!protectedFromDelete && !bulkMode \? \(/);
  });

  test(`${label} labels protected Skills as built-in in cards and previews`, () => {
    assert.match(source, /const builtIn = alwaysEnabled \|\| skill\.builtIn === true/);
    assert.match(source, /\{protectedFromDelete && !bulkMode \? \(/);
    assert.match(source, /const statusLabel = builtIn/);
  });
}
