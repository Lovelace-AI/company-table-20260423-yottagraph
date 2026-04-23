# Aether Instructions Warning

**You are editing a file managed by the `@yottagraph-app/aether-instructions` package.**

Package-managed files are tracked by `.cursor/.aether-instructions-manifest`.
They will be **overwritten** when you run `/update_instructions`.

This includes files under `.cursor/commands/`, `.cursor/skills/`, **and the
root `AGENTS.md`** (tracked as `root/AGENTS.md` in the manifest).

## Do Not

- Modify files listed in the manifest directly (changes will be lost on update)

## To Customize

If you need to modify a package-provided command, skill topic, or the root `AGENTS.md`:

1. **Copy** the file to a new name
2. Make your changes to the copy
3. Remove the original's entry from `.cursor/.aether-instructions-manifest`
   so it won't be replaced on update

Examples:

```bash
# Customize a skill topic
cp .cursor/skills/aether/data.md .cursor/skills/aether/data_custom.md

# Customize AGENTS.md
cp AGENTS.md AGENTS.local.md
# then remove the `root/AGENTS.md` line from
# .cursor/.aether-instructions-manifest

# Edit your copy — it won't be affected by instruction updates
```

## How It Works

- `.cursor/.aether-instructions-manifest` lists every file installed by the
  package (one relative path per line, e.g. `skills/aether/data.md`). Entries
  prefixed with `root/` refer to files at the tenant repo root
  (currently only `root/AGENTS.md`).
- `/update_instructions` deletes manifest entries, extracts fresh files from
  the latest package, and writes a new manifest
- Files not in the manifest are never touched
