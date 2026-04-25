import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useStore } from '../store';
import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { openUrl as open } from '@tauri-apps/plugin-opener';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { EditorView, Decoration, WidgetType, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import debounce from 'lodash.debounce';
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, ArrowRight, Plus, FolderGit2, FolderKanban, Archive, Clock, RotateCcw, ChevronDown, Bold, Italic, Heading1, Heading2, List, CheckSquare, ListOrdered, Link, BrainCircuit, BookOpen } from "lucide-react"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet"

const NATURAL_PLANNING_TEMPLATE = `Review this checklist when creating a project. This ensures that the project will align more closely with my Purpose, Vision, and Goals.

---

## Purpose/Guiding Principles
- Why is this being done? What would “on purpose” really mean?
- What are the key standards to hold in making decisions and acting on this project? What rules do we play by?
\`The purpose and principles are the guiding criteria for making decisions on the project.\`

## Mission/Vision/Goal/Successful Outcome
- What would it be like if it were totally successful? How would I know?
- What would that success look or feel like for each of the parties with an interest?

## Brainstorming
- What are all the things that occur to me about this? What is the current reality? What do I know? What do I not know? What ought I consider? What haven’t I considered?
- Review the Project Planning Trigger List
- Be complete, open, nonjudgmental, and resist critical analysis.
- View from all sides.

## Organizing
- Identify components (subprojects), sequences, and/or priorities.
- What needs to happen to make the whole thing happen?
- Create outlines, bulleted lists, or organizing charts, as needed for review and control.

## Next Actions (transfer these to your todo.txt)
- Determine next actions on current independent components. (What should be done next, and who will do it?)
- If more planning is required, determine the next action to get that to happen.

## Tips
- Shift the level of focus on the project as follows if needed:
  - If your project needs more clarity, raise the level of your focus.
  - If your projects needs more to be happening, lower the level of your focus.
- How much planning is required?
  - If the project is off your mind, planning is sufficient.
  - If it’s still on your mind, then more is needed.`;

// Custom HighlightStyle for Markdown Scaling & Marking (CM6 Native)
const markdownHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontWeight: 'bold', fontSize: '1.6em', color: 'hsl(var(--primary))' },
  { tag: t.heading2, fontWeight: 'bold', fontSize: '1.4em', color: 'hsl(var(--primary))' },
  { tag: t.heading3, fontWeight: 'bold', fontSize: '1.2em' },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: [t.punctuation, t.bracket, t.paren, t.processingInstruction], class: "md-mark" },
  { tag: t.url, class: "md-url" },
  { tag: t.link, class: "md-link" },
  { 
    tag: t.monospace, 
    fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace", 
    backgroundColor: "hsl(var(--muted))", 
    padding: "0.2em 0.4em", 
    borderRadius: "6px", 
    fontSize: "0.85em", 
    color: "hsl(var(--primary))",
    border: "1px solid hsl(var(--border) / 0.5)"
  }
]);

// Custom theme that maps to our Tailwind/shadcn CSS variables
const zincTheme = EditorView.theme(
  {
    '&': {
      fontFamily: 'inherit',
      color: 'hsl(var(--foreground))',
      backgroundColor: 'hsl(var(--background))',
      fontSize: '14px',
      height: '100%',
    },
    '.cm-content': {
      fontFamily: "'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'",
      fontSize: '15px',
      fontVariantLigatures: 'none',
      letterSpacing: '-0.011em',
      caretColor: 'hsl(var(--primary))',
      padding: '24px 32px',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'hsl(var(--primary))',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'hsl(var(--accent))',
    },
    '.cm-panels': {
      backgroundColor: 'hsl(var(--muted))',
      color: 'hsl(var(--foreground))',
    },
    '.cm-activeLine': {
      backgroundColor: 'hsl(var(--muted) / 0.3)',
    },
    '.cm-gutters': {
      backgroundColor: 'hsl(var(--background))',
      color: 'hsl(var(--muted-foreground))',
      border: 'none',
      paddingLeft: '32px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'hsl(var(--muted) / 0.3)',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'hsl(var(--muted))',
      color: 'hsl(var(--muted-foreground))',
      border: 'none',
    },
    '.cm-tooltip': {
      backgroundColor: 'hsl(var(--popover))',
      color: 'hsl(var(--popover-foreground))',
      border: '1px solid hsl(var(--border))',
    },
    '.cm-line': {
      fontFamily: 'inherit',
    },
    '.md-link': {
      color: 'hsl(var(--primary))',
      textDecoration: 'underline',
      cursor: 'pointer'
    },
    '.cm-tooltip .cm-tooltip-arrow:before': {
      borderTopColor: 'hsl(var(--border))',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: 'hsl(var(--accent))',
        color: 'hsl(var(--accent-foreground))',
      },
    },
    '.cm-scroller': {
      overflow: 'auto',
    },

    // Force visibility for checkboxes despite the punctuation hiding rule
    '.cm-task-marker': {
      opacity: '1 !important',
    },
    '.cm-link': {
      color: 'hsl(var(--primary)) !important',
      textDecoration: 'underline !important',
      cursor: 'pointer !important',
    },
  },
  { dark: true }
);

