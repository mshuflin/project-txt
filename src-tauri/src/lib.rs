use std::fs::{self, OpenOptions};
use std::collections::HashMap;
use std::io::Write;
use std::path::{PathBuf, Path};
use std::sync::Mutex;
use std::time::{Instant, Duration};
use regex::Regex;
use serde::Serialize;
use notify::{Watcher, RecursiveMode, EventKind, RecommendedWatcher};
use tauri::{Emitter, State};
use once_cell::sync::Lazy;

static DATE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^\d{4}-\d{2}-\d{2}\s*").unwrap());
static PRI_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^\(([A-Z])\)\s*").unwrap());
static CTX_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?:\s|^)@(\S+)").unwrap());
static PROJ_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?:\s|^)\+(\S+)").unwrap());
static THRESHOLD_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"t:(\d{4}-\d{2}-\d{2})").unwrap());

/// Strict data contract for task payloads sent to the React frontend.
#[derive(Debug, Serialize, Clone)]
pub struct TaskPayload {
    pub raw_text: String,
    pub priority: Option<String>,
    pub contexts: Vec<String>,
    pub projects: Vec<String>,
    pub completed: bool,
    pub threshold_date: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MetricsPayload {
    pub active_tasks: u32,
    pub snoozed_tasks: u32,
    pub total_tasks: u32,
    pub active_projects: u32,
    pub projects_on_hold: u32,
    pub projectless_actions: u32,
    pub threshold_passed: u32,
    pub inbox_items: u32,
    pub actionless_projects: Vec<String>,
    pub orphaned_projects: Vec<String>,
    pub zombie_projects: Vec<String>,
    pub recently_completed_tasks: u32,
}

/// Parse a single todo.txt line into a TaskPayload.
fn parse_task(line: &str) -> TaskPayload {
    let trimmed = line.trim();
    let mut remaining = trimmed.to_string();
    let mut completed = false;
    let mut priority: Option<String> = None;

    // Check for completion marker
    if remaining.starts_with("x ") {
        completed = true;
        remaining = remaining[2..].trim().to_string();
        // Skip completion date if present (YYYY-MM-DD)
        remaining = DATE_RE.replace(&remaining, "").to_string();
    }

    // Parse priority: ^(\([A-Z]\))
    if let Some(caps) = PRI_RE.captures(&remaining.clone()) {
        priority = Some(caps[1].to_string());
        remaining = PRI_RE.replace(&remaining, "").to_string();
    }

    // Skip creation date if present
    remaining = DATE_RE.replace(&remaining, "").to_string();

    // Extract contexts: @word (must be at start or preceded by whitespace)
    let contexts: Vec<String> = CTX_RE
        .captures_iter(&remaining)
        .map(|c| format!("@{}", &c[1]))
        .collect();

    // Extract projects: +word (must be at start or preceded by whitespace)
    let projects: Vec<String> = PROJ_RE
        .captures_iter(&remaining)
        .map(|c| format!("+{}", &c[1]))
        .collect();

    // Extract threshold date: t:YYYY-MM-DD
    let threshold_date = THRESHOLD_RE
        .captures(&remaining)
        .map(|c| c[1].to_string());

    TaskPayload {
        raw_text: trimmed.to_string(),
        priority,
        contexts,
        projects,
        completed,
        threshold_date,
    }
}

/// Helper to normalize/slugify project tags for consistent matching.
/// Removes non-alphanumeric characters and converts to lowercase.
fn normalize_tag(tag: &str) -> String {
    tag.chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_lowercase()
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn check_todo_exists(path: &str) -> bool {
    let p = PathBuf::from(path).join("todo.txt");
    p.exists()
}

#[tauri::command]
fn read_file(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn save_file(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
fn read_project(root_dir: &str, filename: &str) -> Result<String, String> {
    let p = PathBuf::from(root_dir).join(filename);
    fs::read_to_string(p).map_err(|e| format!("Failed to read project: {}", e))
}

#[tauri::command]
fn save_project(root_dir: &str, filename: &str, content: &str) -> Result<(), String> {
    let p = PathBuf::from(root_dir).join(filename);
    fs::write(p, content).map_err(|e| format!("Failed to save project: {}", e))
}

#[tauri::command]
fn create_project(root_dir: &str, filename: &str, content: &str) -> Result<(), String> {
    let projects_dir = PathBuf::from(root_dir).join("projects");

    // Ensure the projects directory exists
    if !projects_dir.exists() {
        fs::create_dir_all(&projects_dir)
            .map_err(|e| format!("Failed to create projects directory: {}", e))?;
    }

    let file_path = projects_dir.join(filename);

    // Don't overwrite existing files
    if file_path.exists() {
        return Err(format!("Project '{}' already exists in projects/", filename));
    }

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to create project file: {}", e))
}

#[tauri::command]
fn list_projects(root_dir: &str) -> Result<Vec<String>, String> {
    let mut projects = Vec::new();
    let root = Path::new(root_dir);
    
    // Explicitly scan root and these specific subfolders
    let subdirs = vec!["", "projects", "archive", "someday"];
    
    for subdir in subdirs {
        let dir = if subdir.is_empty() {
            root.to_path_buf()
        } else {
            root.join(subdir)
        };
        
        if dir.is_dir() {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    // Shallow scan: only files within these specific folders
                    if path.is_file() {
                        if let Some(ext) = path.extension() {
                            if ext == "md" {
                                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                                    // Exclude hidden files and node_modules explicitly
                                    if !name.starts_with('.') && name != "node_modules" {
                                        let rel_path = if subdir.is_empty() {
                                            name.to_string()
                                        } else {
                                            format!("{}/{}", subdir, name)
                                        };
                                        projects.push(rel_path);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    projects.sort();
    Ok(projects)
}

#[tauri::command]
fn fetch_active_tasks(root_dir: &str) -> Result<Vec<TaskPayload>, String> {
    let root = PathBuf::from(root_dir);
    let mut all_tasks: Vec<TaskPayload> = Vec::new();

    // Read todo.txt (required)
    let todo_path = root.join("todo.txt");
    let todo_contents = fs::read_to_string(&todo_path)
        .map_err(|e| format!("Failed to read todo.txt: {}", e))?;

    let todo_tasks = todo_contents
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| parse_task(line));

    all_tasks.extend(todo_tasks);

    // Read done.txt (optional — may not exist yet)
    let done_path = root.join("done.txt");
    if done_path.exists() {
        if let Ok(done_contents) = fs::read_to_string(&done_path) {
            let done_tasks = done_contents
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(|line| {
                    let mut task = parse_task(line);
                    task.completed = true; // Force completed for all done.txt entries
                    task
                });

            all_tasks.extend(done_tasks);
        }
    }

    Ok(all_tasks)
}

fn rotate_backups(todo_path: &PathBuf) -> Result<(), String> {
    if !todo_path.exists() {
        return Ok(());
    }

    // Rotate backups .1.bak -> .2.bak, etc.
    for i in (1..5).rev() {
        let mut src_name = todo_path.file_name().ok_or("Invalid filename")?.to_os_string();
        src_name.push(format!(".{}.bak", i));
        let src = todo_path.with_file_name(src_name);

        let mut dst_name = todo_path.file_name().ok_or("Invalid filename")?.to_os_string();
        dst_name.push(format!(".{}.bak", i + 1));
        let dst = todo_path.with_file_name(dst_name);

        if src.exists() {
            fs::rename(&src, &dst).map_err(|e| format!("Failed to rotate backup {}: {}", i, e))?;
        }
    }

    // Create the latest backup from the current file
    let mut first_bak_name = todo_path.file_name().ok_or("Invalid filename")?.to_os_string();
    first_bak_name.push(".1.bak");
    let first_bak = todo_path.with_file_name(first_bak_name);
    
    fs::copy(todo_path, first_bak).map_err(|e| format!("Failed to create initial backup: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn check_active_tasks(root_dir: &str, project_tag: &str) -> Result<bool, String> {
    let root = Path::new(root_dir);
    let todo_path = root.join("todo.txt");
    if !todo_path.exists() {
        return Ok(false);
    }

    let contents = fs::read_to_string(&todo_path).map_err(|e| format!("Failed to read todo.txt: {}", e))?;
    
    // Check if any active task contains the project tag (e.g. +Work)
    let search_tag = project_tag.to_lowercase();
    let exists = contents.lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| parse_task(line))
        .any(|task| !task.completed && task.projects.iter().any(|p| p.to_lowercase() == search_tag));

    Ok(exists)
}

#[tauri::command]
fn calculate_metrics(root_dir: &str) -> Result<MetricsPayload, String> {
    let root = Path::new(root_dir);
    let now = chrono::Local::now().date_naive();
    
    // 1. Scan Projects Folder Structure (Single pass)
    // Map normalized tag -> (Original Stem, Folders it exists in)
    let mut project_file_map: HashMap<String, (String, Vec<String>)> = HashMap::new();
    let mut projects_count = 0;
    let mut someday_count = 0;

    let scan_dirs = vec!["", "projects", "archive", "someday"];
    for subdir in scan_dirs {
        let dir = if subdir.is_empty() { root.to_path_buf() } else { root.join(subdir) };
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().map_or(false, |ext| ext == "md") {
                    if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                        let original_stem = stem.to_string();
                        let norm_tag = normalize_tag(&format!("+{}", stem));
                        
                        let entry = project_file_map.entry(norm_tag).or_insert((original_stem, Vec::new()));
                        entry.1.push(subdir.to_string());
                        
                        // Count folder types
                        if subdir == "projects" { projects_count += 1; }
                        else if subdir == "someday" { someday_count += 1; }
                    }
                }
            }
        }
    }

    // 2. Process todo.txt (Single Pass)
    let todo_path = root.join("todo.txt");
    let todo_contents = fs::read_to_string(&todo_path).map_err(|e| format!("Failed to read todo.txt: {}", e))?;
    
    let mut active_tasks_count = 0;
    let mut snoozed_tasks_count = 0;
    let mut total_tasks_count = 0;
    let mut projectless_actions_count = 0;
    let mut threshold_passed_count = 0;
    let mut inbox_items_count = 0;
    let mut tasks_project_tags: HashMap<String, String> = HashMap::new();

    for line in todo_contents.lines().filter(|l| !l.trim().is_empty()) {
        let task = parse_task(line);
        if !task.completed {
            total_tasks_count += 1;
            
            // Collect project tags for diffing later (normalized key -> original value)
            for tag in &task.projects {
                let norm = normalize_tag(tag);
                if !tasks_project_tags.contains_key(&norm) {
                    tasks_project_tags.insert(norm, tag.clone());
                }
            }

            // Inbox Check: No projects AND no contexts
            if task.projects.is_empty() && task.contexts.is_empty() {
                inbox_items_count += 1;
            }

            // Projectless: No projects
            if task.projects.is_empty() {
                projectless_actions_count += 1;
            }

            // Threshold Calculation
            if let Some(t_str) = &task.threshold_date {
                if let Ok(t_date) = chrono::NaiveDate::parse_from_str(t_str, "%Y-%m-%d") {
                    if t_date > now {
                        snoozed_tasks_count += 1;
                    } else {
                        active_tasks_count += 1;
                        threshold_passed_count += 1;
                    }
                } else {
                    active_tasks_count += 1; // Invalid date = active
                }
            } else {
                active_tasks_count += 1; // No date = active
            }
        }
    }

    // 3. Diff Logic for Lists
    let mut actionless_projects = Vec::new();
    let mut orphaned_projects = Vec::new();
    let mut zombie_projects = Vec::new();

    // Actionless: .md files in root or 'projects/' that aren't tagged in any incomplete task
    for (norm_tag, (original_stem, folders)) in &project_file_map {
        let is_active_folder = folders.iter().any(|f| f == "" || f == "projects");
        if is_active_folder {
            if !tasks_project_tags.contains_key(norm_tag) {
                // Return relative path for frontend jump
                // Find which folder it was actually in for the path
                let folder = folders.iter()
                    .find(|f| f.as_str() == "" || f.as_str() == "projects")
                    .map(|s| s.as_str())
                    .unwrap_or("projects");
                
                let rel_path = if folder.is_empty() {
                    format!("{}.md", original_stem)
                } else {
                    format!("{}/{}.md", folder, original_stem)
                };
                actionless_projects.push(rel_path);
            }
        }
    }
    actionless_projects.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));

    // Orphans & Zombies: Iterate tags found in tasks
    for (norm_tag, original_tag) in tasks_project_tags {
        match project_file_map.get(&norm_tag) {
            None => {
                // Orphaned: No corresponding .md file found
                orphaned_projects.push(original_tag); 
            }
            Some((_original_stem, folders)) => {
                // Zombie: Exists ONLY in archive folder
                if folders.len() == 1 && folders[0] == "archive" {
                    zombie_projects.push(original_tag);
                }
            }
        }
    }
    orphaned_projects.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    zombie_projects.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));

    // 4. Recently Completed (Done.txt)
    let mut recently_completed_count = 0;
    let done_path = root.join("done.txt");
    if done_path.exists() {
        if let Ok(done_contents) = fs::read_to_string(&done_path) {
            let seven_days_ago = now - chrono::Duration::days(7);
            for line in done_contents.lines().filter(|l| !l.trim().is_empty()) {
                if line.starts_with("x ") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        if let Ok(completion_date) = chrono::NaiveDate::parse_from_str(parts[1], "%Y-%m-%d") {
                            if completion_date >= seven_days_ago { recently_completed_count += 1; }
                        }
                    }
                }
            }
        }
    }

    Ok(MetricsPayload {
        active_tasks: active_tasks_count,
        snoozed_tasks: snoozed_tasks_count,
        total_tasks: total_tasks_count,
        active_projects: projects_count,
        projects_on_hold: someday_count,
        projectless_actions: projectless_actions_count,
        threshold_passed: threshold_passed_count,
        inbox_items: inbox_items_count,
        actionless_projects,
        orphaned_projects,
        zombie_projects,
        recently_completed_tasks: recently_completed_count,
    })
}

#[tauri::command]
fn move_project_file(root_dir: &str, current_relative_path: &str, target_subfolder: &str) -> Result<String, String> {
    let root = Path::new(root_dir);
    let src = root.join(current_relative_path);
    if !src.exists() {
        return Err(format!("Source file does not exist: {:?}", src));
    }

    // Ensure target folder name is valid (projects, someday, or archive)
    if target_subfolder != "projects" && target_subfolder != "someday" && target_subfolder != "archive" {
        return Err("Invalid target folder".to_string());
    }

    // Ensure destination directory exists (e.g. root/someday)
    let target_dir = root.join(target_subfolder);
    if !target_dir.exists() {
        fs::create_dir_all(&target_dir).map_err(|e| format!("Failed to create target directory: {}", e))?;
    }

    // Calculate destination filename
    let filename_os = src.file_name().ok_or("Invalid filename")?;
    let mut dst = target_dir.join(filename_os);

    // No Overwrites: if file exists in target, add granular timestamp
    if dst.exists() {
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M").to_string();
        let stem = src.file_stem().ok_or("Invalid filestem")?.to_str().ok_or("Invalid UTF-8")?;
        let ext = src.extension().and_then(|s| s.to_str()).unwrap_or("md");
        let new_filename = format!("{}_{}.{}", stem, timestamp, ext);
        dst = target_dir.join(new_filename);
    }

    // Path Sanitization: Ensure destination is actually inside the target folder
    if !dst.starts_with(&target_dir) {
        return Err("Security Violation: Destination is outside allowed subfolders".to_string());
    }

    // Move the file
    fs::rename(&src, &dst).map_err(|e| format!("Failed to move file to {}: {}", target_subfolder, e))?;

    // Return the new relative path so the frontend can follow the move
    let final_filename = dst.file_name().ok_or("Invalid result filename")?.to_str().ok_or("Invalid UTF-8")?;
    Ok(format!("{}/{}", target_subfolder, final_filename))
}

#[tauri::command]
fn transfer_task(
    task_str: String,
    file_path: String,
    line_to_remove: String,
    root_dir: String,
) -> Result<(), String> {
    let root = PathBuf::from(&root_dir);
    let target_file = PathBuf::from(&file_path);

    // Security check: ensure target_file is within root
    if !target_file.starts_with(&root) {
        return Err("Security Violation: Target file is outside root directory".to_string());
    }

    // 1. Read & Verify
    let content = fs::read_to_string(&target_file)
        .map_err(|e| format!("Failed to read project file: {}", e))?;
    
    if !content.contains(&line_to_remove) {
        return Err("Task not found in project file (it may have changed)".to_string());
    }

    // 2. Backup Rotation
    let todo_path = root.join("todo.txt");
    rotate_backups(&todo_path)?;

    // 3. Append to todo.txt
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&todo_path)
        .map_err(|e| format!("Failed to open todo.txt for appending: {}", e))?;

