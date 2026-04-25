# Project.txt
<div align="center">
  <img src="./public/app-icon.png" alt="Project.txt Logo" width="128">
</div>

> A todo.txt-compatible project planner based on the GTD natural planning model.

## Overview

**Project.txt** bridges the gap between todo.txt-based task managers (such as Sleek), bringing plaintext productivity to the project level. The structure is based on the natural planning model found in David Allen's Getting Things Done (GTD) methodology. 

Built on top of the `todo.txt` standard, **Project.txt** allows mapping out project plans for `+projects` found in a `todo.txt` file.

## Features
* **Truly Local and Private:** No databases or complex IDs. Instead, project planning data sits in `.md` files, and `todo.txt` is only modified when extracting next actions from project plans.
* **Reactive File Watcher:** Changes made in external editors are instantly reflected in the **Project.txt** UI.
* **Clean Markdown Editor:** Live markdown scaling and syntax collapsing for clean reading. When typing, use markdown or the toolbar and either way, the markdown renders as soon as the cursor moves away.
* **Intelligent Task Transfer:** Extract action items from project notes, sending next actions to `todo.txt` with a single click, adding ISO creation date, +project tagging, @context.
* **System Review Metrics:** An analytics module provides task and project metrics useful for conducting a weekly review.
* **Built-in Data Integrity:** A backup rotation system creates rolling `.bak` files before any write operation, safeguarding against accidental deletions.

## Tech Stack
* **OS Layer:** [Tauri v2](https://tauri.app/) (Rust)
* **Runtime:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
* **Editor Core:** [CodeMirror 6](https://codemirror.net/)
* **State Management:** [Zustand](https://github.com/pmndrs/zustand)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
## Development Setup
If you want to clone the repository and run the app locally, ensure you have [Node.js](https://nodejs.org/) and [Rust](https://www.rust-lang.org/tools/install) installed.
1. **Clone the repository:**
   ```bash
   git clone https://github.com/mshuflin/project-txt.git
   cd project-txt

2. **Install frontend dependencies:**
   ```npm install

3. **Run the development server:**
    ```npm run tauri dev

## License
MIT License. See `LICENSE` for more information.