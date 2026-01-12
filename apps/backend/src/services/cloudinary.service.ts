import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs/promises';
import path from 'path';

// Mock Cache for now
const mockCache = {
  isEnabled: () => false,
  getManifestsList: async () => null,
  setManifestsList: async (data: any) => {},
  getManifest: async (id: string) => null,
  setManifest: async (id: string, data: any) => {},
  clearAll: async () => {},
};

export class CloudinaryService {
  private enabled = false;
  private static initialized = false;
  private slugPrices: any = {};

  constructor() {
    const cloudinaryUrl = process.env.CLOUDINARY_URL;

    if (cloudinaryUrl) {
      cloudinary.config({
        cloudinary_url: cloudinaryUrl,
      });
      this.enabled = true;
      if (!CloudinaryService.initialized) {
        console.log('[Cloudinary] ✅ Cloudinary configured via CLOUDINARY_URL');
        CloudinaryService.initialized = true;
      }
    } else {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (cloudName && apiKey && apiSecret) {
        cloudinary.config({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
        });
        this.enabled = true;
        if (!CloudinaryService.initialized) {
          console.log('[Cloudinary] ✅ Cloudinary configured via variables');
          CloudinaryService.initialized = true;
        }
      } else {
        this.enabled = false;
        if (!CloudinaryService.initialized) {
          console.warn('[Cloudinary] ⚠️ Cloudinary not configured');
          CloudinaryService.initialized = true;
        }
      }
    }
  }

