import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

let projectsDebounceTimer;

export const useStore = create((set, get) => ({
  rootDirectory: null,
  activeProject: null,
  theme: 'default',
  tasks: [],
  projects: [],
  masterProjectList: [],
  isLoadingProjects: false,
  isMovingFile: false,
  
  isStatsOpen: false,
  isNewProjectDialogOpen: false,
  newProjectName: '',
  isCommandPaletteOpen: false,
  
  setRootDirectory: (dir) => {
    if (dir) {
      localStorage.setItem('project-root-dir', dir);
    }
    set({ rootDirectory: dir });
  },
  setActiveProject: (project) => set({ activeProject: project }),
  setTheme: (theme) => {
    localStorage.setItem('project-theme-color', theme);
    set({ theme });
  },
  setTasks: (tasks) => set({ tasks }),
  setProjects: (projects) => set({ projects }),
  setIsLoadingProjects: (loading) => set({ isLoadingProjects: loading }),
  setStatsOpen: (open) => set({ isStatsOpen: open }),
  setNewProjectDialogOpen: (open) => set({ isNewProjectDialogOpen: open }),
  setNewProjectName: (name) => set({ newProjectName: name }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setMasterProjectList: (list) => set({ masterProjectList: list }),
  
  openNewProjectDialog: (initialName = '') => set({ 
    isNewProjectDialogOpen: true, 
    newProjectName: initialName.startsWith('+') ? initialName.slice(1) : initialName 
  }),
  
  moveActiveProject: (newPath) => {
    // Atomic update to new path and start of movement guard
    set({ isMovingFile: true, activeProject: newPath });
    
    // Safety timeout: Reset flag and refresh sidebar after the dust settles
    setTimeout(() => {
      set({ isMovingFile: false });
      // Call fetchProjects to ensure sidebar reflects the move
      get().fetchProjects();
    }, 500);
  },

  getProjectFolder: (path) => {
    if (!path) return null;
    if (path.startsWith('projects/')) return 'projects';
    if (path.startsWith('archive/')) return 'archive';
    if (path.startsWith('someday/')) return 'someday';
    return 'root';
  },

  fetchProjects: async () => {
    const root = get().rootDirectory;
    if (!root) return;
    
    set({ isLoadingProjects: true });
    try {
      const filenames = await invoke('list_projects', { rootDir: root });
      const sorted = filenames.sort((a, b) => a.localeCompare(b));
      set({ projects: sorted });

      // Kill-switch: if activeProject is gone, unset it
      const { activeProject, isMovingFile } = get();
      if (!isMovingFile && activeProject && !sorted.includes(activeProject)) {
        console.warn(`[KILL-SWITCH] Project ${activeProject} moved or deleted. Closing editor.`);
        set({ activeProject: null });
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      set({ isLoadingProjects: false });
      // Refresh the master project list whenever projects are fetched/updated
      get().generateProjectList();
    }
  },

  generateProjectList: async () => {
    const { projects, rootDirectory } = get();
    if (!rootDirectory || projects.length === 0) {
      return;
    }

    try {
      
      const projectEntries = await Promise.all(projects.map(async (filename) => {
        // Only process .md files in the projects/ directory for the master list
        if (!filename.startsWith('projects/') || !filename.endsWith('.md')) return null;

        try {
          const content = await invoke('read_project', { 
            rootDir: rootDirectory, 
            filename: filename 
          });
          
          let outcome = "";
          const lines = content.split(/\r?\n/);

          for (let line of lines) {
            line = line.trim(); // Cleans up invisible characters/spaces
            if (line.startsWith("##")) continue; // Hard skip H2, H3, etc.
            
            if (line.startsWith("# ")) {
              outcome = line.substring(2).trim(); // Extract everything after '# '
              break; // Stop looking immediately
            }
          }

          if (outcome.includes("Replace this placeholder with your 1-sentence desired outcome")) {
            outcome = "";
          }

          // Split by slash to remove the 'projects/' folder path, then remove .md
          let baseName = filename.split(/[/\\]/).pop(); 
          let cleanName = baseName.replace('.md', '');

          // Ensure it starts with a single '+'
          if (!cleanName.startsWith('+')) {
            cleanName = '+' + cleanName;
          }

          return outcome ? `${cleanName} [${outcome}]` : cleanName;
        } catch (err) {
          console.error(`[MASTER LIST] Failed to read ${filename}:`, err);
          return null;
        }
      }));

      // Filter nulls and sort alphabetically
      const filteredList = projectEntries
        .filter(entry => entry !== null)
        .sort((a, b) => a.localeCompare(b));

      // Check equality to prevent unnecessary React re-renders (fades/flashes)
      const currentList = get().masterProjectList || [];
      const isSame = currentList.length === filteredList.length && 
                     currentList.every((val, i) => val === filteredList[i]);

      if (!isSame) {
        set({ masterProjectList: filteredList });
      }

      // Save to project_list.txt in the root as clean, single-line entries
      const compiledList = filteredList.join('\n');
      await invoke('save_project', {
        rootDir: rootDirectory,
        filename: 'project_list.txt',
        content: compiledList
      });
    } catch (err) {
      console.error('[MASTER LIST] Fatal error during generation:', err);
    }
  },

  initializeWatcher: async () => {
    const root = get().rootDirectory;
    if (!root) return;

    // Projects watcher with debounce
    const unlisten = await listen('projects-updated', () => {
      if (projectsDebounceTimer) clearTimeout(projectsDebounceTimer);
      projectsDebounceTimer = setTimeout(() => {
        get().fetchProjects();
      }, 300);
    });

    return unlisten;
  }
}));
