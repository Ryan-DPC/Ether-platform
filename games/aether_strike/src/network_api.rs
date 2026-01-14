use serde::{Deserialize, Serialize};
use reqwest::blocking::Client;

use std::fs;
use std::net::UdpSocket;

// Default to localhost, but try to read from config file
pub fn get_api_url() -> String {
    if let Ok(url) = fs::read_to_string("server_config.txt") {
        let trimmed = url.trim().to_string();
        if !trimmed.is_empty() {
             return format!("{}/api/lobby/multiplayer", trimmed);
        }
    }
    "http://localhost:3000/api/lobby/multiplayer".to_string()
}

// Auto-detect local IP (LAN)
pub fn get_local_ip() -> String {
    // Try to bind a UDP socket and connect to external address
    // This forces the OS to select the correct network interface
    match UdpSocket::bind("0.0.0.0:0") {
        Ok(socket) => {
            // Connect to Google DNS (doesn't actually send data)
            if socket.connect("8.8.8.8:80").is_ok() {
                if let Ok(addr) = socket.local_addr() {
                    let ip = addr.ip().to_string();
                    println!("🌐 Detected local IP: {}", ip);
                    return ip;
                }
            }
        }
        Err(e) => {
            println!("⚠️ Failed to detect IP: {}", e);
        }
    }
    
    println!("⚠️ Using fallback IP: 127.0.0.1 (won't work for multiplayer!)");
    "127.0.0.1".to_string()
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MultiplayerLobby {
    #[serde(default)] // ID généré par le serveur
    pub id: String,
    pub hostUsername: String,
    pub name: String,
    pub ip: String,
    pub port: u16,
    pub maxPlayers: u32,
    pub currentPlayers: u32,
    pub isPrivate: bool,
    pub password: Option<String>,
    pub mapName: String,
}

pub fn fetch_server_list() -> Vec<MultiplayerLobby> {
    let api_url = get_api_url();
    println!("Fetching server list from {}...", api_url);
    let client = Client::new();
    let res = client.get(format!("{}/list", api_url)).send();

    match res {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Vec<MultiplayerLobby>>() {
                    Ok(list) => {
                        println!("Found {} servers.", list.len());
                        list
                    },
                    Err(e) => {
                        println!("❌ Error parsing server list: {}", e);
                        Vec::new()
                    }
                }
            } else {
                println!("❌ Backend returned status: {}", response.status());
                Vec::new()
            }
        },
        Err(e) => {
            println!("❌ Network connection error: {}", e);
            Vec::new()
        }
    }
}

pub fn announce_server(name: &str, username: &str, max_players: u32, is_private: bool, password: Option<String>) -> Option<String> {
    let client = Client::new();
    
    // Auto-detect local IP
    let local_ip = get_local_ip();
    
    let lobby = MultiplayerLobby {
        id: "".to_string(), // Server will generate
        hostUsername: username.to_string(),
        name: name.to_string(),
        ip: local_ip, // Auto-detected LAN IP
        port: 8080, // Port du jeu (pas encore utilisé vraiment)
        maxPlayers: max_players,
        currentPlayers: 1,
        isPrivate,
        password,
        mapName: "TheNexus".to_string(),
    };

    println!("Announcing server: {}", name);
    let api_url = get_api_url();
    let res = client.post(format!("{}/announce", api_url))
        .json(&lobby)
        .send();

    match res {
        Ok(response) => {
            if response.status().is_success() {
                // Le serveur retourne { id: "...", ... }
                // On pourrait parser pour choper l'ID
                println!("✅ Server announced successfully!");
                Some("registered".to_string()) 
            } else {
                println!("❌ Failed to announce server: {}", response.status());
                None
            }
        },
        Err(e) => {
            println!("❌ Network error announcing server: {}", e);
            None
        }
    }
}