    writeln!(file, "{}", task_str)
        .map_err(|e| format!("Failed to append task to todo.txt: {}", e))?;

    // 4. Remove from .md and save
    // Use replacen to remove ONLY the first exact match
    let updated_content = content.replacen(&line_to_remove, "", 1);
    
    fs::write(&target_file, updated_content)
        .map_err(|e| format!("Failed to update project file: {}", e))?;

    Ok(())
}

struct AppState {
    watcher: Mutex<Option<RecommendedWatcher>>,
}

#[tauri::command]
fn start_file_watcher(
    root_dir: String,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut watcher_guard = state.watcher.lock().map_err(|e| format!("Failed to lock watcher: {}", e))?;
    
    let app_handle_clone = app_handle.clone();
    let last_emit = Mutex::new(None);

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        match res {
            Ok(event) => {


                // Specific task file check: only used for store refreshes
                let is_task_file = event.paths.iter().any(|p| {
                    let filename = p.file_name().and_then(|f| f.to_str()).unwrap_or("");
                    filename == "todo.txt" || filename == "done.txt"
                });

                if is_task_file {
                    if let EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) | EventKind::Any = event.kind {
                        let mut last_emit_guard = last_emit.lock().unwrap();
                        let now = Instant::now();
                        let should_emit = match *last_emit_guard {
                            Some(last) => now.duration_since(last) >= Duration::from_millis(500),
                            None => true,
                        };

                        if should_emit {
                            let _ = app_handle_clone.emit("tasks-updated", ());
                            *last_emit_guard = Some(now);
                        }
                    }
                }
            }
            Err(e) => println!("Watcher error: {:?}", e),
        }
    }).map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher.watch(Path::new(&root_dir), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to start watching: {}", e))?;

    // Saving the new watcher into state drops the old one, automatically stopping its thread
    *watcher_guard = Some(watcher);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState { watcher: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![
            greet,
            check_todo_exists,
            read_file,
            save_file,
            read_project,
            save_project,
            create_project,
            list_projects,
            fetch_active_tasks,
            transfer_task,
            check_active_tasks,
            move_project_file,
            calculate_metrics,
            start_file_watcher
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
