import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { 
  FileText, 
  Archive, 
  Clock, 
  Search, 
  FolderKanban,
  ChevronRight
} from 'lucide-react';

export function CommandPalette() {
  const open = useStore((state) => state.isCommandPaletteOpen);
  const setOpen = useStore((state) => state.setCommandPaletteOpen);
  const projects = useStore((state) => state.projects);
  const setActiveProject = useStore((state) => state.setActiveProject);

  // Grouping logic (reused from Sidebar)
  const groupedProjects = useMemo(() => {
    const groups = {
      'Projects': [],
      'Archive': [],
      'Someday': [],
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

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const onSelect = (path) => {
    setActiveProject(path);
    setOpen(false);
  };

  const getCleanName = (path) => {
    return path.split('/').pop().replace('.md', '');
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search projects or archives..." />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/5">
            <Search className="h-10 w-10 mb-4 opacity-10" />
            <p className="text-sm font-medium opacity-60">No matching projects found</p>
            <p className="text-xs opacity-40 mt-1">Try searching by folder or filename</p>
          </div>
        </CommandEmpty>
        
        {Object.entries(groupedProjects).map(([groupName, paths]) => (
          paths.length > 0 && (
            <CommandGroup key={groupName} heading={groupName}>
              {paths.map((path) => {
                const Icon = groupName === 'Archive' ? Archive : 
                            groupName === 'Someday' ? Clock : 
                            groupName === 'Projects' ? FolderKanban : FileText;
                
                return (
                  <CommandItem
                    key={path}
                    value={path}
                    onSelect={() => onSelect(path)}
                    className="flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center">
                      <Icon className="mr-3 h-4 w-4 text-muted-foreground group-data-[selected='true']:text-primary transition-colors" />
                      <span className="font-medium">{getCleanName(path)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-0 group-data-[selected='true']:opacity-100 transition-all transform translate-x-2 group-data-[selected='true']:translate-x-0">
                      <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border border-border/50">
                        Jump to
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )
        ))}
      </CommandList>
    </CommandDialog>
  );
}
