import NetworkAsCode from 'network-as-code';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export async function checkCongestionInsights(phoneNumber, scenario) {
  if (process.env.MOCK_MODE === 'true') {
    if (scenario === 'network_attack_window' || scenario === 'full_attack') {
      return { level: 'critical' };
    }
    return { level: 'normal' };
  }

  try {
    const client = new NetworkAsCode.NetworkAsCodeClient(process.env.NOKIA_API_KEY);
    const device = client.devices.get({ phoneNumber });
    // Representative API method for Quality On Demand / Congestion
    const qos = await device.getQoSProfile(); 
    
    let level = 'normal';
    if (qos.congestionLevel > 80) level = 'critical';
    else if (qos.congestionLevel > 50) level = 'elevated';

    return { level };
  } catch (error) {
    console.error('Congestion Insights API Error:', error);
    return { level: 'normal' };
  }
}
