import NetworkAsCode from 'network-as-code';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export async function checkSimSwap(phoneNumber, scenario) {
  if (process.env.MOCK_MODE === 'true') {
    if (scenario === 'recent_sim_swap' || scenario === 'network_attack_window' || scenario === 'full_attack') {
      return { recentChange: true, lastSwapDate: new Date().toISOString() };
    }
    return { recentChange: false, lastSwapDate: null };
  }

  try {
    const client = new NetworkAsCode.NetworkAsCodeClient(process.env.NOKIA_API_KEY);
    const device = client.devices.get({ phoneNumber });
    // Assuming maxAge in hours or days, let's say 240 hours (10 days)
    const wasSwapped = await device.verifySimSwap({ maxAge: 240 });
    return { recentChange: wasSwapped, lastSwapDate: wasSwapped ? new Date().toISOString() : null };
  } catch (error) {
    console.error('SIM Swap API Error:', error);
    return { recentChange: false, lastSwapDate: null };
  }
}
