# Update Instructions

Update Cursor commands and skills from the `@yottagraph-app/aether-instructions` npm package.

## Overview

This command downloads the latest instructions package and extracts it to your `.cursor/` directory. A manifest file (`.cursor/.aether-instructions-manifest`) tracks which files came from the package so updates only replace package-provided files.

**What happens:**

1. Downloads the latest `@yottagraph-app/aether-instructions` package
2. Deletes files listed in the existing manifest
3. Removes the deprecated `.cursor/rules/` directory if present (rules were replaced by the `aether` skill)
4. Extracts fresh files from the package
5. Writes a new manifest
6. Commits the changes

**Your files are safe:** Only paths listed in the manifest are removed before reinstall. Other files under `.cursor/` are left alone.

**Shell compatibility:** Run the bash snippets below with **`bash`**, not bare `zsh`. An **empty line** in the manifest can make `rm -rf ".cursor/$rel"` delete **all of `.cursor/`** — Step 4 skips blank lines to avoid that.

---

## Step 1: Check Current Version

Read the current installed version:

```bash
cat .cursor/.aether-instructions-version 2>/dev/null || echo "Not installed"
```

Report to user:

> Current version: X.Y.Z (or "Not installed")

---

## Step 2: Check Latest Version

Query npm for the latest version:

```bash
npm view @yottagraph-app/aether-instructions version
```

Compare with current:

- If same version: Ask user if they want to reinstall anyway
- If newer version: Proceed with update
- If current is newer: Warn user (they may have a pre-release)

---

## Step 3: Download Package

Create a temporary directory and download the package:

```bash
TEMP_DIR=$(mktemp -d)
npm pack @yottagraph-app/aether-instructions@latest --pack-destination "$TEMP_DIR"
```

Extract the tarball:

```bash
tar -xzf "$TEMP_DIR"/*.tgz -C "$TEMP_DIR"
```

The extracted content is in `$TEMP_DIR/package/`.

---

## Step 4: Delete Previously Installed Files

Read the manifest and delete listed paths. **Skip blank lines** — an empty `rel` would run `rm -rf ".cursor/"` and wipe the whole directory. Entries prefixed with `root/` point at files at the repo root (currently just `AGENTS.md`); only remove **regular files** there, never directories.

```bash
if [ -f .cursor/.aether-instructions-manifest ]; then
  while IFS= read -r rel || [ -n "$rel" ]; do
    [ -z "$rel" ] && continue
    case "$rel" in
      root/*)
        target="${rel#root/}"
        case "$target" in ""|*..*) continue ;; esac
        [ -f "$target" ] && rm -f "$target"
        ;;
      *)
        rm -rf ".cursor/$rel"
        ;;
    esac
  done < .cursor/.aether-instructions-manifest
fi
```

Also remove the deprecated `.cursor/rules/` directory (superseded by the `aether` skill in `.cursor/skills/aether/`):

```bash
rm -rf .cursor/rules
```

---

## Step 5: Copy New Files

Create directories if needed:

```bash
mkdir -p .cursor/commands .cursor/skills
```

Copy files from the extracted package:

```bash
cp "$TEMP_DIR/package/commands/"* .cursor/commands/ 2>/dev/null || true
cp -r "$TEMP_DIR/package/skills/"* .cursor/skills/ 2>/dev/null || true
```

Copy the root-level AGENTS.md from the package to the tenant repo root, if the package ships one:

```bash
[ -f "$TEMP_DIR/package/AGENTS.md" ] && cp "$TEMP_DIR/package/AGENTS.md" ./AGENTS.md
```

### Data-mode variant overlay

If this project uses **mcp-only** (or another non-default mode), re-apply the same overlay `init-project.js` uses. Read the saved mode:

