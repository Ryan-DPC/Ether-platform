use std::fs;
use std::path::Path;
use std::io::copy;
use reqwest::Client;
use zip::ZipArchive;
use futures_util::StreamExt;
use std::cmp::min;
use std::io::Write;
use tauri::{Window, Emitter};




#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    game_id: String,
    game_name: String,
    progress: u64,
    status: String,
}

#[tauri::command]
pub async fn install_game(
    window: Window,
    download_url: String,
    install_path: String,
    folder_name: String,
    game_id: String,
    game_name: String,
    backend_url: String,
) -> Result<String, String> {
    let client = Client::new();
    let game_dir = Path::new(&install_path).join("Vext").join(&folder_name);
    
    // Create directory
    fs::create_dir_all(&game_dir).map_err(|e| e.to_string())?;

    let is_zip = download_url.ends_with(".zip");
    let file_name = if is_zip { "game.zip" } else { "Game.exe" };
    let file_path = game_dir.join(file_name);

    // 1. Download
    let res = client
        .get(&download_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Download failed with status: {}", res.status()));
    }

    let total_size = res.content_length().unwrap_or(0);
    let mut stream = res.bytes_stream();
    let mut file = fs::File::create(&file_path).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;

    let _ = window.emit("install:progress", ProgressPayload {
        game_id: game_id.clone(),
        game_name: game_name.clone(),
        progress: 0,
        status: "downloading".to_string(),
    });

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percent = min(100, (downloaded * 100) / total_size);
            let _ = window.emit("install:progress", ProgressPayload {
                game_id: game_id.clone(),
                game_name: game_name.clone(),
                progress: percent,
                status: "downloading".to_string(),
            });
        }
    }

    // 2. Extract (Only if Zip)
    if is_zip {
        let _ = window.emit("install:progress", ProgressPayload {
            game_id: game_id.clone(),
            game_name: game_name.clone(),
            progress: 100,
            status: "extracting".to_string(),
        });

        let file = fs::File::open(&file_path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let outpath = match file.enclosed_name() {
                Some(path) => game_dir.join(path),
                None => continue,
            };

            if (*file.name()).ends_with('/') {
                fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(&p).map_err(|e| e.to_string())?;
                    }
                }
                let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
                copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
        
        // Cleanup Zip
        fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    } else {
        // It's an executable, we already saved it as Game.exe
        // No extraction needed.
    }

    // 3. Verify or Create Manifest
    let manifest_path = game_dir.join("manifest.json");
    
    // Always check for executable name if we are creating a manifest
    let mut entry_point = "Game.exe".to_string();
    
    // Try to find the actual executable in the folder
    if let Ok(entries) = fs::read_dir(&game_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    if ext.to_string_lossy().to_lowercase() == "exe" {
                        if let Some(name) = path.file_name() {
                            entry_point = name.to_string_lossy().to_string();
                            // Prefer the one matching game_id or folder_name if possible, but taking first one is safer than "Game.exe"
                            if entry_point.contains(&folder_name) || entry_point.contains(&game_id) {
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    if !manifest_path.exists() {
        // Create a basic manifest if missing
        let manifest_content = format!(
            r#"{{
                "id": "{}",
                "name": "{}",
                "version": "1.0.0",
                "executable": "{}",
                "entryPoint": "{}"
            }}"#,
            game_id, game_name, entry_point, entry_point
        );
        let mut m_file = fs::File::create(&manifest_path).map_err(|e| e.to_string())?;
        m_file.write_all(manifest_content.as_bytes()).map_err(|e| e.to_string())?;
    }

    // 4. Create server_config.txt
    let config_path = game_dir.join("server_config.txt");
    // Always overwrite/create to ensure it has the latest URL
    let mut c_file = fs::File::create(&config_path).map_err(|e| e.to_string())?;
    c_file.write_all(backend_url.as_bytes()).map_err(|e| e.to_string())?;

    let _ = window.emit("install:complete", ProgressPayload {
        game_id: game_id.clone(),
        game_name: game_name.clone(),
        progress: 100,
        status: "complete".to_string(),
    });

    Ok(game_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn select_folder() -> Option<String> {
    let folder = rfd::AsyncFileDialog::new().pick_folder().await;
    folder.map(|f| f.path().to_string_lossy().to_string())
}

#[tauri::command]
pub fn uninstall_game(install_path: String, folder_name: String) -> Result<bool, String> {
    let game_dir = Path::new(&install_path).join("Vext").join(folder_name);
    if game_dir.exists() {
        fs::remove_dir_all(game_dir).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn is_game_installed(install_path: String, folder_name: String) -> bool {
    let manifest_path = Path::new(&install_path)
        .join("Vext")
        .join(folder_name)
        .join("manifest.json");
    manifest_path.exists()
}
