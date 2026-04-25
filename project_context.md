# Master Context Document: project.txt (v1.0)

## 1. Core Identity & Philosophy

* **App Name:** project.txt

* **Purpose:** A local, desktop-only GUI for planning projects and extracting actionable tasks into a master `todo.txt` ecosystem.

* **Methodology:** Strictly adheres to the Getting Things Done (GTD) Natural Planning Model and the Unix philosophy (do one thing well).

* **Separation of Concerns:** Project support material lives exclusively in `+projectName.md` files. Execution commitments live exclusively in `todo.txt`. They are visually unified but technically separate.

## 2. Tech Stack & Environment

* **Frontend:** React, Vite, Tailwind CSS.

* **State Management:** Zustand (for global states like `activeProject`, `rootDirectory`, and `theme`).

* **UI Components:** `shadcn/ui` (strictly minimalist, document-centric).

* **Iconography:** `lucide-react` strictly for all icons.

* **Command Palette:** `cmdk` for global fast navigation.

* **Backend/OS Layer:** Tauri v2 (Rust) with `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog`.

* **File System:** Local files only. Must use Rust's cross-platform `PathBuf`. Tauri `fs` scopes must be explicitly configured to allow external directory access.

## 3. Architecture & Code Standards

* **Strict File Topology:** UI components must be consolidated (e.g., `src/components/Editor.jsx`, `src/components/Sidebar.jsx`). Do not invent deep, fragmented folder trees.

* **Defensive Rust:** NEVER use `.unwrap()` or `panic!()`. Every Tauri command must return `Result<T, String>` to catch file I/O errors gracefully and pass them to the React frontend.

* **Strict JSON Data Contracts:** The React frontend expects exact, predictable JSON payloads from Rust (e.g., specific object shapes for parsed tasks and GTD metrics).

## 4. Aesthetics & Theming

* **Default Dark Mode:** The app strictly defaults to a **'Zinc' base dark mode** (`class="dark"` injected into the HTML root).

* **Lightweight Accent Colors:** The UI must support multiple highlight colors using standard Tailwind CSS HSL values (**Indigo** as default, plus **Emerald, Amber, Rose, and Sky**). This MUST be handled exclusively via CSS variables and data attributes (e.g., `data-theme="emerald"`) overriding shadcn's `--primary` variable. Do not use complex JS-based theming libraries.

## 5. Strict Data Integrity Rules (CRITICAL)

* **No Database/Hidden IDs:** Do NOT invent JSON schemas or inject hidden HTML/metadata tags into the text files for tracking.

* **Rust File Operations (Read vs. Write):** \* **READING:** Use a standard Rust crate (like `todo-txt` or `todotxt`) to parse the files safely.

  * **WRITING:** When transferring a task, ONLY use Rust's native "Append" mode (`OpenOptions::new().append(true)`). Never use a library to rewrite the entire `todo.txt` file.

* **Backup Rotation:** Before modifying any `.md` file, the app must create a `.bak` copy. Maintain a rolling limit of the 5 most recent backups per file (delete the oldest if a 6th is created).

* **Syntax Strictness:** Treat the official `todo.txt` formatting rules and Sleek extension rules (`t:`, `due:`) as the source of truth.

  * Priorities parsed via Regex: `^\([A-Z]\)`.

  * Threshold dates formatted as `t:YYYY-MM-DD`.

## 6. Visual Layout & Hierarchy

The UI uses `react-resizable-panels` to create a 2-pane IDE-style layout:

1. **Global Overlay:** A `cmdk` Command Palette triggered by `Cmd+K` to quickly search and jump to any `.md` file.

2. **Left Sidebar (Collapsible):** Navigation for `projects/`, `someday/`, and `archive/`. Contains a theme-selector and links to Stats Sheet.

3. **Main Column (Split Horizontally):**

   * *Top Pane (CodeMirror Editor):* The Markdown editor MUST be built using **CodeMirror 6**. It provides live WYSIWYG-like styling for headers/bold text while maintaining pure plain-text underneath. **It must implement a debounced autosave (using `lodash.debounce`)** so files are written to disk seamlessly without thrashing the CPU.

   * *Bottom Pane:* "Active Next Actions" container. Reads dynamically from `todo.txt`/`done.txt`, filtering for the current `+projectName` tag. **This pane is strictly read-only.**

## 7. Core Workflows & Mechanics

* **New Project Creation:** The Left Sidebar "New Project" button strictly enforces a `+` prefix (e.g., `+MyProject.md`).

* **The "Transfer" Flow:** User clicks a transfer icon next to a `- [ ]` in the editor. App prompts for Context (`@`) and Threshold Date (`t:`). It appends to `todo.txt` with the `+projectName` tag and securely deletes the exact line string from the Markdown file.

* **Strictly Read-Only Execution List:** Tasks in the bottom container CANNOT be edited, deleted, or sent back to the Markdown file.

* **Archiving Projects:** Moves the file to `archive/`. Triggers a warning modal if incomplete tasks containing `+projectName` exist in `todo.txt`.

* **Stats & Weekly Review Page:** A slide-out `Sheet` component displaying GTD metrics (Active Tasks, Snoozed Tasks, Actionless Projects, etc.). Metric definitions are strictly programmatic based on cross-referencing file existence and text strings.

## 8. App Initialization

* **First Run:** Prompts user to select Root Directory using Tauri v2 dialog API. Generates `projects/`, `someday/`, and `archive/` folders.

* **File Watcher:** Uses `notify` crate on a background thread to hot-reload React UI if `todo.txt` or `done.txt` is modified externally.

* **Done.txt Caching:** Loads `done.txt` into memory on launch to prevent lag during task filtering.