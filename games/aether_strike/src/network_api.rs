use serde::{Deserialize, Serialize};
use reqwest::blocking::Client;

use std::fs;
use std::net::UdpSocket;

// Default to localhost, but try to read from config file
pub fn get_api_url() -> String {
    if let Ok(url) = fs::read_to_string("server_config.txt") {
        let mut trimmed = url.trim().to_string();
        if trimmed.ends_with("/api") {
            trimmed = trimmed.replace("/api", "");
        }
        if trimmed.ends_with('/') {
            trimmed.pop(); 
        }

        if !trimmed.is_empty() {
             return format!("{}/api/lobby/multiplayer", trimmed);
        }
    }
    "https://vext-backend-gur7.onrender.com/api/lobby/multiplayer".to_string()
}

// Get WebSocket URL based on config
pub fn get_ws_url() -> String {
    "wss://vext-ws-server-3jrc.onrender.com/ws".to_string()
}

// Auto-detect local IP (LAN)
pub fn get_local_ip() -> String {
    // Try to bind a UDP socket and connect to external address
    match UdpSocket::bind("0.0.0.0:0") {
        Ok(socket) => {
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
    "127.0.0.1".to_string()
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MultiplayerLobby {
    #[serde(default)]
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
    let client = Client::new();
    let res = client.get(format!("{}/list", api_url)).send();

    match res {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Vec<MultiplayerLobby>>() {
                    Ok(list) => list,
                    Err(_) => Vec::new()
                }
            } else {
                Vec::new()
            }
        },
        Err(_) => Vec::new()
    }
}

pub fn announce_server(name: &str, username: &str, max_players: u32, is_private: bool, password: Option<String>) -> Option<String> {
    let client = Client::new();
    let local_ip = get_local_ip();
    
    let lobby = MultiplayerLobby {
        id: "".to_string(),
        hostUsername: username.to_string(),
        name: name.to_string(),
        ip: local_ip,
        port: 8080,
        maxPlayers: max_players,
        currentPlayers: 1,
        isPrivate: is_private,
        password,
        mapName: "TheNexus".to_string(),
    };

    let api_url = get_api_url();
    let res = client.post(format!("{}/announce", api_url))
        .json(&lobby)
        .send();

    match res {
        Ok(response) => {
            if response.status().is_success() {
                Some("registered".to_string()) 
            } else {
                None
            }
        },
        Err(_) => None
    }
}
