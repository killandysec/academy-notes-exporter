# Reproduction prompt

This cleaned-up prompt consolidates the final workflow and improvements. Supply your own path ID and vault location. Attach the exporter script when requesting modifications.

```text
Build a browser-only JavaScript exporter that turns the learning-path modules I can access in my signed-in training portal into Obsidian Markdown.

Use neutral branding: Academy Notes Exporter. Do not hardcode a provider, certification, account identity, personal filesystem path, or course content.

Run from Chrome DevTools on an HTTPS lesson route containing /app/module/<id>/section/<id>. Add a removable floating panel with learning-path ID, notebook folder, optional asset origin, replace-existing checkbox, and buttons for this module or all accessible path modules.

Read the current portal's /api/v2/paths/{id}, /modules/{id}, /modules/{id}/sections, /sections/{id}, and /walkthroughs/{id}, all beneath the same /api/v2 base. Handle optional data wrappers. Validate path IDs and retain path order. Use the existing same-origin session. Do not unlock content, submit answers, start labs, or bypass access restrictions.

Use showDirectoryPicker to select the Obsidian vault root and verify .obsidian exists. Write under Notes/<notebook>, with numbered module folders and lesson notes. Include YAML source/module/section metadata, linked indexes and an export report.

Preserve text, headings, tables, code fences, inline code, practice questions and hidden-answer placeholders. Download accessible lesson/question/walkthrough images into module assets folders with relative links. Parse nested Markdown labels and parentheses safely, respecting fenced and inline code. Keep remote links and warnings on failed image downloads.

Infer asset origin from rendered /content/modules/ or /content/walkthroughs/ images. Accept an explicit HTTPS image URL/origin for /storage/ to asset-host /content/ mapping. Do not embed credentials.

Fetch available walkthroughs and embed matching instructions under a Walkthrough heading in each lesson. Use normalized exact lesson-title matching for level-one/two headings, with code-fence awareness. Retain unknown/ambiguous sections and module reference material in the module index, with warnings. Do not create a separate walkthrough note.

Mark managed walkthrough blocks for idempotent reruns. Keep existing lesson bodies and managed blocks by default, while allowing missing walkthrough blocks to be added. Refresh generated indexes/reports. Replacement explicitly opts into overwriting matching notes. Do not delete user files.

Report written/skipped/missing/locked sections, walkthrough blocks, images and warnings. Preserve completed files after partial failure. Explain that labs, videos, archives, inaccessible answers and unavailable walkthroughs are outside scope.

Deliver one readable .js file, an identical .txt copy, a clear README, and offline tests using fictional data and an in-memory vault. Cover path selection, locked modules, images, walkthrough matching/fallback, code fences, reruns, overwrites and invalid vault/path guards. Bundle no real course content or private data. Distinguish fixture verification from live portal testing.
```
