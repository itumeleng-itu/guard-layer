/**
 * Local shim for Nokia's `network-as-code` SDK used by GuardLayer middleware.
 * This mirrors the modern SDK surface and ensures all six CAMARA checks are available.
 */
class DeviceFacade {
  constructor(phoneNumber) {
    this.phoneNumber = phoneNumber;
    this._seed = Number(phoneNumber.replace(/\D/g, '').slice(-1)) || 0;
  }

  async verifySimSwap({ maxAgeHours = 240 } = {}) {
    return this._seed === 0;
  }

  async getDeviceStatus() {
    return {
      imeiMatchesLastKnown: this._seed !== 7,
    };
  }

  async verifyNumber() {
    return this._seed !== 1;
  }

  async verifyLocation({ latitude, longitude, radius } = {}) {
    const withinGeofence = this._seed !== 5;
    return withinGeofence;
  }

  async getKYCStatus() {
    return {
      synced: this._seed !== 8,
      score: this._seed === 9 ? 65 : 92,
    };
  }

  async getQoSProfile() {
    return {
      congestionLevel: this._seed > 6 ? 82 : 22,
    };
  }
}

export class NetworkAsCodeClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  get devices() {
    return {
      get: ({ phoneNumber }) => new DeviceFacade(phoneNumber),
    };
  }
}

export default { NetworkAsCodeClient };
