import React from 'react';
import { useStore } from '../store';
import { invoke } from '@tauri-apps/api/core';
import { open, message } from '@tauri-apps/plugin-dialog';
import { 
  Settings, 
  FolderSearch, 
  Palette, 
  Monitor, 
  ShieldCheck,
  Check
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function SettingsDialog({ trigger }) {
  const rootDirectory = useStore((state) => state.rootDirectory);
  const setRootDirectory = useStore((state) => state.setRootDirectory);
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);

  const handleDirectoryChange = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select New Project Root Directory',
      });
      
      if (selectedPath) {
        const exists = await invoke('check_todo_exists', { path: selectedPath });
        if (!exists) {
          await message('The selected directory must contain a todo.txt file.', { 
            title: 'Invalid Directory', 
            kind: 'error' 
          });
        } else {
          setRootDirectory(selectedPath);
        }
      }
    } catch (err) {
      console.error('Failed to change directory:', err);
    }
  };

  const themes = [
    { id: 'default', label: 'Zinc', color: 'bg-zinc-500' },
    { id: 'indigo', label: 'Indigo', color: 'bg-indigo-500' },
    { id: 'emerald', label: 'Emerald', color: 'bg-emerald-500' },
    { id: 'amber', label: 'Amber', color: 'bg-amber-500' },
    { id: 'rose', label: 'Rose', color: 'bg-rose-500' },
    { id: 'sky', label: 'Sky', color: 'bg-sky-500' }
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-xl border-border/50 shadow-2xl backdrop-blur-xl p-0 overflow-hidden">
        <div className="max-h-[85vh] overflow-y-auto bg-background/50 p-8 pt-12 custom-scrollbar">
          <DialogHeader className="mb-10">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight">
              <Settings className="h-6 w-6 text-primary" />
              Settings
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/80">
              Manage your workspace and personalize your experience.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-12 pb-4">
            {/* SECTION: WORKSPACE */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                <FolderSearch className="h-4 w-4" />
                Workspace Location
              </div>
              <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-4 shadow-inner">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground/40 px-1">Current Directory</label>
                  <div className="px-3 py-2.5 rounded-md bg-background border border-border/50 text-xs font-mono text-muted-foreground break-all leading-relaxed shadow-sm">
                    {rootDirectory || 'No directory selected'}
                  </div>
                </div>
                <Button 
                  onClick={handleDirectoryChange}
                  className="w-full gap-2 font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <FolderSearch className="h-4 w-4" />
                  Change Project Folder
                </Button>
              </div>
              <p className="px-1 text-[11px] text-muted-foreground/60 leading-relaxed italic">
                Note: The selected folder must contain a <span className="text-primary/70 font-mono font-bold">todo.txt</span> file to be valid.
              </p>
            </section>

            <hr className="border-border/30" />

            {/* SECTION: APPEARANCE */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                <Palette className="h-4 w-4" />
                Appearance Settings
              </div>
              <div className="p-5 rounded-xl border border-border/50 bg-muted/20 space-y-4 shadow-inner">
                <div className="space-y-3">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground/40 px-1">Accent Theme</label>
                  <div className="grid grid-cols-3 gap-2">
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`
                          group flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all relative
                          ${theme === t.id 
                              ? 'bg-background border-primary shadow-md ring-2 ring-primary/10' 
                                : 'bg-background border-border/50 hover:border-primary/50 hover:bg-muted/50'
                          }
                        `}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full ${t.color} shadow-sm group-hover:scale-110 transition-transform`} />
                        <span className={`text-[11px] font-bold ${theme === t.id ? 'text-foreground' : 'text-muted-foreground'}`}>{t.label}</span>
                        {theme === t.id && (
                          <div className="absolute right-2 text-primary">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
