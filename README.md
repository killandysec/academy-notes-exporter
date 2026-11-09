# Academy Notes Exporter

Export accessible lessons from your signed-in learning portal into Obsidian, with offline images and walkthroughs beneath their matching lessons.

## Quick start

1. Download this repository as a ZIP. Open `academy-notes-exporter.txt` in a plain-text editor and review the script.
2. Sign into your course in Chrome and open an accessible lesson. Its route should contain `/app/module/<id>`.
3. Copy the entire script into Chrome DevTools Console: Option–Command–J on macOS, Ctrl–Shift–J on Windows/Linux. If Chrome blocks pasting, follow its manual prompt only after reviewing the code.
4. Enter the numeric learning-path ID from the path URL, such as `/app/paths/123/path-progress`. Choose a notebook folder, such as `Course Notes`.
5. Click **Export this module** or **Export unlocked path modules**.
6. Choose the **vault root**, the folder containing `.obsidian`, and grant folder access.
7. Wait for **Done**. Open `Notes/<notebook>/00 - Academy Export Index.md` and read `00 - Academy Export Report.md`.
8. Check some lessons, code blocks, walkthroughs and images. Disconnect from the internet to confirm the downloaded images work offline.

No Obsidian plugin, API key, or token entry is required.

## Included features

- Numbered module folders and lesson notes in path order.
- Lesson text, code blocks, tables, source links and practice questions.
- Images from lessons, questions and available walkthroughs saved under module `assets/` folders.
- Walkthroughs embedded under `## Walkthrough` in matching lessons.
- Linked indexes, progress counts and an export report with warnings.
- Literal hidden-answer placeholders preserved as supplied.

Unknown or ambiguous walkthrough headings remain in the module index for review. Content is retained rather than assigned to a guessed lesson.

## Example output

```text
Your vault/
└── Notes/
    └── Course Notes/
        ├── 00 - Academy Export Index.md
        ├── 00 - Academy Export Report.md
        └── 01 - Example Module/
            ├── 00 - Module Index.md
            ├── 01 - Introduction.md
            ├── 02 - Practice.md
            └── assets/
```

Names and content in this example are fictional. No exported course is bundled.

## Images and asset origin

The panel infers an asset origin from already-rendered images using `/content/modules/` or `/content/walkthroughs/` routes.

If downloads fail, open a working course image in a new tab, copy its address, and paste it into **Asset origin** before rerunning with replacement enabled. The script uses its origin only. This supports portals that map `/storage/modules/` and `/storage/walkthroughs/` references onto an asset host's `/content/` routes.

Failed images keep a remote link and generate a warning. Check the image counts; a complete section count alone does not prove images are available offline.

## Reruns

Existing lesson bodies and managed walkthrough blocks are kept by default. Missing walkthrough blocks may be added to existing lesson notes. Generated indexes and the latest report are refreshed each run.

**Replace existing lesson notes** explicitly overwrites matching notes and their managed walkthrough blocks. Use it deliberately for source refreshes or image retries. Back up personal annotations first.

The script does not delete user files or old standalone walkthrough notes. New walkthroughs are embedded in lessons. Use a fresh notebook folder when moving from a different export format.

## Portal compatibility

This adapter supports a particular API shape; it is not a universal website scraper. The current portal must expose these JSON endpoints:

| Endpoint | Expected data |
| --- | --- |
| `/api/v2/paths/{id}` | `id` and `modules` or `module_groups[].modules` |
| `/api/v2/modules/{id}` | name/title, access state, optional `walkthrough_id` |
| `/api/v2/modules/{id}/sections` | array, `sections`, or `items` |
| `/api/v2/sections/{id}` | `content`, `body`, or `text`; optional `questions` |
| `/api/v2/walkthroughs/{id}` | `instructions`, `content`, or `body` |

Responses may be wrapped in `data`. Entries need IDs and names/titles. Requests use the current page's origin and existing browser session. Network operations read course content and referenced images. Local writing requires the folder-picker grant.

Walkthrough level-one and level-two headings are matched to normalized exact lesson titles. Unknown or ambiguous material is retained in the module index with warnings.

Locked content is skipped. Labs, exercise archives, videos, inaccessible answers and unavailable walkthroughs are outside the export. Each person uses their own account and content access.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Disabled module button | Open a URL containing `/app/module/<number>`. |
| Non-JSON/login error | Sign in using the same Chrome profile; confirm the API contract. |
| Wrong vault | Select the folder containing `.obsidian`. |
| Missing walkthrough | Check access and module-index fallback content. |
| Missing images | Read warnings; set asset origin and retry with replacement. |
| Nested folders | Select the vault root, not a module folder. |
| Existing lesson unchanged | Default behavior keeps it; replacement is opt-in. |

## Reproduction prompt

[PROMPT.md](PROMPT.md) consolidates the final requirements into a cleaned-up prompt for rebuilding or adapting the exporter. You can use the included script directly.

## Development checks

The exporter has no runtime package dependencies. With Node.js 22 or newer:

```sh
node --test exporter.test.cjs
```

Tests use fictional content, fake portal responses and an in-memory vault. The provider-neutral release needs a live smoke test with your portal/account to confirm its current API and asset host. Fixture checks do not establish live compatibility.

Share this tool and prompt. Keep your exported course, credentials, cookies and private vault files out of the repository.
