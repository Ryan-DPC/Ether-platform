use std::path::Path;
use std::process::Command;
use std::fs;
use tauri::{Window, Emitter};

// GameState struct to hold the currently running game's ID (folder_name)
pub struct GameState(pub std::sync::Arc<std::sync::Mutex<Option<String>>>);

#[derive(serde::Deserialize)]
pub struct UserData {
    pub user: Option<serde_json::Value>,
    pub token: Option<String>,
    pub friends: Option<serde_json::Value>,
}

#[derive(serde::Deserialize)]
struct Manifest {
    id: Option<String>,
    entry: Option<String>,
    #[serde(rename = "entryPoint")]
    entry_point: Option<String>,
    #[serde(rename = "mainFile")]
    main_file: Option<String>,
}

#[tauri::command]
pub fn launch_game(
    window: Window,
    state: tauri::State<'_, GameState>, // Inject state
    install_path: String,
    folder_name: String,
    user_data: Option<UserData>,
) -> Result<String, String> {
    
    // 0. Check Single Instance Lock
    {
        let mut running_game = state.0.lock().map_err(|_| "Failed to lock game state")?;
        if let Some(ref current) = *running_game {
            return Err(format!("A game is already running: {}", current));
        }
        // Set running
        *running_game = Some(folder_name.clone());
    }

    let game_dir = Path::new(&install_path).join("Vext").join(&folder_name);
    let manifest_path = game_dir.join("manifest.json");

    // 1. Read Manifest
    let data = fs::read_to_string(&manifest_path).map_err(|_| {
        // Clear lock if fail
        if let Ok(mut g) = state.0.lock() { *g = None; }
        "CRITICAL: manifest.json missing".to_string()
    })?;
    
    let manifest: Manifest = match serde_json::from_str(&data) {
        Ok(m) => m,
        Err(e) => {
            if let Ok(mut g) = state.0.lock() { *g = None; }
            return Err(e.to_string());
        }
    };

    let entry_file = manifest.entry.or(manifest.entry_point).or(manifest.main_file)
        .ok_or_else(|| {
             if let Ok(mut g) = state.0.lock() { *g = None; }
             "CRITICAL: No 'entry' defined in manifest.json".to_string()
        })?;

    let entry_path = game_dir.join(&entry_file);
    if !entry_path.exists() {
        if let Ok(mut g) = state.0.lock() { *g = None; }
        return Err(format!("CRITICAL: Entry file '{}' not found.", entry_file));
    }

    // 4. Launch
    if entry_file.ends_with(".exe") {
        let mut cmd = Command::new(&entry_path);
        cmd.current_dir(&game_dir);
        
        // Pass env vars AND args for compatibility
        if let Some(data) = user_data {
            if let Some(user) = data.user {
                // ... [Same user logic] ...
                let user_str = user.to_string();
                cmd.env("ETHER_USER", &user_str);
                
                // Standard arg
                cmd.arg("--user");
                cmd.arg(&user_str);

                // Aether Strike Compatibility (it expects username in --vext-user-id)
                if let Some(username) = user.get("username").and_then(|u| u.as_str()) {
                    cmd.arg("--vext-user-id");
                    cmd.arg(username);
                }
            }
            if let Some(token) = data.token {
                cmd.env("ETHER_TOKEN", &token);
                cmd.arg("--token");
                cmd.arg(&token);
                
                // Aether Strike Compatibility
                cmd.arg("--vext-token");
                cmd.arg(&token);
            }
            // Friends List Passing
            if let Some(friends) = data.friends {
                if let Some(friends_arr) = friends.as_array() {
                    let mut friends_vec = Vec::new();
                    for f in friends_arr {
                        // Assuming frontend sends { username: "name", is_online: true/false }
                        // OR { username: "name", status: "online" }
                        if let Some(name) = f.get("username").and_then(|s| s.as_str()) {
                            let is_online = f.get("is_online").and_then(|b| b.as_bool()).unwrap_or(false);
                            let status_str = if is_online { "online" } else { "offline" };
                            friends_vec.push(format!("{}:{}", name, status_str));
                        }
                    }
                    if !friends_vec.is_empty() {
                        let friends_arg = friends_vec.join(",");
                        cmd.arg("--vext-friends");
                        cmd.arg(friends_arg);
                    }
                }
            }
        }
        
        // Spawn detached
        match cmd.spawn() {
            Ok(mut child) => {
                let _ = window.emit("game:status", serde_json::json!({
                    "folderName": folder_name,
                    "status": "running"
                }));

                let window_clone = window.clone();
                let folder_name_clone = folder_name.clone();
                let game_id = manifest.id.clone();
                
                // Clone existing Arc to move properly into thread
                let state_arc = state.0.clone();

                // OPTIMIZATION: Set High Priority (Windows Only)
                #[cfg(target_os = "windows")]
                {
                    use windows::Win32::System::Threading::{OpenProcess, SetPriorityClass, PROCESS_SET_INFORMATION, HIGH_PRIORITY_CLASS};
                    use windows::Win32::Foundation::CloseHandle;
                    
                    let pid = child.id();
                    unsafe {
                         if let Ok(handle) = OpenProcess(PROCESS_SET_INFORMATION, false, pid) {
                             if let Err(e) = SetPriorityClass(handle, HIGH_PRIORITY_CLASS) {
                                 eprintln!("Failed to set process priority: {:?}", e);
                             } else {
                                 println!("Auto-Optimized: Set HIGH_PRIORITY for Game PID {}", pid);
                             }
                             let _ = CloseHandle(handle);
                         }
                    }
                }

                std::thread::spawn(move || {
                    match child.wait() {
                        Ok(status) => {
                            // Clear state
                            if let Ok(mut g) = state_arc.lock() { *g = None; }
                            
                            let _ = window_clone.emit("game:status", serde_json::json!({
                                "folderName": folder_name_clone,
                                "status": "stopped"
                            }));
                            
                            // Emit specific exit event for stats service
                            let _ = window_clone.emit("game:exited", serde_json::json!({
                                "folderName": folder_name_clone,
                                "gameId": game_id,
                                "code": status.code(),
                                "timestamp": std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap()
                                    .as_millis()
                            }));
                        },
                        Err(e) => {
                            eprintln!("Failed to wait on child process: {}", e);
                            // Clear state if wait fails
                            if let Ok(mut g) = state_arc.lock() { *g = None; }
                        }
                    }
                });

                Ok("Game Launched".to_string())
            },
            Err(e) => {
                if let Ok(mut g) = state.0.lock() { *g = None; }
                return Err(e.to_string())
            }
        }

    } else if entry_file.ends_with(".html") {
        if let Ok(mut g) = state.0.lock() { *g = None; }
        Err("HTML games not yet fully supported.".to_string())
    } else {
        if let Ok(mut g) = state.0.lock() { *g = None; }
        Err(format!("Unsupported entry file type: {}", entry_file))
    }
}
