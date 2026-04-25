import React, { memo } from 'react';
import { useStore } from '../store';
import { ScrollArea } from './ui/scroll-area';
import { 
  Tag,
  AlertCircle,
  AtSign,
  Square
} from 'lucide-react';
import { cn } from '@/lib/utils';


export function ActionList() {
  const tasks = useStore((state) => state.tasks);
  const activeProject = useStore((state) => state.activeProject);

  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground italic text-sm text-center px-8">
        Select a project to see the associated next actions from todo.txt.
      </div>
    );
  }

  // Extract just the base filename (e.g., projects/+Work.md -> +Work)
  const projectName = activeProject.split('/').pop().replace('.md', '');

  // Filter tasks: ONLY show tasks where task.projects contains the exact +projectName
  const filteredTasks = tasks.filter((task) => 
    task.projects.includes(projectName) && !task.completed
  );

  // Sort: By task.priority (A-Z) first. Nulls at the end.
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const pA = a.priority || 'Z';
    const pB = b.priority || 'Z';
    return pA.localeCompare(pB);
  });

  return (
    <div className="flex h-full flex-col bg-muted/5">
      <div className="flex items-center justify-between mb-3 px-6 pt-4">
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground flex items-center gap-2">
          Next Actions: <span className="text-primary">{projectName}</span>
        </h3>
        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium">
          {sortedTasks.length} tasks
        </span>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/50 px-6">
          {sortedTasks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm italic">No Next Actions defined for this project.</p>
            </div>
          ) : (
            sortedTasks.map((task) => (
              <TaskItem key={task.raw_text} task={task} projectName={projectName} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

const TaskItem = memo(function TaskItem({ task, projectName }) {
  // 1. Clean the text: strip matching project and ALL contexts
  let cleanText = task.raw_text;
  
  // Strip completion and priority if they were parsed (they are in raw_text)
  // The parse_task in Rust keeps them in raw_text.
  // Let's strip them from the start if present.
  cleanText = cleanText.replace(/^x \d{4}-\d{2}-\d{2}\s+/, ''); // Completion
  cleanText = cleanText.replace(/^\([A-Z]\)\s+/, ''); // Priority
  cleanText = cleanText.replace(/^\d{4}-\d{2}-\d{2}\s+/, ''); // Creation date
  
  // Strip the matching project tag
  // Escape plus for regex
  const projectRegex = new RegExp(`\\${projectName}(\\s|$)`, 'g');
  cleanText = cleanText.replace(projectRegex, '');
  
  // Strip all contexts for clean display
  task.contexts.forEach(ctx => {
    const ctxRegex = new RegExp(`${ctx}(\\s|$)`, 'g');
    cleanText = cleanText.replace(ctxRegex, '');
  });

  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  return (
    <div className="p-3 hover:bg-muted/30 transition-colors flex items-start gap-3 group">
      <div className="mt-0.5 shrink-0">
        {task.priority ? (
           <div className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-muted-foreground/70">
            {task.priority}
          </div>
        ) : (
          <div className="w-5 h-5 flex items-center justify-center">
            <Square className="w-4 h-4 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground/80 mt-[2px]" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-tight mb-2 break-words">
          {cleanText}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {task.contexts.map((ctx) => {
            return (
              <span 
                key={ctx} 
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors text-[11px] text-primary font-medium"
              >
                <AtSign className="w-3 h-3" />
                {ctx.replace('@', '')}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.task.raw_text === nextProps.task.raw_text &&
         prevProps.projectName === nextProps.projectName;
});
