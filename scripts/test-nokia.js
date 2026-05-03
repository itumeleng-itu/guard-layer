import * as dotenv from 'dotenv';
import { checkSimSwap } from '../apps/middleware/src/camara/simSwap.js';
import { checkDeviceSwap } from '../apps/middleware/src/camara/deviceSwap.js';
import { checkNumberVerify } from '../apps/middleware/src/camara/numberVerify.js';
import { checkLocationVerify } from '../apps/middleware/src/camara/locationVerify.js';
import { checkKycMatch } from '../apps/middleware/src/camara/kycMatch.js';
import { checkCongestionInsights } from '../apps/middleware/src/camara/congestionInsights.js';

dotenv.config();

async function runTests() {
  console.log('--- Nokia CAMARA APIs Test Script ---');
  console.log(`MOCK_MODE: ${process.env.MOCK_MODE}`);
  console.log('Target Scenario: full_attack');
  
  const testNumber = '+358406666666'; // Sandbox number for full_attack
  const scenario = 'full_attack';

  try {
    console.log('\nRunning Parallel Checks...');
    const startTime = Date.now();
    
    const results = await Promise.all([
      checkSimSwap(testNumber, scenario),
      checkDeviceSwap(testNumber, scenario),
      checkNumberVerify(testNumber, scenario),
      checkLocationVerify(testNumber, scenario),
      checkKycMatch(testNumber, scenario),
      checkCongestionInsights(testNumber, scenario)
    ]);

    const duration = Date.now() - startTime;

    console.log('\nResults:');
    console.log('1. SIM Swap:', results[0]);
    console.log('2. Device Swap:', results[1]);
    console.log('3. Number Verify:', results[2]);
    console.log('4. Location Verify:', results[3]);
    console.log('5. KYC Match:', results[4]);
    console.log('6. Congestion Insights:', results[5]);
    
    console.log(`\nAll checks completed in ${duration}ms`);
    console.log('✅ Test Passed');
  } catch (error) {
    console.error('❌ Test Failed:', error);
  }
}

runTests();
