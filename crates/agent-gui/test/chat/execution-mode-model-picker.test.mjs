import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pickerSources = [
  readFileSync(
    new URL("../../src/pages/chat/components/ChatModelPicker.tsx", import.meta.url),
    "utf8",
  ),
  readFileSync(
    new URL("../../../agent-gateway/web/src/pages/chat/ChatHeader.tsx", import.meta.url),
    "utf8",
  ),
];
const desktopComposerSource = readFileSync(
  new URL("../../src/pages/chat/components/ChatComposerBar.tsx", import.meta.url),
  "utf8",
);
const desktopHeaderSource = readFileSync(
  new URL("../../src/pages/chat/components/ChatHeader.tsx", import.meta.url),
  "utf8",
);

test("model pickers use popover semantics instead of menu semantics", () => {
  for (const source of pickerSources) {
    assert.match(source, /import \{ Popover \} from "@base-ui\/react"/);
    assert.match(source, /<Popover\.Root open=\{isModelPickerOpen\}/);
    assert.match(source, /<Popover\.Popup/);
    assert.match(source, /aria-label=\{t\("chat\.selectModel"\)\}/);
    assert.doesNotMatch(source, /DropdownMenu/);
  }
});

test("execution mode switchers expose a native radio group", () => {
  for (const source of pickerSources) {
    assert.match(source, /role="radiogroup"/);
    assert.match(source, /aria-label=\{t\("settings\.executionMode"\)\}/);
    assert.equal((source.match(/value="text"/g) ?? []).length, 1);
    assert.equal((source.match(/value="tools"/g) ?? []).length, 1);
    assert.match(source, /checked=\{!isAgent\}/);
    assert.match(source, /checked=\{isAgent\}/);
    assert.match(source, /onChange=\{\(\) => onSelectExecutionMode\("text"\)\}/);
    assert.match(source, /onChange=\{\(\) => onSelectExecutionMode\("tools"\)\}/);
    assert.match(source, /has-\[:focus-visible\]:ring-2/);
  }
});

test("popover interactions preserve mode changes and close after model selection", () => {
  for (const source of pickerSources) {
    assert.match(source, /onClick=\{\(\) => toggleGroup\(group\.id\)\}/);
    assert.match(source, /aria-pressed=\{isSelected\}/);
    assert.match(source, /onSelectModel\(parsed\);\s+setIsModelPickerOpen\(false\);/);
  }
});

test("model pickers search models and providers", () => {
  for (const source of pickerSources) {
    assert.match(source, /initialFocus=\{searchInputRef\}/);
    assert.match(source, /placeholder=\{t\("chat\.searchModel"\)\}/);
    assert.match(source, /\w+\.model\.toLowerCase\(\)\.includes\(normalizedSearch\)/);
    assert.match(source, /\w+\.providerName\.toLowerCase\(\)\.includes\(normalizedSearch\)/);
    assert.match(source, /t\("chat\.noModelFound"\)/);
  }
});

test("desktop picker keeps reasoning effort inside the model popover", () => {
  const source = pickerSources[0];
  assert.match(source, /aria-label=\{t\("chat\.runtime\.reasoning"\)\}/);
  assert.match(source, /reasoningOptions\.map\(\(reasoning\) =>/);
  assert.match(source, /onChange=\{\(\) => onSelectReasoning\(reasoning\)\}/);
  assert.match(source, /settings\.reasoning\.xhigh/);
});

test("desktop composer owns model and Git controls", () => {
  assert.match(desktopComposerSource, /<ChatModelPicker/);
  assert.match(desktopComposerSource, /presentation="submenu"/);
  assert.match(desktopComposerSource, /<DropdownMenuContent\s+keepMounted/);
  assert.doesNotMatch(desktopComposerSource, /<Select/);
  assert.doesNotMatch(desktopHeaderSource, /modelOptions|onSelectModel|Popover/);
});
