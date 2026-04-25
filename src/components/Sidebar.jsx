import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useStore } from '../store';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { readDir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { ListCheck, AlertCircle, Palette, Plus, Activity, Search, Target, List, Settings, BookOpen, Clock, Archive, FolderKanban } from 'lucide-react';
import { StatsSheet } from './StatsSheet';
import { PlanningGuide } from './PlanningGuide';
import { SettingsDialog } from './SettingsDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription,
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet"

const GTD_TEMPLATE = `# (Replace this placeholder with your 1-sentence desired outcome)

## Purpose/Guiding Principles

## Mission/Vision/Goal/Successful Outcome

## Brainstorming

## Organizing

## Next Actions (transfer these to your todo.txt)`;

export function Sidebar() {
  const rootDirectory = useStore((state) => state.rootDirectory);
  const activeProject = useStore((state) => state.activeProject);
  const setActiveProject = useStore((state) => state.setActiveProject);
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const isStatsOpen = useStore((state) => state.isStatsOpen);
  const setStatsOpen = useStore((state) => state.setStatsOpen);
  const projects = useStore((state) => state.projects);
  const isLoadingProjects = useStore((state) => state.isLoadingProjects);
  const fetchProjects = useStore((state) => state.fetchProjects);

  const isDialogOpen = useStore((state) => state.isNewProjectDialogOpen);
  const setIsDialogOpen = useStore((state) => state.setNewProjectDialogOpen);
  const newProjectName = useStore((state) => state.newProjectName);
  const setNewProjectName = useStore((state) => state.setNewProjectName);
  const setCommandPaletteOpen = useStore((state) => state.setCommandPaletteOpen);
  const masterProjectList = useStore((state) => state.masterProjectList);
  const [isProjectListOpen, setIsProjectListOpen] = useState(false);


  const groupedProjects = useMemo(() => {
    const groups = {
      'Projects': [],
      'Someday': [],
      'Archive': [],
      'General': []
    };

    projects.forEach(path => {
      if (path.startsWith('projects/')) groups.Projects.push(path);
      else if (path.startsWith('archive/')) groups.Archive.push(path);
      else if (path.startsWith('someday/')) groups.Someday.push(path);
      else groups.General.push(path);
    });

    return groups;
  }, [projects]);



  async function handleCreateProject() {
    if (!newProjectName.trim()) return;

    // Sanitize: Strip .md and leading +
    const sanitizedName = newProjectName.trim()
      .replace(/\.md$/, "")
      .replace(/^\+/, "");

    if (!sanitizedName) return;

    const filename = `+${sanitizedName}.md`;

    try {
      await invoke("create_project", {
        rootDir: rootDirectory,
        filename: filename,
        content: GTD_TEMPLATE
      });

      setIsDialogOpen(false);
      setNewProjectName('');
      await fetchProjects();
      setActiveProject(`projects/${filename}`);
    } catch (err) {
      console.error("Failed to create project:", err);
      alert(`Error creating project: ${err}`);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      handleCreateProject();
    } else if (e.key === 'Escape') {
      setIsDialogOpen(false);
      setNewProjectName('');
    }
  }

  return (
    <div className="flex h-full flex-col bg-muted/20 border-r border-border">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8 px-2">
          <Sheet open={isProjectListOpen} onOpenChange={setIsProjectListOpen}>
            <SheetTrigger asChild>
              <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <ListCheck className="w-6 h-6" />
                project.txt
              </h1>
            </SheetTrigger>
            <SheetContent side="right" className="overflow-y-auto max-h-screen border-l border-border/50 bg-background/95 backdrop-blur-xl w-full sm:max-w-[100vw] md:max-w-[85vw] lg:max-w-[80vw] pt-12 [&>button]:top-10">
              <SheetHeader className="mb-6">
                <SheetTitle className="flex items-center gap-2 text-xl">
                  <FolderKanban className="w-5 h-5 text-primary" />
                  Projects List
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Overview of all active projects and their desired states.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4">
                {masterProjectList.length > 0 ? (
                  <ul className="flex flex-col">
                    {masterProjectList.map((outcome, idx) => {
                      const match = outcome.match(/^(\+[^\s]+)(?:\s+\[(.*?)\])?$/);
                      const projectName = match ? match[1] : outcome;
                      const outcomeText = match && match[2] ? match[2] : null;
                      
                      return (
                        <li 
                          key={idx} 
                          onClick={() => {
                            setActiveProject(`projects/${projectName.trim()}.md`);
                            setIsProjectListOpen(false);
                          }}
                          className="hover:bg-muted/30 transition-colors cursor-pointer px-4 py-4 flex items-start gap-3 border-b border-border/30 last:border-b-0"
                        >
                          <FolderKanban className="shrink-0 w-3.5 h-3.5 text-muted-foreground/50 mt-[5px]" />
                          <div className="flex flex-col flex-1 min-w-0 pr-4">
                            <span className="font-semibold text-primary text-base tracking-tight">{projectName}</span>
                            {outcomeText && (
                              <span className="text-sm text-muted-foreground italic mt-0.5 leading-relaxed">
                                {outcomeText}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="py-8 text-center bg-muted/30 rounded-lg border border-dashed border-border/50">
                    <p className="text-sm text-muted-foreground">No active projects found.</p>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsDialogOpen(true)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="New Project"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Search Projects (Cmd+K)"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* New project handled by Dialog */}

        {isLoadingProjects ? (
          <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground animate-pulse">
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
            <p className="text-xs font-medium italic">Refreshing projects...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedProjects).map(([label, items]) => (
              items.length > 0 && (
                <div key={label} className={cn(
                  (label === 'Someday' || label === 'Archive') && "mt-6 border-t border-border/50 pt-4"
                )}>
                  <h3 className="px-3 text-xs font-semibold tracking-wide mb-2 flex items-center gap-2 text-muted-foreground/60">
                    {label === 'Someday' ? <Clock className="w-3 h-3 text-muted-foreground/50" /> :
                     label === 'Archive' ? <Archive className="w-3 h-3 text-muted-foreground/50" /> :
                     <FolderKanban className="w-3 h-3 text-primary/50" />}
                    {label}
                  </h3>
                  <ul className="space-y-0.5">
                    {items.map((filename) => (
                      <li key={filename}>
                        <button
                          onClick={() => setActiveProject(filename)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-all duration-200 group flex items-center justify-between ${activeProject === filename
                              ? 'bg-primary/20 text-primary font-bold shadow-[inset_0_0_0_1px_rgba(var(--primary),0.1)]'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground font-normal'
                            }`}
                        >
                          <span className="truncate">
                            {filename.split('/').pop().replace('.md', '')}
                          </span>
                          {activeProject === filename && (
                            <div className="w-1 h-1 rounded-full bg-primary" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border mt-auto">
        <div className="flex items-center justify-center gap-6 w-full">
          <button
            onClick={() => setStatsOpen(true)}
            className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors group relative"
            title="System Review"
          >
            <Activity className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </button>

          <PlanningGuide triggerIconOnly={true} />

          <div className="flex items-center">
            <SettingsDialog 
              trigger={
                <button className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors group" title="Settings">
                  <Settings className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                </button>
              }
            />
          </div></div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] border-border/50 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListCheck className="w-5 h-5 text-primary" />
              New Project
            </DialogTitle>
            <DialogDescription>
              Plan a new project with the natural planning model.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="projectName" className="text-right text-xs font-semibold tracking-wide text-muted-foreground/60">
                Name
              </Label>
              <Input
                id="projectName"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="projectName"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="col-span-3 h-9 bg-muted/30 border-border/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setIsDialogOpen(false); setNewProjectName(''); }}
              className="h-9 px-4 text-xs font-semibold tracking-wide"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim()}
              className="h-9 px-4 text-xs font-semibold tracking-wide bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            >
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <StatsSheet />
    </div>
  );
}
