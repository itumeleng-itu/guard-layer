/**
 * Minimal client surface used by apps/middleware/src/camara/* when MOCK_MODE=false.
 * Replace with a real Nokia SDK build when dist is available in your environment.
 */
class DeviceFacade {
  constructor(phoneNumber) {
    this.phoneNumber = phoneNumber;
  }

  async verifySimSwap(_opts) {
    return false;
  }

  async getDeviceStatus() {
    return { imeiMatchesLastKnown: true };
  }

  async verifyNumber() {
    return true;
  }

  async verifyLocation(_loc) {
    return true;
  }

  async getKYCStatus() {
    return { synced: true, score: 90 };
  }

  async getQoSProfile() {
    return { congestionLevel: 20 };
  }
}

export class NetworkAsCodeClient {
  constructor(_token, _devMode) {
    this._token = _token;
  }

  get devices() {
    return {
      get: ({ phoneNumber }) => new DeviceFacade(phoneNumber),
    };
  }
}

export default { NetworkAsCodeClient };
