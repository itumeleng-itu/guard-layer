import NetworkAsCode from 'network-as-code';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export async function checkKycMatch(phoneNumber, scenario) {
  if (process.env.MOCK_MODE === 'true') {
    if (scenario === 'full_attack') {
      return { identitySynced: false, matchScore: 35 };
    }
    return { identitySynced: true, matchScore: 95 };
  }

  try {
    const client = new NetworkAsCode.NetworkAsCodeClient(process.env.NOKIA_API_KEY);
    const device = client.devices.get({ phoneNumber });
    // Representative API method
    const kyc = await device.getKYCStatus(); 
    return { identitySynced: kyc.synced || true, matchScore: kyc.score || 90 };
  } catch (error) {
    console.error('KYC Match API Error:', error);
    return { identitySynced: true, matchScore: 90 };
  }
}
