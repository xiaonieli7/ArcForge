# Composer model and Git redesign QA

- Source visual truth: `E:/ArcForge/crates/agent-gui/design-qa-artifacts/composer-reference.png`
- Closed implementation: `E:/ArcForge/crates/agent-gui/design-qa-artifacts/composer-model-closed.png`
- Add menu with Git: `E:/ArcForge/crates/agent-gui/design-qa-artifacts/composer-add-git-menu.png`
- Git submenu: `E:/ArcForge/crates/agent-gui/design-qa-artifacts/composer-git-submenu.png`
- Model and reasoning picker: `E:/ArcForge/crates/agent-gui/design-qa-artifacts/composer-model-picker.png`
- Preview route: `http://127.0.0.1:4174/test/fixtures/composer-preview/`
- State: light theme, empty composer, `glm-5.2`, Agent mode, high reasoning, `master` branch

## Full-view comparison evidence

- The implementation preserves the reference card width, generous top writing area, 24 px radius, translucent surface, soft border, shadow, expand control, and right-aligned send action.
- The bottom toolbar is intentionally reduced from many unrelated controls to three anchors: `添加`, current model, and send.
- Git no longer occupies a permanent pill. It is a clearly labeled project action in the Add menu and exposes the existing branch workflow in a nested menu.
- The model selector no longer occupies the page header. It is anchored above the composer model pill, keeping conversation configuration next to the message being composed.
- Reasoning is no longer a separate toolbar pill. Low, medium, high, and extra-high choices live in one fixed section inside the model panel.

## Focused-region comparison evidence

- Typography and rhythm: 11–14 px interface text, 30–32 px controls, 8–12 px row spacing, and compact group separators match the existing ArcForge density.
- Popover geometry: both menus open above the composer, stay within the 1280 × 720 test viewport, and use collision-aware positioning. The Git submenu opens laterally without covering its parent trigger.
- Visual hierarchy: file/reference actions remain first, runtime capabilities remain together, and Git is separated as the project-level action. Model search and model results are scrollable while execution mode and reasoning remain stable.
- Tokens and assets: only existing theme tokens and the project icon set are used. No replacement SVG, emoji, placeholder image, or one-off color system was introduced.

## Interaction and accessibility checks

- The closed composer exposes exactly one Add button, one current-model button, and one send button.
- Opening Add exposes Upload, reference file, Skill, web search, Thinking, and Git as semantic menu items.
- Git opens as an expanded submenu with fetch, pull, push, refresh, local branches, create branch, and more actions.
- The model panel is a semantic dialog with two labeled radio groups: execution mode and reasoning effort.
- Selecting `最高` updates the checked reasoning option without closing the panel.
- Selecting another model closes the panel and updates the composer trigger.
- Switching Agent to Chat updates the checked execution-mode option.
- TypeScript and focused model-picker/composer tests pass after the refactor.

## Comparison history

1. Closed-state comparison against the supplied composer crop.
   - Finding: the permanent reasoning and branch pills created the toolbar clutter the user wanted removed.
   - Fix: consolidated reasoning into the model panel and Git into Add, leaving a quieter three-anchor toolbar.
2. Add-menu and Git-submenu inspection.
   - Finding: no clipping or collision at the reference-sized composer width; submenu hierarchy remains understandable.
3. Model-panel inspection.
   - Finding: model selection, execution mode, and reasoning form one coherent configuration surface; no actionable P0, P1, or P2 visual findings remain.

## Follow-up polish

- No blocking polish items. If more composer tools are added later, the Add menu should gain short group labels rather than adding new permanent toolbar controls.

final result: passed
