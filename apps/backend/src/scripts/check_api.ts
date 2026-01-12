import axios from 'axios';

const checkApi = async () => {
  try {
    const res = await axios.get('http://localhost:3000/games/all');
    const games = Array.isArray(res.data) ? res.data : res.data.games || [];
    const found = games.find((g: any) => g.folder_name === 'aether_strike');

    if (found) {
      console.log('✅ Found Aether Strike in API response!');
      console.log('Status:', found.status);
    } else {
      console.log('❌ Aether Strike NOT found in API response.');
      console.log('Total games returned:', games.length);
      console.log('Names:', games.map((g: any) => g.game_name).join(', '));
    }
  } catch (error: any) {
    console.error('❌ Failed to call API:', error.message);
  }
};
checkApi();
