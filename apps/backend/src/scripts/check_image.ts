import axios from 'axios';

const urls = [
  'https://raw.githubusercontent.com/Ryan-DPC/vext-platform/main/games/aether_strike/banner.png',
  'https://raw.githubusercontent.com/Ryan-DPC/Vext-platform/main/games/aether_strike/banner.png',
  'https://raw.githubusercontent.com/Ryan-DPC/vext-platform/dev/games/aether_strike/banner.png',
  'https://raw.githubusercontent.com/Ryan-DPC/Vext-platform/dev/games/aether_strike/banner.png',
];

async function check() {
  for (const url of urls) {
    try {
      const res = await axios.head(url);
      if (res.status === 200) {
        console.log(`✅ FOUND: ${url}`);
      }
    } catch (e: any) {
      console.log(`❌ ${url} - ${e.response?.status || e.message}`);
    }
  }
}
check();
