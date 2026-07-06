# DevEco Code Plugin for Obsidian

> Embed DevEco Code AI assistant directly in Obsidian — give your notes AI superpowers.


## Inspiration

This project is inspired by and borrows from the excellent [opencode-obsidian](https://github.com/mtymek/opencode-obsidian) project by [@mtymek](https://github.com/mtymek). The core idea of embedding an AI CLI assistant via WebView into Obsidian originated there. This plugin adapts that approach for the DevEco Code ecosystem.

## Use Cases

- Summarize and distill long-form content
- Draft, edit, and refine your writing
- Query and explore your knowledge base
- Generate outlines and structured notes
- ArkTS / HarmonyOS code assistance alongside your notes

## How It Works

This plugin embeds DevEco Code's web view directly into the Obsidian window. Rather than implementing a custom chat UI via the ACP protocol, it leverages the full power of DevEco Code's built-in interface — giving you the complete AI experience inside Obsidian.

## Requirements

- **Desktop only** (uses Node.js child processes)
- [DevEco Code CLI](https://developer.huawei.com/) installed
- [Bun](https://bun.sh/) installed

## Installation

### Via BRAT (Recommended for Beta Testing)

1. Install the **BRAT** plugin from Obsidian Community Plugins
2. Open BRAT settings → **Add Beta plugin**
3. Enter: `your-username/deveco-code-obsidian`
4. Click **Add Plugin** — BRAT will install the latest release automatically
5. Enable the plugin in **Obsidian Settings → Community Plugins**

BRAT will automatically check for updates and notify you when new versions are available.

### For Developers

```bash
# Clone into your vault's plugins directory
git clone https://github.com/your-username/deveco-code-obsidian.git .obsidian/plugins/deveco-code-obsidian

# Install dependencies and build
bun install && bun run build
```

Then enable the plugin in **Obsidian Settings → Community Plugins**.

Add an `AGENTS.md` file to your workspace root to guide the AI assistant's behavior.

## Usage

- Click the **DevEco icon** in the ribbon, or
- Press `Cmd/Ctrl+Shift+D` to toggle the panel
- The server starts automatically when you open the panel

## Settings

### Custom Command Mode

Enable **"Use custom command"** when you need more control over how DevEco Code starts — for example, to add extra CLI flags, use a custom wrapper script, or run it through a container/virtual environment.

When using a custom command:

- **Hostname** and **port** must match the values in the Port and Hostname fields above
- You **must** include `--cors app://obsidian.md` to allow Obsidian to embed the interface

Example:

```bash
deveco-code serve --port 14096 --hostname 127.0.0.1 --cors app://obsidian.md
```

### Other Settings

| Setting | Description |
|---|---|
| Port | Server port (default: `14096`) |
| Hostname | Server hostname (default: `127.0.0.1`) |
| Auto-start | Start server on Obsidian launch |
| View location | Panel position (left/right/center) |
| Context injection | Inject open notes & selected text into AI context |

### Context Injection (Experimental)

This plugin can automatically inject context into the running DevEco Code instance: a list of open notes and currently selected text.

> ⚠️ This is a work-in-progress feature with some limitations — it won't work when creating a new session from the DevEco Code interface.

## Windows Troubleshooting

If you see **"Executable not found at 'deveco-code'"** despite having it installed:

1. Find the full path:

```powershell
where.exe deveco-code.cmd
```

2. Configure the full path in plugin settings, e.g.:

```
C:\Users\{username}\AppData\Roaming\npm\deveco-code.cmd
```

This is due to Electron/Obsidian not fully inheriting `PATH` on Windows.

## Acknowledgements

- [opencode-obsidian](https://github.com/mtymek/opencode-obsidian) — the original inspiration for this project
- [Obsidian](https://obsidian.md/) — the note-taking app
- [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/) — Huawei's developer tools

## License

MIT
