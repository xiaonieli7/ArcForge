---
name: arcforge-slides
description: Create, inspect, validate, and optionally render professional PowerPoint PPTX presentations with deterministic local tooling. Use when the user asks for slides, a presentation, a pitch deck, a report deck, speaker material, or PowerPoint output.
---

# ArcForge Slides

Create reviewable PowerPoint deliverables with ArcForge's bundled Office Runtime and a structured JSON specification. Do not invoke system Python for this workflow.

## Workflow

1. Derive the audience, purpose, slide count, narrative, visual tone, and output path from the request. Do not ask again when the request already provides enough detail.
2. Read "references/spec.md". Copy "references/example-deck.json" into the workspace when a concrete starting point helps.
3. Write the deck specification into the workspace. Keep referenced images and the generated deck in the workspace unless the user explicitly approves another destination.
4. Call the "OfficeRuntime" tool with "document=presentation", "action=create", "spec_path=<workspace-json-path>", and "output_path=<workspace-output.pptx>".

5. Reopen and structurally inspect it with "OfficeRuntime" using "document=presentation", "action=inspect", and "input_path=<workspace-output.pptx>".

6. When LibreOffice is available, render a PDF for visual review with "OfficeRuntime" using "document=presentation", "action=render", "input_path=<workspace-output.pptx>", and "output_path=<workspace-preview.pdf>".

7. Report the PPTX path, slide titles, image/table/chart counts, the PDF path when rendered, and any visual-validation limitation.

## Quality bar

- Use one clear message per slide.
- Keep titles short and use concise bullets.
- Prefer charts, metrics, and tables only when they improve comprehension.
- Maintain safe margins and consistent typography.
- Use the ArcForge theme defaults unless the user supplies a brand palette.
- Treat structural inspection as necessary but not sufficient visual verification.

## Safety

- Never set "force=true" unless the user explicitly authorized overwriting that exact output path.
- The Office Runtime already includes Python, python-pptx, and Pillow. If it is unavailable, report an ArcForge installation-integrity problem; do not install packages or fall back to system Python.
- PDF rendering still requires LibreOffice. Do not install LibreOffice without user approval.
- Do not fetch remote images without user approval. Prefer files already placed in the workspace.
- If rendering is unavailable, say that layout was structurally validated but not visually rendered.