// Minimalist base theme for layout-specific overrides
const markdownStyles = EditorView.baseTheme({
  '.cm-strong': {
    fontWeight: '700',
  },
  '.cm-emphasis': {
    fontStyle: 'italic',
  },
  '.cm-link, .cm-url': {
    color: 'hsl(var(--primary))',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  '.cm-transfer-btn': {
    verticalAlign: 'middle',
  }
});

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.textContent = "•";
    // Optionally color it to match your theme's links/primary color
    span.style.color = "var(--primary, inherit)"; 
    span.style.fontWeight = "bold";
    return span;
  }
  eq(other) { return true; }
}

class HRWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement("div");
    hr.style.width = "100%";
    hr.style.height = "2px";
    hr.style.backgroundColor = "hsl(var(--primary))";
    hr.style.margin = "12px 0";
    hr.style.opacity = "0.8";
    return hr;
  }
  eq(other) { return true; }
}

class CheckboxWidget extends WidgetType {
  constructor(checked, from, to) {
    super();
    this.checked = checked;
    this.from = from;
    this.to = to;
  }
  
  eq(other) {
    return this.checked === other.checked && this.from === other.from;
  }

  toDOM(view) {
    const box = document.createElement("span");
    box.style.display = "inline-flex";
    box.style.alignItems = "center";
    box.style.justifyContent = "center";
    box.style.width = "16px";
    box.style.height = "16px";
    box.style.borderRadius = "4px";
    box.style.border = "1.5px solid hsl(var(--primary) / 0.5)";
    box.style.cursor = "pointer";
    box.style.transition = "all 0.1s ease";
    box.style.flexShrink = "0";
    box.style.verticalAlign = "middle";
    box.style.marginRight = "6px";

    if (this.checked) {
      box.style.backgroundColor = "hsl(var(--primary))";
      box.style.borderColor = "hsl(var(--primary))";
      // SVG checkmark
      box.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polyline points="1.5,5 4,7.5 8.5,2" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    } else {
      box.style.backgroundColor = "transparent";
    }

    box.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const newText = this.checked ? "- [ ]" : "- [x]";
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: newText },
      });
    });

    return box;
  }

  ignoreEvent(e) {
    return e.type === "mousedown";
  }
}

const livePreviewPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = this.getDecorations(view);
  }
  update(update) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.getDecorations(update.view);
    }
  }
  getDecorations(view) {
    let marks = [];
    let activeLine = view.state.doc.lineAt(view.state.selection.main.head).number;
    // Track lines that have a rendered checkbox so BulletWidget skips them
    const taskLines = new Set();

    // First pass: detect task checkboxes with a regex and render CheckboxWidgets
    for (let { from, to } of view.visibleRanges) {
      let pos = from;
      while (pos <= to) {
        const line = view.state.doc.lineAt(pos);
        if (line.number !== activeLine) {
          const taskMatch = line.text.match(/^(\s*-\s+)(\[([ xX])\])/);
          if (taskMatch) {
            const checked = taskMatch[3].toLowerCase() === 'x';
            // from/to for the whole `- [ ]` or `- [x]` prefix
            const checkboxFrom = line.from;
            const checkboxTo = line.from + taskMatch[1].length + taskMatch[2].length;
            marks.push(
              Decoration.replace({
                widget: new CheckboxWidget(checked, checkboxFrom, checkboxTo),
                inclusive: false,
              }).range(checkboxFrom, checkboxTo)
            );
            taskLines.add(line.number);
          }
        }
        pos = line.to + 1;
      }
    }

    // Second pass: syntax tree decorations (bullets, HR, formatting marks)
    for (let { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from, to,
        enter: (node) => {
          let nodeLine = view.state.doc.lineAt(node.from).number;
          
          // Only process if we are NOT on the active line
          if (nodeLine !== activeLine) {
            if (node.name === "ListMark") {
              // Skip bullet replacement if this line already has a checkbox
              if (!taskLines.has(nodeLine)) {
                marks.push(Decoration.replace({ 
                  widget: new BulletWidget(),
                  inclusive: false 
                }).range(node.from, node.to));
              }
            } 
            else if (node.name === "HorizontalRule") {
              marks.push(Decoration.replace({ 
                widget: new HRWidget(),
                inclusive: false 
              }).range(node.from, node.to));
            }
            else if (["HeaderMark", "LinkMark", "URL", "EmphasisMark", "StrongMark", "CodeMark"].includes(node.name)) {
              // Replace with an empty decoration to completely collapse it
              marks.push(Decoration.replace({}).range(node.from, node.to));
            }
          }
        }
      });
    }

    return Decoration.set(marks, true);
  }
}, {
  decorations: v => v.decorations
});