  async uploadFile(filePath: string, publicId: string, options: any = {}) {
    if (!this.enabled) throw new Error('Cloudinary not configured');

    try {
      const result = await cloudinary.uploader.upload(filePath, {
        public_id: publicId,
        resource_type: 'auto',
        overwrite: true,
        ...options,
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        version: result.version,
        format: result.format,
        bytes: result.bytes,
      };
    } catch (error: any) {
      console.error(`[Cloudinary] Error uploading ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async uploadBuffer(buffer: Buffer, publicId: string, options: any = {}) {
    if (!this.enabled) throw new Error('Cloudinary not configured');

    return new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            public_id: publicId,
            resource_type: 'auto',
            overwrite: true,
            ...options,
          },
          (error, result) => {
            if (error) reject(error);
            else
              resolve({
                url: result!.secure_url,
                publicId: result!.public_id,
                version: result!.version,
                format: result!.format,
                bytes: result!.bytes,
              });
          }
        )
        .end(buffer);
    });
  }

  async getBaseUrl() {
    if (!this.enabled) return null;
    const config = cloudinary.config();
    const cloudName = config.cloud_name || this.extractCloudNameFromUrl();
    if (!cloudName) return null;
    return `https://res.cloudinary.com/${cloudName}`;
  }

  extractCloudNameFromUrl() {
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    if (!cloudinaryUrl) return null;
    const match = cloudinaryUrl.match(/@([^/]+)/);
    return match ? match[1] : null;
  }

  getPublicUrl(publicId: string, resourceType = 'raw') {
    if (!this.enabled) return null;
    const config = cloudinary.config();
    const cloudName =
      config.cloud_name || process.env.CLOUDINARY_CLOUD_NAME || this.extractCloudNameFromUrl();
    if (!cloudName) return null;
    return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${publicId}`;
  }

  getSignedUrl(publicId: string, resourceType = 'raw', version: string | null = null) {
    if (!this.enabled) return null;
    try {
      const config = cloudinary.config();
      const apiKey = config.api_key || process.env.CLOUDINARY_API_KEY;
      const apiSecret = config.api_secret || process.env.CLOUDINARY_API_SECRET;

      if (!apiKey || !apiSecret) {
        console.error('[Cloudinary] Missing API Key or Secret for signing');
        return null;
      }

      if (resourceType === 'raw') {
        const extension = publicId.split('.').pop();
        const format = extension !== publicId ? extension : '';

        const url = cloudinary.utils.private_download_url(publicId, format || '', {
          resource_type: resourceType,
          type: 'upload',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          attachment: true,
        } as any);

        return url;
      }

      const options: any = {
        resource_type: resourceType,
        type: 'upload',
        sign_url: true,
        secure: true,
      };

      if (version) {
        options.version = version;
      }

      return cloudinary.url(publicId, options);
    } catch (error: any) {
      console.error(`[Cloudinary] Error signing URL: ${error.message}`);
      return null;
    }
  }

  async listGamesMetadata(clearCache = false) {
    if (!this.enabled) throw new Error('Cloudinary not configured');

    if (!clearCache && mockCache.isEnabled()) {
      const cached = await mockCache.getManifestsList();
      if (cached) return cached;
    }

    try {
      let allResources: any[] = [];
      let nextCursor = null;

      do {
        const result = await cloudinary.api.resources({
          type: 'upload',
          resource_type: 'raw',
          prefix: 'games/',
          max_results: 500,
          next_cursor: nextCursor,
        } as any);

        allResources = allResources.concat(result.resources);
        nextCursor = result.next_cursor;
      } while (nextCursor);

      const metadataFiles = allResources.filter((r: any) => r.public_id.endsWith('/metadata.json'));

      if (metadataFiles.length === 0) {
        // logger.warn
        console.warn('[Cloudinary] ⚠️ No metadata.json files found in "games/" folder.');
      }

      const gamesMetadata = await Promise.all(
        metadataFiles.map(async (resource: any) => {
          try {
            const parts = resource.public_id.split('/');
            if (parts.length < 3) return null;
            const folderName = parts[parts.length - 2];

            const url = resource.secure_url;
            const response = await fetch(url);
            if (!response.ok) return null;
            const metadata = await response.json();

            return {
              id: folderName,
              folderName: folderName,
              ...metadata,
              metadataUrl: url,
              updatedAt: resource.updated_at,
            };
          } catch (err: any) {
            console.error(
              `[Cloudinary] Error fetching metadata for ${resource.public_id}: ${err.message}`
            );
            return null;
          }
        })
      );

      const validGames = gamesMetadata.filter((g: any) => g !== null);

      return validGames;
    } catch (error: any) {
      console.error(`[Cloudinary] Error listing games metadata: ${error.message}`);
      throw error;
    }
  }

  async getGameMetadata(folderName: string) {
    if (!this.enabled) throw new Error('Cloudinary not configured');

    try {
      const publicId = `games/${folderName}/metadata.json`;
      const url = this.getPublicUrl(publicId, 'raw');
      if (!url) throw new Error('Could not generate url');

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Metadata not found: ${response.status}`);

      const metadata = await response.json();
      return metadata;
    } catch (error: any) {
      console.error(`[Cloudinary] Error getting metadata for ${folderName}: ${error.message}`);
      throw error;
    }
  }

  async getAllGames(clearCache = false) {
    if (!this.enabled) throw new Error('Cloudinary not configured');

    try {
      const gamesMetadata = await this.listGamesMetadata(clearCache);

      const games = gamesMetadata.map((meta: any) => {
        const fallbackUrl = this.getPublicUrl(`games/${meta.folderName}/cover.jpg`, 'image');
        const coverUrl = meta.image_url || fallbackUrl;

        return {
          id: meta.folderName,
          game_name: meta.name || meta.folderName,
          folder_name: meta.folderName,
          description: meta.description || '',
          image_url: coverUrl,
          status: 'disponible',
          genre: meta.genre || (meta.tags && meta.tags[0]) || 'Undefined',
          max_players: meta.max_players || 1,
          is_multiplayer:
            meta.is_multiplayer !== undefined
              ? meta.is_multiplayer
              : meta.tags
                ? meta.tags.includes('multiplayer')
                : false,
          developer: meta.developer || 'Inconnu',
          price: meta.price || 0,
          version: meta.version || 'latest',
          github_url: meta.github_url,
          tags: meta.tags || [],
          created_at: meta.updatedAt,
          updated_at: meta.updatedAt,
        };
      });

      return games;
    } catch (error: any) {
      console.error(`[Cloudinary] Error fetching all games: ${error.message}`);
      throw error;
    }
  }

  isEnabled() {
    return this.enabled;
  }
}
