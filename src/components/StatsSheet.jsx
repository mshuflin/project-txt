import { useEffect, useState } from "react";
import { useStore } from "../store";
import { invoke } from "@tauri-apps/api/core";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Hourglass, 
  Info,
  Inbox,
  Play,
  Clock,
  AlertCircle,
  Loader2,
  LayoutList,
  Blocks,
  FolderGit2,
  PauseCircle,
  Skull,
  Terminal,
  Plus
} from "lucide-react";

export function StatsSheet() {
  const rootDirectory = useStore((state) => state.rootDirectory);
  const setActiveProject = useStore((state) => state.setActiveProject);
  const isStatsOpen = useStore((state) => state.isStatsOpen);
  const setStatsOpen = useStore((state) => state.setStatsOpen);
  const openNewProjectDialog = useStore((state) => state.openNewProjectDialog);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isStatsOpen && rootDirectory) {
      loadMetrics();
    }
  }, [isStatsOpen, rootDirectory]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await invoke("calculate_metrics", { rootDir: rootDirectory });
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectJump = (path) => {
    // Ensure we handle absolute vs relative correctly
    setActiveProject(path);
    setStatsOpen(false);
  };

  const handleZombieJump = (tag) => {
    // Zombie tags are like "+Project", we need to jump to "archive/Project.md"
    const stem = tag.startsWith('+') ? tag.slice(1) : tag;
    handleProjectJump(`archive/${stem}.md`);
  };

  const handleOrphanedClick = (tag) => {
    // Open new project dialog with the tag name (plus sign stripped by store helper)
    openNewProjectDialog(tag);
    setStatsOpen(false);
  };

  const MetricCard = ({ title, value, icon: Icon, colorClass, subtext }) => (
    <Card className="overflow-hidden border-border/50 shadow-sm bg-muted/5 cursor-default">
      <CardHeader className="p-3 pb-0">
        <CardTitle className={`text-xs tracking-wide flex items-center gap-1.5 font-semibold ${colorClass}`}>
          <Icon className="h-3 w-3" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <div className="flex items-baseline gap-1">
          <p className="text-xl font-bold tracking-tighter">{value}</p>
          {subtext && <span className="text-[10px] text-muted-foreground font-medium">{subtext}</span>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Sheet open={isStatsOpen} onOpenChange={setStatsOpen}>
      <SheetContent className="w-full sm:max-w-[100vw] md:max-w-[85vw] lg:max-w-[80vw] border-l border-border/50 bg-background/95 backdrop-blur-xl overflow-y-auto transition-all duration-500 pt-12 [&>button]:top-10">
        <div className="p-8">
          <SheetHeader className="mb-10">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <SheetTitle className="flex items-center gap-3 text-3xl font-bold tracking-tighter">
                  <Activity className="h-8 w-8 text-primary" />
                  System Review
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground/80 font-medium">
                  Key metrics to provide a high level perspective on your system.
                </SheetDescription>
              </div>
              {metrics && (
                <div className="flex items-center gap-3 text-primary font-semibold text-xs tracking-wide bg-primary/5 px-4 py-2 rounded-full border border-primary/10 cursor-default shadow-sm select-none">
                  <CheckCircle2 className="h-4 w-4" />
                  {metrics.recently_completed_tasks} Tasks Completed in the Last 7 Days
                </div>
              )}
            </div>
          </SheetHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
               <Loader2 className="h-10 w-10 text-primary animate-spin" />
               <p className="text-sm text-muted-foreground animate-pulse italic font-medium">Synchronizing Command Center...</p>
            </div>
          ) : metrics ? (
            <div className="space-y-12">
              
              {/* SECTION: TASK ECOSYSTEM */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                  <Terminal className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold tracking-wide text-primary/80">Tasks</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <MetricCard 
                    title="Inbox Items" 
                    value={metrics.inbox_items} 
                    icon={Inbox} 
                    colorClass="text-primary" 
                  />
                  <MetricCard 
                    title="Active Tasks" 
                    value={metrics.active_tasks} 
                    icon={Play} 
                    colorClass="text-primary" 
                  />
                  <MetricCard 
                    title="Scheduled Tasks" 
                    value={metrics.snoozed_tasks} 
                    icon={Clock} 
                    colorClass="text-primary" 
                  />
                  <MetricCard 
                    title="Threshold Reached" 
                    value={metrics.threshold_passed} 
                    icon={AlertCircle} 
                    colorClass="text-destructive" 
                  />
                  <MetricCard 
                    title="Total Tasks" 
                    value={metrics.total_tasks} 
                    icon={LayoutList} 
                    colorClass="text-primary" 
                  />
                  <MetricCard 
                    title="Projectless Actions" 
                    value={metrics.projectless_actions} 
                    icon={Blocks} 
                    colorClass="text-destructive" 
                  />
                </div>
              </div>

              {/* SECTION: PROJECT STRATEGY */}
              <div className="space-y-5 pt-2">
                <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                  <FolderGit2 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold tracking-wide text-primary/80">Projects</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <MetricCard 
                    title="Active Projects" 
                    value={metrics.active_projects} 
                    icon={FolderGit2} 
                    colorClass="text-primary" 
                  />
                  <MetricCard 
                    title="Projects on Hold" 
                    value={metrics.projects_on_hold} 
                    icon={PauseCircle} 
                    colorClass="text-muted-foreground" 
                  />
                  <MetricCard 
                    title="Actionless Projects" 
                    value={metrics.actionless_projects.length} 
                    icon={AlertTriangle} 
                    colorClass="text-destructive" 
                  />
                  <MetricCard 
                    title="Zombie Projects" 
                    value={metrics.zombie_projects.length} 
                    icon={Skull} 
                    colorClass="text-destructive" 
                  />
                  <MetricCard 
                    title="Orphaned Projects" 
                    value={metrics.orphaned_projects.length} 
                    icon={Blocks} 
                    colorClass="text-destructive" 
                  />
                </div>
              </div>

              {/* SECTION: DETAILED REVIEW LISTS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 1. Actionless Projects */}
                {metrics.actionless_projects.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Actionless Projects
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {metrics.actionless_projects.map((path) => (
                        <Badge
                          key={path}
                          variant="outline"
                          className="px-3 py-1.5 bg-background shadow-sm hover:shadow-md hover:bg-destructive/5 hover:text-destructive hover:border-destructive/40 cursor-pointer transition-all duration-300 group flex items-center gap-2 text-xs border-border/50"
                          onClick={() => handleProjectJump(path)}
                        >
                          <span className="font-medium tracking-tight text-destructive/80 group-hover:text-destructive">{path.split("/").pop().replace(".md", "")}</span>
                          <ArrowRight className="h-3 w-3 opacity-40 group-hover:opacity-100 group-hover:text-destructive -translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Zombie Projects */}
                {metrics.zombie_projects.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2 text-destructive">
                        <Skull className="h-3.5 w-3.5" />
                        Zombie Projects
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {metrics.zombie_projects.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="px-3 py-1.5 bg-destructive/5 text-destructive border border-destructive/10 hover:bg-destructive/10 hover:border-destructive/30 cursor-pointer transition-all duration-300 flex items-center gap-2 text-xs group"
                          onClick={() => handleZombieJump(tag)}
                        >
                          <span className="font-medium tracking-tight text-destructive/80 group-hover:text-destructive">
                            {tag.startsWith('++') ? tag.slice(1) : tag}
                          </span>
                          <ArrowRight className="h-3 w-3 opacity-40 group-hover:opacity-100 group-hover:text-destructive transition-opacity" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Orphaned Projects */}
                {metrics.orphaned_projects.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2 text-destructive">
                        <Blocks className="h-3.5 w-3.5" />
                        Orphaned Projects
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {metrics.orphaned_projects.map((tag) => (
                        <Badge
                          key={tag}
                          variant="destructive"
                          className="px-3 py-1.5 bg-destructive/5 text-destructive border border-destructive/10 cursor-pointer opacity-80 hover:opacity-100 hover:bg-destructive/10 transition-all flex items-center gap-2 text-xs group"
                          onClick={() => handleOrphanedClick(tag)}
                        >
                          <span className="font-medium tracking-tight text-destructive/80 group-hover:text-destructive">{tag}</span>
                          <Plus className="h-3 w-3 opacity-40 group-hover:opacity-100 group-hover:text-destructive -translate-x-2 group-hover:translate-x-0 transition-all" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
