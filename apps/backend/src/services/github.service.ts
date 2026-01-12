import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Readable } from 'stream';
// import { pipeline } from 'stream/promises'; // Node 15+
const pipeline = promisify(require('stream').pipeline);

export class GitHubService {
  private baseUrl = 'https://api.github.com';
  private token?: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN;
  }

  /**
   * Parse a GitHub URL to extract owner and repo
   * @param url - e.g. "https://github.com/ryand/ether-game-chess"
   */
  parseUrl(url: string): { owner: string; repo: string } | null {
    if (!url) return null;
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace('.git', '') };
    }
    return null;
  }

  /**
   * Get the latest release for a repository
   */
  async getLatestRelease(owner: string, repo: string) {
    try {
      const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: this.token ? `token ${this.token}` : '',
        },
      });

      let data;

      if (!response.ok) {
        if (response.status === 404) {
          // Try fetching all releases (maybe it's a pre-release)
          console.log(`[GitHub] Latest release not found, checking all releases/tags...`);
          const listResponse = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/releases`, {
            headers: {
              Accept: 'application/vnd.github.v3+json',
              Authorization: this.token ? `token ${this.token}` : '',
            },
          });

          if (listResponse.ok) {
            const list = (await listResponse.json()) as any[];
            if (list && list.length > 0) {
              data = list[0]; // Pick the most recent one
              console.log(`[GitHub] Found most recent release: ${data.tag_name}`);
            } else {
              console.warn(`[GitHub] No releases found in list either.`);
              return null;
            }
          } else {
            console.warn(`[GitHub] No releases found for ${owner}/${repo}`);
            return null;
          }
        } else {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
      } else {
        data = (await response.json()) as any;
      }

      // Find zip or executable
      const zipAsset = data.assets.find(
        (a: any) =>
          a.name.endsWith('.zip') || a.content_type === 'application/zip' || a.name.endsWith('.exe')
      );

      return {
        version: data.tag_name,
        downloadUrl: zipAsset ? zipAsset.browser_download_url : null,
        publishedAt: data.published_at,
        changelog: data.body,
        assets: data.assets,
      };
    } catch (error: any) {
      console.error(`[GitHub] Error fetching release for ${owner}/${repo}:`, error.message);
      throw error;
    }
  }

  /**
   * Get raw file content from repository
   */
  async getRawFile(
    owner: string,
    repo: string,
    filePath: string,
    ref = 'main'
  ): Promise<Buffer | null> {
    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github.v3.raw',
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      console.warn(`[GitHub] Error fetching raw file ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Download a file from a URL to a local destination
   */
  async downloadFile(url: string, destPath: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to download file: ${response.statusText}`);
      if (!response.body) throw new Error('Response body is empty');

      // Ensure directory exists
      await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

      const fileStream = fs.createWriteStream(destPath);
      // Native fetch body is a ReadableStream (Web), convert if necessary or use pipeline

      await pipeline(Readable.fromWeb(response.body), fileStream);

      return destPath;
    } catch (error: any) {
      console.error(`[GitHub] Download error:`, error.message);
      throw error;
    }
  }
}
