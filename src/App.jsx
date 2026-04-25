import { useState, useEffect } from 'react';
import { useStore } from './store';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open, message } from '@tauri-apps/plugin-dialog';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { ActionList } from './components/ActionList';
import { CommandPalette } from './components/CommandPalette';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

function App() {
  const rootDirectory = useStore((state) => state.rootDirectory);
  const setRootDirectory = useStore((state) => state.setRootDirectory);
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const activeProject = useStore((state) => state.activeProject);
  const setTasks = useStore((state) => state.setTasks);
  const fetchProjects = useStore((state) => state.fetchProjects);
  const initializeWatcher = useStore((state) => state.initializeWatcher);
  const [isInitializing, setIsInitializing] = useState(true);

  // Load persisted root directory on startup
  useEffect(() => {
    async function loadSavedDirectory() {
      const savedPath = localStorage.getItem('project-root-dir');
      const savedTheme = localStorage.getItem('project-theme-color');
      
      if (savedTheme) {
        setTheme(savedTheme);
      }

      if (savedPath) {
        try {
          const exists = await invoke('check_todo_exists', { path: savedPath });
          if (exists) {
            setRootDirectory(savedPath);
          } else {
            console.warn('[STORAGE] Saved path no longer valid. Clearing.');
            localStorage.removeItem('project-root-dir');
          }
        } catch (err) {
          console.error('[STORAGE] Failed to validate saved directory:', err);
          localStorage.removeItem('project-root-dir');
        }
      }
      setIsInitializing(false);
    }
    loadSavedDirectory();
  }, [setRootDirectory]);

  // Fetch active tasks from todo.txt when rootDirectory is set
  useEffect(() => {
    async function loadTasks() {
      if (!rootDirectory) return;

      try {
        const tasks = await invoke('fetch_active_tasks', { rootDir: rootDirectory });
        setTasks(tasks);
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
        setTasks([]);
      }
    }

    loadTasks();
  }, [rootDirectory, setTasks]);

  // Set up file watcher and event listener
  useEffect(() => {
    let unlistenFn;
    
    async function setupWatcher() {
      if (!rootDirectory) return;
      
      try {
        // Start the backend watcher
        await invoke('start_file_watcher', { rootDir: rootDirectory });
        
        // Listen for updates from the backend
        unlistenFn = await listen('tasks-updated', async () => {
          const tasks = await invoke('fetch_active_tasks', { rootDir: rootDirectory });
          setTasks(tasks);
        });
      } catch (err) {
        console.error('Failed to setup file watcher:', err);
      }
    }

    setupWatcher();

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [rootDirectory, setTasks]);

  // Initialize projects and store-based watcher
  useEffect(() => {
    let unlisten;
    if (rootDirectory) {
      fetchProjects();
      initializeWatcher().then(fn => unlisten = fn);
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, [rootDirectory, fetchProjects, initializeWatcher]);

  useEffect(() => {
    // If we have a theme other than default, set it
    if (theme && theme !== 'default') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  useEffect(() => {
    async function selectRootDirectory() {
      try {
        const selectedPath = await open({
          directory: true,
          multiple: false,
          title: 'Select Project Root Directory',
        });
        
        if (selectedPath) {
          const exists = await invoke('check_todo_exists', { path: selectedPath });
          if (!exists) {
            await message('The selected directory must contain a todo.txt file.', { title: 'Invalid Directory', kind: 'error' });
            setRootDirectory(null);
          } else {
            setRootDirectory(selectedPath);
          }
        }
      } catch (err) {
        console.error('Failed to open dialog:', err);
      }
    }

    if (!rootDirectory && !isInitializing) {
      selectRootDirectory();
    }
  }, [rootDirectory, setRootDirectory, isInitializing]);

  if (!rootDirectory) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center p-8 text-center bg-background text-foreground">
        <h1 className="text-4xl font-bold mb-4">Project.txt</h1>
        <div className="p-6 border border-border rounded-lg bg-card text-card-foreground shadow-sm">
          <h2 className="text-xl font-semibold mb-2">No Directory Selected</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Please select your workspace directory to begin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden flex-col bg-black text-foreground">
      {/* Custom Title Bar */}
      <div 
        className="fixed top-0 left-0 right-0 h-7 bg-black flex items-center pl-20 z-[9999] border-b border-border/10 select-none cursor-default" 
        data-tauri-drag-region
      >
        <span className="text-xs font-semibold text-muted-foreground/60 pointer-events-none" data-tauri-drag-region>
          project.txt
        </span>
      </div>

      {/* Main Content Area - offset by title bar height */}
      <div className="flex flex-1 overflow-hidden mt-7 relative z-0">
        <CommandPalette />
        <ResizablePanelGroup orientation="horizontal" className="w-full h-full rounded-none">
          
          {/* Left Sidebar */}
          <ResizablePanel defaultSize="20%" minSize="15%" maxSize="40%" className="bg-muted/10">
            <Sidebar />
          </ResizablePanel>
          
          <ResizableHandle className="flex w-1.5 items-center justify-center bg-transparent">
            <div className="h-full w-[1px] bg-border/20" />
          </ResizableHandle>
          
          {/* Main Column */}
          <ResizablePanel defaultSize="80%">
            <ResizablePanelGroup orientation="vertical">
              
              {/* Top Pane: Editor */}
              <ResizablePanel defaultSize="70%" className="bg-background">
                <Editor />
              </ResizablePanel>
              
              <ResizableHandle className="flex h-1.5 w-full items-center justify-center bg-transparent">
                <div className="w-full h-[1px] bg-border/20" />
              </ResizableHandle>
              
              {/* Bottom Pane: ActionList */}
              <ResizablePanel defaultSize="30%" className="bg-muted/10 border-t border-border/50">
                <ActionList />
              </ResizablePanel>
              
            </ResizablePanelGroup>
          </ResizablePanel>
          
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export default App;
