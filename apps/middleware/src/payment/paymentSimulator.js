async function processSTKPush(phoneNumber, amount) {
  console.log(`Initiating STK Push to ${phoneNumber} for R${amount}...`);

  // Simulate waiting for user to enter PIN (3 seconds)
  await new Promise(resolve => setTimeout(resolve, 3000));

  return {
    status: 'Completed',
    txn_id: 'TXN-' + Math.random().toString(36).toUpperCase().substring(2, 10)
  };
}

export { processSTKPush };