const linkClickHandler = EditorView.domEventHandlers({
  click: async (event, view) => {
    if (event.metaKey || event.ctrlKey) {
      const pos = view.posAtDOM(event.target);
      const node = syntaxTree(view.state).resolveInner(pos, 1);
      
      let linkNode = node;
      while (linkNode && linkNode.name !== "Link" && linkNode.name !== "Document") {
        linkNode = linkNode.parent;
      }
      
      if (linkNode && linkNode.name === "Link") {
        const urlNode = linkNode.getChild("URL");
        
        if (urlNode) {
          let url = view.state.doc.sliceString(urlNode.from, urlNode.to);
          
          // Clean up parens if they got accidentally captured
          url = url.replace(/^[\(\)]+|[\(\)]+$/g, '');
          
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }
          
          // Use Tauri's native shell open instead of window.open
          await open(url); 
          
          event.preventDefault();
          return true;
        }
      }
    }
    return false;
  }
});

class TransferWidget extends WidgetType {
  constructor(lineText, pos, onClick) {
    super();
    this.lineText = lineText;
    this.pos = pos;
    this.onClick = onClick;
  }
  
  eq(other) {
    return this.lineText === other.lineText && this.pos === other.pos;
  }

  toDOM(view) {
    let btn = document.createElement("button");
    btn.className = "cm-transfer-btn ml-2 inline-flex items-center justify-center w-5 h-4 rounded bg-primary/20 text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer text-[10px] border-none outline-none";
    btn.title = "Extract Next Action";
    
    // Render the Lucide icon using React
    const root = createRoot(btn);
    root.render(<ArrowRight className="w-3.5 h-3.5" />);

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Get exact viewport coordinates for the line/pos
      const rect = view.coordsAtPos(this.pos);
      this.onClick(this.lineText, rect);
    };
    return btn;
  }
  ignoreEvent() { return true; }
}

