import NetworkAsCode from 'network-as-code';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export async function checkLocationVerify(phoneNumber, scenario, targetLocation) {
  if (process.env.MOCK_MODE === 'true') {
    if (scenario === 'location_anomaly' || scenario === 'network_attack_window' || scenario === 'full_attack') {
      return { withinGeofence: false, country: 'UNKNOWN' };
    }
    return { withinGeofence: true, country: 'ZA' };
  }

  try {
    const client = new NetworkAsCode.NetworkAsCodeClient(process.env.NOKIA_API_KEY);
    const device = client.devices.get({ phoneNumber });
    
    // Representative API method for Device Location / Geofencing
    // Provide a default if targetLocation is missing
    const loc = targetLocation || { latitude: -26.2041, longitude: 28.0473, radius: 10000 }; 
    const isWithin = await device.verifyLocation(loc);
    
    return { withinGeofence: isWithin, country: 'ZA' };
  } catch (error) {
    console.error('Location Verify API Error:', error);
    return { withinGeofence: true, country: 'ZA' };
  }
}
