async function verifyBiometricSession(userData) {
  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (userData.isFeaturePhone) {
    return { success: false, action: 'PIN_CHALLENGE' };
  }

  return {
    success: true,
    bio_token: 'mock_token_123',
    status: 'Approved',
  };
}

export { verifyBiometricSession };
