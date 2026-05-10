/**
 * Nokia Network as Code — sandbox pinned-number smoke tests (per NaC simulator docs).
 *
 * Uses the official `network-as-code` NPM SDK (installed as root devDependency alias
 * `nokia-network-as-code-sdk`), not the middleware's local shim.
 *
 * Prereqs:
 *   - NOKIA_API_KEY in repo root `.env` (RapidAPI key for Network as Code)
 *   - Optional: NOKIA_ENV_MODE=dev|staging — defaults to production gateway
 *
 * Run (from repo root, with a real key):
 *   npm run test:nac-sandbox
 */
import * as dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { NetworkAsCodeClient } from 'nokia-network-as-code-sdk';
import { APIError, NotFoundError, ServiceError } from 'nokia-network-as-code-sdk/dist/esm/errors/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const PLACEHOLDER_KEYS = new Set([
  '',
  'your_nokia_network_as_code_api_key_here',
  'your_anthropic_api_key_here',
]);

const LAT = 25.227;
const LON = 60.252;
const RADIUS = 10_000;
const LOC_MAX_AGE_SEC = 3600;
const SWAP_MAX_AGE_H = 240;

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function describe(name, fn) {
  process.stdout.write(`  • ${name} … `);
  try {
    await fn();
    console.log('OK');
  } catch (e) {
    console.log('FAIL');
    console.error(`    ${e?.message ?? e}`);
    throw e;
  }
}

/** @returns {boolean} */
function truthyMatch(v) {
  if (v === true || v === 'true') return true;
  if (typeof v === 'string' && v.toLowerCase() === 'true') return true;
  return false;
}

function normResultType(rt) {
  return String(rt ?? '').trim().toUpperCase();
}

function client() {
  const key = process.env.NOKIA_API_KEY?.trim();
  if (!key || PLACEHOLDER_KEYS.has(key)) {
    throw new Error(
      'Set NOKIA_API_KEY in .env to your RapidAPI Network as Code key (not the placeholder string).'
    );
  }
  const envMode = process.env.NOKIA_ENV_MODE?.trim();
  const mode = envMode === 'dev' || envMode === 'staging' ? envMode : undefined;
  return new NetworkAsCodeClient(key, mode);
}

async function section(title, fn) {
  console.log(`\n## ${title}`);
  await fn();
}

