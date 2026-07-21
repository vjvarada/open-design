# Shared Projects

Team-collaborative Open Design projects. These projects live in git so multiple people can work on them simultaneously. Edits made in the app save directly to these files — commit and push like normal code.

## Setup for new teammates

1. **Clone this repo** and install dependencies:
   ```powershell
   git clone https://github.com/vjvarada/open-design.git
   cd open-design
   pnpm install
   ```

2. **Start Open Design** (from repo root):
   ```powershell
   # Windows (double-click or run):
   .\start-open-design.ps1
   ```
   Or manually: `pnpm tools-dev`

3. **Import all projects into Open Design** (run once after clone):
   ```powershell
   # The CLI needs the sidecar IPC pipe path — tools-dev sets this up automatically.
   # Run this from the repo root while Open Design is running:
   $env:OD_SIDECAR_IPC_PATH = "\\.\pipe\open-design-default-daemon"
   Get-ChildItem shared-projects -Directory | ForEach-Object {
     pnpm exec od project import-folder $_.FullName
   }
   ```
   This registers each project folder as a separate workspace in Open Design.

4. **Collaborate:**
   - Work on designs in the app → files update in `shared-projects/<project>/`
   - `git add`, `git commit`, `git push` to share changes
   - Teammates `git pull` to get your latest work

## Projects

| Project | Description |
|---------|-------------|
| `fracktal-material-page-template-cf-nylon-8d70` | Material page templates for Fracktal 3D printing filaments (ABS, PLA, PETG, Nylon, CF-Nylon, PC, TPU, etc.) |
| `3d-printer-manufacturer-india-landing-page-redesign-65a2` | Landing page redesign for a 3D printer manufacturer in India |
| `brand-fracktal-80651f` | Fracktal brand design system |
| `hsn-code-gst-on-3d-printing-india-fe90` | HSN code & GST reference for 3D printing in India |

## Notes

- `.file-versions/` and `.od-skills/` directories are excluded from git — they are app internals regenerated on each machine
- `.artifact.json` files contain Open Design metadata and are safe to commit
- The `shared-projects/` folder lives alongside the Open Design source code but is independent — you can also use it with a pre-built Open Design release instead of running from source
