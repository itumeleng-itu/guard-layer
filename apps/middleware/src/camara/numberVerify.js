import NetworkAsCode from 'network-as-code';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export async function checkNumberVerify(phoneNumber, scenario) {
  if (process.env.MOCK_MODE === 'true') {
    if (scenario === 'full_attack') {
      return { verified: false };
    }
    return { verified: true };
  }

  try {
    // Number Verification API
    const client = new NetworkAsCode.NetworkAsCodeClient(process.env.NOKIA_API_KEY);
    const device = client.devices.get({ phoneNumber });
    // Representative API method
    const isVerified = await device.verifyNumber(); 
    return { verified: isVerified };
  } catch (error) {
    console.error('Number Verify API Error:', error);
    return { verified: true };
  }
}