function TransferPopover({ lineText, anchorRect, activeProject, onClose, onConfirm }) {
  const tasks = useStore((state) => state.tasks);
  const contexts = useMemo(() => {
    const all = tasks
      .filter(t => !t.completed)
      .flatMap(t => t.contexts || []);
    return Array.from(new Set(all)).sort();
  }, [tasks]);

  const [selectedContext, setSelectedContext] = useState("");
  const [thresholdDate, setThresholdDate] = useState("");
  const [inputValue, setInputValue] = useState("");

  const formattedInput = inputValue.startsWith('@') ? inputValue : `@${inputValue}`;
  const showCreate = inputValue.trim() && !contexts.includes(formattedInput);

  const virtualRef = useMemo(() => ({
    current: anchorRect ? {
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        top: anchorRect.top,
        left: anchorRect.left,
        right: anchorRect.left,
        bottom: anchorRect.top,
      })
    } : null
  }), [anchorRect]);

  const handleConfirm = () => {
    // 1. Get today's date YYYY-MM-DD
    const today = new Date().toISOString().split("T")[0];
    
    // 2. Strip the "- [ ]" prefix
    let cleanText = lineText ? lineText.replace(/^\s*-\s+\[\s+\]\s*/, "").trim() : "";
    
    // 3. Ensure projectName from filename is treated as a +projectTag (extract filename only)
    const baseName = activeProject ? activeProject.split("/").pop().replace(".md", "") : "";
    const projectTag = baseName.startsWith("+") ? baseName : `+${baseName}`;
    
    // 4. Assemble: Date Text +ProjectName @context t:date
    const assembled = `${today} ${cleanText} ${projectTag} ${selectedContext} ${thresholdDate ? `t:${thresholdDate}` : ""}`.replace(/\s+/g, " ").trim();

    onConfirm(assembled, lineText);
  };

  return (
    <Popover open={!!anchorRect} onOpenChange={(open) => !open && onClose()}>
      <PopoverPrimitive.Anchor virtualRef={virtualRef} />
      <PopoverContent align="start" side="right" sideOffset={10} className="w-64 p-3 gap-3 flex flex-col shadow-xl border-primary/20">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold tracking-wide text-muted-foreground px-1 flex items-center justify-between">
            Context (@)
            {selectedContext && <span className="text-primary normal-case font-normal">{selectedContext}</span>}
          </label>
          <Command className="rounded-lg border shadow-none bg-muted/5">
            <CommandInput 
              placeholder="Search contexts..." 
              className="h-8 py-0" 
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList className="max-h-32 scrollbar-hide">
              <CommandEmpty>No context found.</CommandEmpty>
              <CommandGroup>
                {contexts.map(ctx => (
                  <CommandItem
                    key={ctx}
                    onSelect={() => setSelectedContext(ctx === selectedContext ? "" : ctx)}
                    className="text-xs py-1"
                  >
                    <Check className={cn("mr-1 h-3 w-3 text-primary", selectedContext === ctx ? "opacity-100" : "opacity-0")} />
                    {ctx}
                  </CommandItem>
                ))}
              </CommandGroup>
              {showCreate && (
                <>
                  <CommandSeparator className="opacity-50" />
                  <CommandGroup>
                    <CommandItem
                      value={inputValue}
                      onSelect={() => {
                        setSelectedContext(formattedInput);
                        setInputValue("");
                      }}
                      className="text-xs py-1 text-primary italic font-medium"
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Create "{inputValue}"
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold tracking-wide text-muted-foreground px-1">Threshold (t:)</label>
          <Input 
            type="date" 
            className="h-8 text-xs bg-muted/5 border-border/50 focus-visible:ring-primary/30" 
            value={thresholdDate}
            onChange={(e) => setThresholdDate(e.target.value)}
          />
        </div>

        <Button size="sm" className="h-8 text-xs gap-2 font-semibold shadow-sm" onClick={handleConfirm}>
          <ArrowRight className="w-3 h-3" />
          Confirm Transfer
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function Editor() {
  const editorRef = useRef(null);
  const rootDirectory = useStore((state) => state.rootDirectory);
  const activeProject = useStore((state) => state.activeProject);

  const [content, setContent] = useState('');
  const [filePath, setFilePath] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // '', 'saving', 'saved', 'error'
  
  const [activeTransferLine, setActiveTransferLine] = useState(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const [showArchiveAlert, setShowArchiveAlert] = useState(false);
  const getProjectFolder = useStore((state) => state.getProjectFolder);
  const currentFolder = useStore((state) => state.getProjectFolder(activeProject));
  const isMovingFile = useStore((state) => state.isMovingFile);
  const moveActiveProject = useStore((state) => state.moveActiveProject);
  const generateProjectList = useStore((state) => state.generateProjectList);

  // Build file path and load content ONLY when project or root changes
  useEffect(() => {
    let isMounted = true;

    async function loadFile() {
      if (!rootDirectory || !activeProject) {
        if (isMounted) {
          setContent('');
          setFilePath(null);
        }
        return;
      }

      setLoading(true);
      setSaveStatus('');

      try {
        const fullPath = await join(rootDirectory, activeProject);
        if (isMounted) setFilePath(fullPath);

        const fileContent = await invoke('read_file', { path: fullPath });
        if (isMounted) setContent(fileContent);
      } catch (err) {
        console.error('Failed to load file:', err);
        if (isMounted) {
          setContent('');
          setFilePath(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFile();
    return () => { isMounted = false; };
  }, [rootDirectory, activeProject]);

  const sanitizedProjectName = useMemo(() => {
    if (!activeProject) return '';
    const fileName = activeProject.split('/').pop().replace('.md', '');
    return fileName.startsWith('+') ? fileName : '+' + fileName;
  }, [activeProject]);

  const handleMoveRequest = async (target) => {
    if (target === 'archive') {
      try {
        const hasTasks = await invoke('check_active_tasks', { 
          rootDir: rootDirectory, 
          projectTag: sanitizedProjectName 
        });

        if (hasTasks) {
          setShowArchiveAlert(true);
        } else {
          await executeMove('archive');
        }
      } catch (err) {
        console.error('Failed to check active tasks:', err);
      }
    } else {
      await executeMove(target);
    }
  };

  const executeMove = async (target) => {
    try {
      const newPath = await invoke('move_project_file', { 
        rootDir: rootDirectory, 
        currentRelativePath: activeProject,
        targetSubfolder: target
      });
      // Atomic swap of project path with global movement guard
      moveActiveProject(newPath);
      setShowArchiveAlert(false);
    } catch (err) {
      console.error('Failed to move project:', err);
      if (typeof err === 'string' && err.includes('exists')) {
         alert(err);
      }
    }
  };

  // Debounced save function — 1000ms delay
  const debouncedSave = useMemo(() => {
    return debounce(async (path, newContent) => {
      // Access store state directly to get the latest movement guard
      const { isMovingFile } = useStore.getState();
      if (isMovingFile || !path) return;

      setSaveStatus('saving');
      try {
        await invoke('save_file', { path, content: newContent });
        setSaveStatus('saved');
        generateProjectList();
        // Clear "saved" indicator after 2 seconds
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveStatus('error');
      }
    }, 1000);
  }, []);

  const handleTaskTransfer = useCallback(async (assembled, originalLine) => {
    if (!filePath || !rootDirectory) return;

    try {
      await invoke('transfer_task', {
        taskStr: assembled,
        filePath: filePath,
        lineToRemove: originalLine,
        rootDir: rootDirectory
      });

      // Update local state: remove the line
      // Note: we take the first instance to match backend replacen
      setContent(prev => prev.replace(originalLine, '').replace(/\n\n+/, '\n'));
      
      // Close popover
      setActiveTransferLine(null);
      setAnchorRect(null);

    } catch (err) {
      console.error('Transfer failed:', err);
      // Optional: User feedback UI
    }
  }, [filePath, rootDirectory]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  // onChange handler for CodeMirror
  const handleChange = useCallback(
    (value) => {
      setContent(value);
      if (filePath) {
        debouncedSave(filePath, value);
      }
    },
    [filePath, debouncedSave]
  );

  const applyFormat = useCallback((type) => {
    const view = editorRef.current;
    if (!view) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const selectedText = state.doc.sliceString(from, to);

    let transaction;

    switch (type) {
      case 'bold':
        transaction = {
          changes: { from, to, insert: `**${selectedText}**` },
          selection: { anchor: from + 2, head: to + 2 }
        };
        break;
      case 'italic':
        transaction = {
          changes: { from, to, insert: `*${selectedText}*` },
          selection: { anchor: from + 1, head: to + 1 }
        };
        break;
      case 'h1':
      case 'h2':
      case 'list':
      case 'todo':
        // Line-based formatting
        const line = state.doc.lineAt(from);
        const prefix = type === 'h1' ? '# ' : type === 'h2' ? '## ' : type === 'list' ? '- ' : '- [ ] ';
        transaction = {
          changes: { from: line.from, to: line.from, insert: prefix },
          selection: { anchor: from + prefix.length, head: to + prefix.length }
        };
        break;
      case 'ordered-list':
        const lineOrdered = state.doc.lineAt(from);
        transaction = {
          changes: { from: lineOrdered.from, to: lineOrdered.from, insert: "1. " },
          selection: { anchor: from + 3, head: to + 3 }
        };
        break;
      case 'link':
        const insertText = selectedText || "text";
        transaction = {
          changes: { from, to, insert: `[${insertText}](url)` },
          selection: { 
            anchor: from + (selectedText ? insertText.length + 3 : 1), 
            head: from + (selectedText ? insertText.length + 6 : 1 + insertText.length) 
          }
        };
        break;
      case 'template':
        transaction = {
          changes: { from: state.selection.main.head, insert: `\n\n${NATURAL_PLANNING_TEMPLATE}\n\n` },
          selection: { anchor: state.selection.main.head + NATURAL_PLANNING_TEMPLATE.length + 4 }
        };
        break;
      default:
        return;
    }

    if (transaction) {
      view.dispatch(transaction);
      view.focus();
    }
  }, []);

  const transferExtension = useMemo(() => {
    return EditorView.decorations.of((view) => {
      let builder = new RangeSetBuilder();
      for (let { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to; ) {
          let line = view.state.doc.lineAt(pos);
          const todoMatch = line.text.match(/^\s*-\s+\[\s+\]/);
          if (todoMatch) {
            const widgetPos = line.from + todoMatch[0].length;
            builder.add(
              widgetPos,
              widgetPos,
              Decoration.widget({
              widget: new TransferWidget(line.text, widgetPos, (text, rect) => {
                  setActiveTransferLine(text);
                  setAnchorRect(rect);
                }),
                side: 1,
              })
            );
          }
          pos = line.to + 1;
        }
      }
      return builder.finish();
    });
  }, []);

  if (!activeProject) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground bg-muted/5 animate-in fade-in duration-500">
        <FolderGit2 className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm font-medium opacity-60">Select or create a project to start editing</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm italic">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/10">
        <span className="text-3xl font-bold tracking-tight text-primary truncate">
          {activeProject.split('/').pop().replace('.md', '')}
        </span>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground italic">
            {saveStatus === 'saving' && '● Saving...'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && '⚠ Save Error'}
          </span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 gap-2 text-muted-foreground opacity-40 hover:opacity-100 hover:bg-accent transition-all group"
              >
                <FolderGit2 className="h-4 w-4" />
                <span className="text-xs font-semibold tracking-wide capitalize">{currentFolder || 'unknown'}</span>
                <ChevronDown className="h-3 w-3 opacity-50 group-data-[state=open]:rotate-180 transition-transform" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-border/50 shadow-xl backdrop-blur-xl">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground/60 tracking-wide">
                Move Project To
              </div>
              
              {currentFolder !== 'projects' && (
                <DropdownMenuItem onClick={() => handleMoveRequest('projects')} className="gap-2 focus:bg-primary/10 focus:text-primary">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                    <FolderKanban className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">Projects</span>
                  </div>
                </DropdownMenuItem>
              )}
              
              {currentFolder !== 'someday' && (
                <DropdownMenuItem onClick={() => handleMoveRequest('someday')} className="gap-2 focus:bg-muted focus:text-muted-foreground">
                  <div className="w-8 h-8 rounded bg-muted/30 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">Someday</span>
                  </div>
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator className="bg-border/50" />
              
              {currentFolder !== 'archive' && (
                <DropdownMenuItem onClick={() => handleMoveRequest('archive')} className="gap-2 focus:bg-muted focus:text-muted-foreground">
                  <div className="w-8 h-8 rounded bg-muted/30 flex items-center justify-center">
                    <Archive className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">Archive</span>
                  </div>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={showArchiveAlert} onOpenChange={setShowArchiveAlert}>
        <AlertDialogContent className="max-w-md border-border/50 shadow-2xl backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-destructive" />
              Active Tasks Found
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground/90">
              The project <span className="font-bold text-foreground text-primary">{sanitizedProjectName}</span> still has active tasks in your todo.txt.<br /><br />Are you sure you want to move this project to the archive? Tasks will remain in your todo.txt, resulting in a zombie project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/50">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => executeMove('archive')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-primary/20 bg-muted/5">
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => applyFormat('bold')} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => applyFormat('italic')} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border/50 mx-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => applyFormat('h1')} title="Heading 1">
          <Heading1 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => applyFormat('h2')} title="Heading 2">
          <Heading2 className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border/50 mx-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => applyFormat('list')} title="Bulleted List">
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => applyFormat('todo')} title="Task List">
          <CheckSquare className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border/50 mx-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => applyFormat('ordered-list')} title="Numbered List">
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => applyFormat('link')} title="Insert Link">
          <Link className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border/50 mx-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => applyFormat('template')} title="Natural Planning Model Template">
          <BrainCircuit className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* CodeMirror editor */}
      <div className="flex-1 overflow-auto relative" key={activeProject}>
        <CodeMirror
          value={content}
          onCreateEditor={(view) => { editorRef.current = view; }}
          onChange={handleChange}
          extensions={[
            markdown(), 
            zincTheme, 
            markdownStyles, 
            transferExtension,
            linkClickHandler,
            syntaxHighlighting(markdownHighlightStyle),
            EditorView.lineWrapping,
            livePreviewPlugin
          ]}
          theme="none"
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
          }}
          className="h-full"
          height="100%"
        />

        <TransferPopover 
          lineText={activeTransferLine} 
          anchorRect={anchorRect} 
          activeProject={activeProject}
          onClose={() => {
            setActiveTransferLine(null);
            setAnchorRect(null);
          }}
          onConfirm={handleTaskTransfer}
        />
      </div>
    </div>
  );
}
