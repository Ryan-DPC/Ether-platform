import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { GitHubService } from '../services/github.service';

async function main() {
  const gh = new GitHubService();
  // Use the repo/branch from the failed command
  const owner = 'Ryan-DPC';
  const repo = 'Vext-platform';
  const path = 'games/aether_strike';

  // We can't list files easily with the current service unless we extended it,
  // but we can try to "downloadObject" or fetch content.
  // Actually `getLatestRelease` was used before.
  // Let's try to fetch the file content directly using the API to see if it exists.
  // Or simpler: checking if REPO is private.

  console.log(`Checking ${owner}/${repo} content...`);

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=dev`;
    const res = await fetch(url);
    if (res.status === 200) {
      console.log(`✅ Contents of ${path}:`);
      const data = await res.json();
      data.forEach((file: any) => console.log(` - ${file.name} (${file.type})`));
    } else {
      console.log(`❌ Folder check failed: ${res.status}`);
    }
  } catch (e: any) {
    console.error(e.message);
  }
}
main();