```bash
MODE=$(tr -d '\n' < .cursor/.aether-data-mode 2>/dev/null || echo "api-mcp")
PKG="$TEMP_DIR/package"
if [ "$MODE" != "api-mcp" ] && [ -d "$PKG/variants/$MODE/commands" ]; then
  cp "$PKG/variants/$MODE/commands/"* .cursor/commands/ 2>/dev/null || true
fi
if [ "$MODE" != "api-mcp" ] && [ -d "$PKG/variants/$MODE/skills" ]; then
  # Overlay per-file so default skill topics survive
  for src_dir in "$PKG/variants/$MODE/skills/"*/; do
    [ -d "$src_dir" ] || continue
    dir_name=$(basename "$src_dir")
    mkdir -p ".cursor/skills/$dir_name"
    cp "$src_dir"* ".cursor/skills/$dir_name/" 2>/dev/null || true
  done
fi
if [ "$MODE" = "mcp-only" ]; then
  rm -rf .cursor/skills/elemental-api
fi
```

If `.cursor/.aether-data-mode` is missing, skip the overlay (defaults to **api-mcp**).

---

## Step 6: Write Manifest and Version Marker

Build a manifest of all installed files (one relative path per line). **Do not** build a string with a leading `\n` — that writes a blank first line and breaks Step 4. Prefer one `echo` per line:

```bash
{
  for f in .cursor/commands/*.md; do [ -f "$f" ] && echo "commands/$(basename "$f")"; done
  for d in .cursor/skills/*/; do [ -d "$d" ] && echo "skills/$(basename "$d")"; done
  [ -f "$TEMP_DIR/package/AGENTS.md" ] && [ -f ./AGENTS.md ] && echo "root/AGENTS.md"
} > .cursor/.aether-instructions-manifest
```

If the repo uses **bash** for this loop and a glob might match nothing, run `shopt -s nullglob` first so the loops don't treat `*.md` as a literal filename.

Write the version marker:

```bash
grep -o '"version": *"[^"]*"' "$TEMP_DIR/package/package.json" | grep -o '[0-9][^"]*' > .cursor/.aether-instructions-version
```

---

## Step 7: Cleanup

Remove the temporary directory:

```bash
rm -rf "$TEMP_DIR"
```

---

## Step 8: Report Changes

Count what was installed:

```bash
wc -l < .cursor/.aether-instructions-manifest
ls .cursor/commands/*.md 2>/dev/null | wc -l
ls -d .cursor/skills/*/ 2>/dev/null | wc -l
```

Report to user:

> Updated to @yottagraph-app/aether-instructions@X.Y.Z
>
> - Commands: N files
> - Skills: N directories

---

## Step 9: Commit Changes

Commit the updated instruction files. A root `.gitignore` rule like `skills/` can **ignore** `.cursor/skills/`; if `git add .cursor/skills/` reports ignored paths, force-add:

```bash
git add .cursor/commands/ .cursor/.aether-instructions-version .cursor/.aether-instructions-manifest
git add -f .cursor/skills/
[ -f AGENTS.md ] && git add AGENTS.md
# Remove the legacy rules dir from tracking if it was committed in an earlier install
git rm -rf --cached --ignore-unmatch .cursor/rules 2>/dev/null || true
git commit -m "Update instructions to vX.Y.Z"
```

Use the repo's commit convention if applicable (e.g. `[Agent commit] Update instructions to vX.Y.Z`).

> Changes committed. Your instructions are now up to date.

---

## Troubleshooting

### npm pack fails

If `npm pack` fails with a registry error:

> Make sure you have network access to npmjs.com. If you're behind a proxy, configure npm: `npm config set proxy <url>`

### Permission denied

If you get permission errors:

> Try running with appropriate permissions, or check that `.cursor/` is writable.

### Want to customize a command, skill topic, or AGENTS.md?

If you need to modify a package-provided file (including the root `AGENTS.md`):

1. Edit it directly — your changes will persist until the next update
2. To preserve changes across updates, copy it to a new name first (e.g. `cp AGENTS.md AGENTS.local.md`)
3. Remove the original's entry from `.cursor/.aether-instructions-manifest` so it won't be deleted on update (for `AGENTS.md`, remove the `root/AGENTS.md` line)

### Blank line in manifest deleted `.cursor/`

Regenerate the manifest with Step 6 (echo-per-line form). Ensure Step 4 skips empty lines.

### `git add` says `.cursor/skills` is ignored

Use `git add -f .cursor/skills/` as in Step 9, or narrow `.gitignore` so `skills/` only ignores the project `skills/` folder (e.g. `/skills/` at repo root) instead of every `skills` path.
