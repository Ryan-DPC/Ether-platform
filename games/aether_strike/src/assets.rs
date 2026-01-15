use macroquad::prelude::*;
use std::collections::HashMap;
use crate::class_system::CharacterClass;

pub struct GameAssets {
    pub sprite_sheet: Texture2D,
    pub class_sprites: HashMap<String, Texture2D>,
    pub class_metadata: HashMap<String, (u32, u32, u32, f32, f32)>, // frames_x, frames_y, frame_index, top_padding_ratio, center_x_ratio
}

impl GameAssets {
    pub async fn load(all_classes: &[CharacterClass]) -> Self {
        // Character sheet (for legacy or generic)
        let sprite_sheet = load_texture("assets/characters.png").await.unwrap_or_else(|_| {
            Texture2D::from_rgba8(8, 8, &[255; 256])
        });
        sprite_sheet.set_filter(FilterMode::Nearest);

        let mut class_sprites = HashMap::new();
        let mut class_metadata = HashMap::new();
        
        // Load individual sprites for each class
        for cls in all_classes {
            let possible_paths = [
                format!("assets/{}", cls.sprite_path.split('/').last().unwrap_or("")),
                format!("assets/{}", cls.sprite_path),
                cls.sprite_path.clone(),
                format!("../{}", cls.sprite_path),
            ];

            for path_str in possible_paths {
                if let Ok(mut img) = load_image(&path_str).await {
                    // 1. Chroma Key: Remove White Background
                    for y in 0..img.height {
                        for x in 0..img.width {
                             let p = img.get_pixel(x as u32, y as u32);
                             if p.r > 0.9 && p.g > 0.9 && p.b > 0.9 && p.a > 0.5 {
                                 img.set_pixel(x as u32, y as u32, Color::new(0.0, 0.0, 0.0, 0.0));
                             }
                        }
                    }

                     // Calculate Auto-Trim
                     let width = img.width as usize;
                     let height = img.height as usize;
                     
                     let fw = width / cls.sprite_frames_x as usize;
                     let fh = height / cls.sprite_frames_y as usize;
                     let fidx = cls.sprite_frame_index as usize;
                     
                     let start_x = (fidx % cls.sprite_frames_x as usize) * fw;
                     let start_y = (fidx / cls.sprite_frames_x as usize) * fh;
                     
                     let mut first_pixel_y = 0;
                     let mut min_x = fw;
                     let mut max_x = 0;
                     
                     'scan_y: for y in 0..fh {
                         for x in 0..fw {
                             if start_x + x < width && start_y + y < height {
                                 let p = img.get_pixel((start_x + x) as u32, (start_y + y) as u32);
                                 if p.a > 0.0 {
                                     if first_pixel_y == 0 { first_pixel_y = y; }
                                     if x < min_x { min_x = x; }
                                     if x > max_x { max_x = x; }
                                 }
                             }
                         }
                     }
                     
                     let top_padding_ratio = first_pixel_y as f32 / fh as f32;
                     let center_x_mean = (min_x + max_x) as f32 / 2.0;
                     let center_x_ratio = center_x_mean / fw as f32;
                     
                     println!("  ✂️ Auto-Trim for {}: Top={}, Range X={}-{} (Center Ratio: {:.2})", cls.name, first_pixel_y, min_x, max_x, center_x_ratio);

                    let tex = Texture2D::from_image(&img);
                    tex.set_filter(FilterMode::Nearest);
                    class_sprites.insert(cls.name.to_lowercase(), tex);
                    class_metadata.insert(cls.name.to_lowercase(), (cls.sprite_frames_x, cls.sprite_frames_y, cls.sprite_frame_index, top_padding_ratio, center_x_ratio));
                    break;
                }
            }
        }

        Self {
            sprite_sheet,
            class_sprites,
            class_metadata,
        }
    }

    /// Returns classes sprite or default from sheet
    pub fn get_class_texture<'a>(&'a self, class_name: &str) -> &'a Texture2D {
        self.class_sprites.get(&class_name.to_lowercase()).unwrap_or(&self.sprite_sheet)
    }

    /// Returns the source rect for a given class and animation frame
    pub fn get_sprite_rect(&self, class_name: &str, _frame_idx: u32) -> Rect {
        if let Some(tex) = self.class_sprites.get(&class_name.to_lowercase()) {
            let (fx, fy, fidx, _, _) = self.class_metadata.get(&class_name.to_lowercase()).unwrap_or(&(1, 1, 0, 0.0, 0.0));
            let fw = tex.width() / *fx as f32;
             let fh = tex.height() / *fy as f32;
             
             let x = (*fidx % *fx) as f32 * fw;
             let y = (*fidx / *fx) as f32 * fh;

             Rect::new(x, y, fw, fh)
        } else {
             // FALLBACK: Use the old characters.png logic
             // Hardcoded legacy mapping
             let class_idx = match class_name.to_lowercase().as_str() {
                 "archer" => 0,
                 "enemy" | "boss" | "orc" => 1,
                 "mage" => 2,
                 "warrior" => 3,
                 _ => 1, // Default to orc if unknown and no file found
             };
             
             let rows = 4.0;
             let cols = 6.0;
             let sprite_width = self.sprite_sheet.width() / cols;
             let sprite_height = self.sprite_sheet.height() / rows;

             Rect::new(0.0, class_idx as f32 * sprite_height, sprite_width, sprite_height)
        }
    }

    pub fn get_enemy_rect(&self, frame_idx: u32) -> Rect {
        let sprite_height = self.sprite_sheet.height() / 4.0;
        let sprite_width = self.sprite_sheet.width() / 6.0;
        Rect::new(frame_idx as f32 * sprite_width, 1.0 * sprite_height, sprite_width, sprite_height)
    }

    pub fn get_top_padding(&self, class_name: &str) -> f32 {
        if let Some((_, _, _, ratio, _)) = self.class_metadata.get(&class_name.to_lowercase()) {
            *ratio
        } else {
            0.0
        }
    }

    pub fn get_center_x_ratio(&self, class_name: &str) -> f32 {
        if let Some((_, _, _, _, ratio)) = self.class_metadata.get(&class_name.to_lowercase()) {
            *ratio
        } else {
            0.5
        }
    }
}
