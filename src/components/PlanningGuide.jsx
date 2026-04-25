import { BookOpen, BrainCircuit } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';

export function PlanningGuide({ triggerIconOnly = false }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {triggerIconOnly ? (
          <button 
            className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors group"
            title="Planning Guide"
          >
            <BookOpen className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
          </button>
        ) : (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-2 gap-2 text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all text-[10px] font-bold uppercase tracking-widest"
          >
            <BookOpen className="h-4 w-4" />
            Planning Guide
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md border-l border-border/50 shadow-2xl backdrop-blur-xl pt-12 [&>button]:top-10">
        <SheetHeader className="pb-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            Natural Planning Model
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-8 text-sm pb-12">
          <div>
            <p className="text-muted-foreground italic leading-relaxed">
              Review this checklist when creating a project. This ensures that the project will align closely with your Purpose, Vision, and Goals.
            </p>
          </div>
          
          <section className="space-y-3">
            <h3 className="font-bold text-primary flex items-center gap-2 uppercase tracking-wider text-xs">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-[10px]">1</span>
              Purpose/Guiding Principles
            </h3>
            <ul className="list-disc pl-5 space-y-2 text-foreground/80">
              <li>Why is this being done? What would “on purpose” really mean?</li>
              <li>What are the key standards to hold in making decisions and acting on this project? What rules do we play by?</li>
            </ul>
            <div className="text-[11px] italic text-muted-foreground/70 mt-4 bg-muted/30 p-3 rounded-lg border border-border/20">
              The purpose and principles are the guiding criteria for making decisions on the project.
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-bold text-primary flex items-center gap-2 uppercase tracking-wider text-xs">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-[10px]">2</span>
              Mission/Vision/Outcome
            </h3>
            <ul className="list-disc pl-5 space-y-2 text-foreground/80">
              <li>What would it be like if it were totally successful? How would I know?</li>
              <li>What would that success look or feel like for each of the parties with an interest?</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="font-bold text-primary flex items-center gap-2 uppercase tracking-wider text-xs">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-[10px]">3</span>
              Brainstorming
            </h3>
            <ul className="list-disc pl-5 space-y-2 text-foreground/80">
              <li>What are all the things that occur to me about this? What is the current reality? What do I know? What do I not know? What ought I consider? What haven’t I Considered?</li>
              <li>Review the Project Planning Trigger List</li>
              <li>Be complete, open, nonjudgmental, and resist critical analysis.</li>
              <li>View from all sides.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="font-bold text-primary flex items-center gap-2 uppercase tracking-wider text-xs">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-[10px]">4</span>
              Organizing
            </h3>
            <ul className="list-disc pl-5 space-y-2 text-foreground/80">
              <li>Identify components (subprojects), sequences, and/or priorities.</li>
              <li>What needs to happen to make the whole thing happen?</li>
              <li>Create outlines, bulleted lists, or organizing charts, as needed for review and control.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="font-bold text-primary flex items-center gap-2 uppercase tracking-wider text-xs">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-[10px]">5</span>
              Next Actions
            </h3>
            <ul className="list-disc pl-5 space-y-2 text-foreground/80">
              <li>Determine next actions on current independent components. (What should be done next, and who will do it?)</li>
              <li>If more planning is required, determine the next action to get that to happen.</li>
            </ul>
          </section>

          <section className="space-y-4 pt-4 border-t border-border/50">
            <h3 className="font-bold text-primary flex items-center gap-2 uppercase tracking-wider text-xs">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-[10px]">6</span>
              Tips
            </h3>
            <div className="space-y-4">
              <div className="bg-muted/20 p-3 rounded-lg">
                <p className="font-bold text-[10px] mb-2 uppercase tracking-widest text-muted-foreground/80">Focus Levels</p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-foreground/70">
                  <li>If your project needs more clarity, raise the level of your focus.</li>
                  <li>If your project needs more to be happening, lower the level of your focus.</li>
                </ul>
              </div>
              <div className="bg-muted/20 p-3 rounded-lg">
                <p className="font-bold text-[10px] mb-2 uppercase tracking-widest text-muted-foreground/80">Planning Sufficiency</p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-foreground/70">
                  <li>If the project is off your mind, planning is sufficient.</li>
                  <li>If it’s still on your mind, then more is needed.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