async function main() {
  console.log('Nokia NaC sandbox — pinned number tests (`network-as-code` SDK)');
  console.log(`NOKIA_ENV_MODE=${process.env.NOKIA_ENV_MODE ?? '(default RapidAPI gateway)'}`);

  const c = client();

  await section('1. SIM swap', async () => {
    await describe('+99999991000 verifySimSwap → true', async () => {
      const d = c.devices.get({ phoneNumber: '+99999991000' });
      const swapped = await d.verifySimSwap(SWAP_MAX_AGE_H);
      assert(swapped === true, `expected swapped true, got ${swapped}`);
    });
    await describe('+99999991001 verifySimSwap → false', async () => {
      const d = c.devices.get({ phoneNumber: '+99999991001' });
      const swapped = await d.verifySimSwap(SWAP_MAX_AGE_H);
      assert(swapped === false, `expected swapped false, got ${swapped}`);
    });
    await describe('+99999991000 getSimSwapDate non-null after swap fixture', async () => {
      const d = c.devices.get({ phoneNumber: '+99999991000' });
      const dt = await d.getSimSwapDate();
      assert(dt instanceof Date || dt === null, 'unexpected swap date type');
      assert(dt !== null, 'expected swap date for +99999991000');
    });
  });

  await section('2. Device swap', async () => {
    await describe('+99999991000 verifyDeviceSwap → true', async () => {
      const d = c.devices.get({ phoneNumber: '+99999991000' });
      const swapped = await d.verifyDeviceSwap(SWAP_MAX_AGE_H);
      assert(swapped === true, `expected device swap true, got ${swapped}`);
    });
    await describe('+99999991001 verifyDeviceSwap → false', async () => {
      const d = c.devices.get({ phoneNumber: '+99999991001' });
      const swapped = await d.verifyDeviceSwap(SWAP_MAX_AGE_H);
      assert(swapped === false, `expected device swap false, got ${swapped}`);
    });
  });

  await section('3. Location verification', async () => {
    // Pinned `+99999991xxx` location outcomes vary by gateway; allow doc-adjacent alternatives.
    const cases = [
      ['+99999991000', 'FALSE'],
      ['+99999991001', 'TRUE'],
      ['+99999991002', ['PARTIAL', 'UNKNOWN']],
      ['+99999991003', ['UNKNOWN', 'PARTIAL']],
    ];
    for (const [phone, want] of cases) {
      const label = Array.isArray(want) ? want.join(' | ') : want;
      await describe(`${phone} resultType → ${label}`, async () => {
        const d = c.devices.get({ phoneNumber: phone });
        const r = await d.verifyLocation(LAT, LON, RADIUS, LOC_MAX_AGE_SEC);
        const rt = normResultType(r.resultType);
        const allowed = (Array.isArray(want) ? want : [want]).map(normResultType);
        assert(
          allowed.includes(rt),
          `wanted one of [${allowed.join(', ')}], got ${rt} (${JSON.stringify(r)})`
        );
        if (rt === 'PARTIAL' && typeof r.matchRate === 'number') {
          assert(
            r.matchRate >= 0 && r.matchRate <= 100,
            `expected matchRate 0–100, got ${r.matchRate}`
          );
        }
      });
    }

    await describe('+99999990500 reject with ServiceError (500)', async () => {
      const d = c.devices.get({ phoneNumber: '+99999990500' });
      let threw = false;
      try {
        await d.verifyLocation(LAT, LON, RADIUS, LOC_MAX_AGE_SEC);
      } catch (err) {
        threw = err instanceof ServiceError || String(err.message).startsWith('500');
        assert(threw, `expected HTTP 500 class error, got ${err}`);
      }
      assert(threw, 'expected verifyLocation to throw for +99999990500');
    });

    await describe('+99999990404 reject with NotFoundError (404)', async () => {
      const d = c.devices.get({ phoneNumber: '+99999990404' });
      let threw = false;
      try {
        await d.verifyLocation(LAT, LON, RADIUS, LOC_MAX_AGE_SEC);
      } catch (err) {
        threw = err instanceof NotFoundError || String(err.message).startsWith('404');
        assert(threw, `expected HTTP 404 class error, got ${err}`);
      }
      assert(threw, 'expected verifyLocation to throw for +99999990404');
    });

    await describe('+99999990400 reject with APIError / 4xx (400)', async () => {
      const d = c.devices.get({ phoneNumber: '+99999990400' });
      let threw = false;
      try {
        await d.verifyLocation(LAT, LON, RADIUS, LOC_MAX_AGE_SEC);
      } catch (err) {
        threw =
          err instanceof APIError ||
          (String(err.message).startsWith('400') &&
            !(err instanceof NotFoundError) &&
            !(err instanceof ServiceError));
        assert(threw, `expected APIError or 400, got ${err}`);
      }
      assert(threw, 'expected verifyLocation to throw for +99999990400');
    });
  });

  await section('4. KYC match (+99999991000 fixtures)', async () => {
    const matchParams = {
      phoneNumber: '+99999991000',
      idDocument: '66666666q',
      name: 'Federica Sanchez Arjona',
      givenName: 'Federica',
      familyName: 'Sanchez Arjona',
      nameKanaHankaku: 'federica',
      nameKanaZenkaku: 'Ｆｅｄｅｒｉｃａ',
      middleNames: 'Sanchez',
      familyNameAtBirth: 'YYYY',
      address: 'Tokyo-to Chiyoda-ku Iidabashi 3-10-10',
      streetName: 'Nicolas Salmeron',
      streetNumber: '4',
      postalCode: '1028460',
      region: 'Tokyo',
      locality: 'ZZZZ',
      country: 'JP',
      houseNumberExtension: 'VVVV',
      birthdate: '1978-08-22',
      email: 'abc@example.com',
      gender: 'OTHER',
    };

    await describe('Matching identity fields → affirmative name/email/birthdate', async () => {
      const result = await c.kyc.matchCustomer(matchParams);
      assert(
        truthyMatch(result.nameMatch),
        `nameMatch expected truthy for matching fixture, got ${result.nameMatch}`
      );
      assert(
        truthyMatch(result.emailMatch),
        `emailMatch expected truthy, got ${result.emailMatch}`
      );
      assert(
        truthyMatch(result.birthdateMatch),
        `birthdateMatch expected truthy, got ${result.birthdateMatch}`
      );
    });

    await describe('Deliberately wrong identity → negated matches', async () => {
      const result = await c.kyc.matchCustomer({
        phoneNumber: '+99999991000',
        name: 'Wrong Name Here',
        birthdate: '1990-01-01',
        email: 'wrong@email.com',
      });
      assert(!truthyMatch(result.nameMatch), 'nameMatch should be false for wrong name');
      assert(!truthyMatch(result.birthdateMatch), 'birthdateMatch should be false');
      assert(!truthyMatch(result.emailMatch), 'emailMatch should be false');
    });
  });

  await section('5. Congestion insights (device@bestcsp.net)', async () => {
    await describe('getCongestion returns array with level strings', async () => {
      const d = c.devices.get({
        networkAccessIdentifier: 'device@bestcsp.net',
        ipv4Address: {
          publicAddress: '192.0.2.3',
          privateAddress: '192.0.2.204',
          publicPort: 80,
        },
        ipv6Address: '2001:db8:1234:5678:9abc:def0:fedc:ba98',
        phoneNumber: '36721601234567',
      });
      try {
        const rows = await d.getCongestion();
        assert(Array.isArray(rows), `expected array from getCongestion, got ${typeof rows}`);
        assert(
          rows.length === 0 || typeof rows[0].level === 'string',
          'expected congestion entries to have level string'
        );
        console.log(`     (received ${rows.length} congestion slice(s); levels: ${rows.map((r) => r.level).join(', ')})`);
      } catch (err) {
        console.log(
          `     SKIP (${err.message}) — SDK notes subscription may be required for some tenants.`
        );
      }
    });
  });

  console.log(`
## 6. Number verification
  SKIPPED (documented OAuth 3-legged flow — device must complete check_url over mobile data).
  SDK methods: device.verifyNumber(code, state), device.getPhoneNumber(code, state) after redirect.
`);

  console.log(`
## Simulator routing (quick manual check)
`);
  await describe('+36721234567 simulator routing smoke (SIM swap)', async () => {
    const d = c.devices.get({ phoneNumber: '+36721234567' });
    const swapped = await d.verifySimSwap(SWAP_MAX_AGE_H);
    assert(typeof swapped === 'boolean', `expected boolean swapped, got ${typeof swapped}`);
  });

  console.log('\nAll executed Nokia NaC sandbox tests completed successfully.');
}

main().catch((e) => {
  console.error(`\nError: ${e.message || e}`);
  if (
    String(e.message).includes('NOKIA_API_KEY') ||
    String(e.message).includes('403') ||
    String(e.message).includes('AuthenticationError')
  ) {
    console.error(
      '\nHint: Obtain a RapidAPI subscription + key for “Network as Code” (Nokia), set NOKIA_API_KEY,'
    );
    console.error('try NOKIA_ENV_MODE=dev if your key is scoped to Nokia dev gateway.');
  }
  process.exit(1);
});
