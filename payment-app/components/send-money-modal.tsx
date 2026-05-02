import React, { useState, useEffect } from 'react';
import { 
  View, 
  Platform, 
  Modal as RNModal, 
  KeyboardAvoidingView, 
  TouchableWithoutFeedback, 
  Keyboard,
  ActivityIndicator
} from 'react-native';
import { useBiometricAuth } from '@/hooks/use-biometrics';
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { BlurView } from 'expo-blur';
import { 
  initiatePayment, 
  confirmPayment, 
  type GuardianResult, 
  type Decision 
} from '@/lib/guardian-middleware';
import { useTransactions } from '@/hooks/use-transactions';

type FlowState = 
  | 'idle'           // Form ready for input
  | 'scanning'       // Running network signal checks
  | 'blocked'        // Transaction blocked by Guardian
  | 'challenged'     // Biometric challenge required
  | 'authenticating' // Biometric in progress
  | 'approved'       // Payment went through
  | 'error';         // Something went wrong

interface SendMoneyModalProps {
  visible: boolean;
  onClose: () => void;
  localCurrency?: { code: string; flag: string; symbol: string };
}

export function SendMoneyModal({ visible, onClose, localCurrency = { code: 'ZAR', flag: '🇿🇦', symbol: 'R' } }: SendMoneyModalProps) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [guardianResult, setGuardianResult] = useState<GuardianResult | null>(null);
  const { addTransaction } = useTransactions();
  const { authenticate, capability } = useBiometricAuth();
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  // Fetch exchange rate when modal opens
  useEffect(() => {
    if (!visible) return;
    async function fetchRate() {
      try {
        const apiKey = process.env.EXPO_PUBLIC_EXCHANGE_RATE_API;
        if (!apiKey) return;
        const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`);
        const data = await res.json();
        if (data?.result === 'success' && data.conversion_rates?.[localCurrency.code]) {
          setExchangeRate(data.conversion_rates[localCurrency.code]);
        }
      } catch {}
    }
    fetchRate();
  }, [visible, localCurrency.code]);

  const parsedAmount = parseFloat(amount) || 0;
  const convertedLocal = exchangeRate && parsedAmount > 0
    ? (parsedAmount * exchangeRate).toFixed(2)
    : null;

  const isFormValid = phone.trim().length > 0 && amount.trim().length > 0;
  const isInputLocked = flowState !== 'idle';
  const isSendDisabled = !isFormValid || isInputLocked;

  const resetState = () => {
    setPhone("");
    setAmount("");
    setFlowState('idle');
    setGuardianResult(null);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    resetState();
    onClose();
  };

  const handleBiometric = async () => {
    setFlowState('authenticating');

    try {
      const authResult = await authenticate({
        promptMessage: 'Verify your identity to complete payment',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
      });

      if (authResult.success) {
        const result = await confirmPayment('bio-verified');
        setGuardianResult(result);
        setFlowState('approved');
        addTransaction({
          type: 'sent',
          recipient: phone,
          amount: parseFloat(amount) || 0,
          currency: 'ZAR',
          status: 'success',
        });
      } else {
        setFlowState('challenged'); // Let them retry
      }
    } catch {
      setFlowState('error');
    }
  };

  const handleSend = async () => {
    if (isSendDisabled) return;
    Keyboard.dismiss();
    setFlowState('scanning');

    try {
      const result = await initiatePayment(amount, phone);
      setGuardianResult(result);

      switch (result.decision) {
        case 'APPROVE':
          setFlowState('approved');
          addTransaction({
            type: 'sent',
            recipient: phone,
            amount: parseFloat(amount) || 0,
            currency: 'ZAR',
            status: 'success',
          });
          break;
        case 'CHALLENGE':
          setFlowState('challenged');
          break;
        case 'BLOCK':
          setFlowState('blocked');
          addTransaction({
            type: 'blocked',
            recipient: phone,
            amount: parseFloat(amount) || 0,
            currency: 'ZAR',
            status: 'blocked',
            reason: result.reason,
          });
          break;
        default:
          setFlowState('error');
      }
    } catch {
      setFlowState('error');
    }
  };

  // Dynamic status indicator
  const renderStatus = () => {
    switch (flowState) {
      case 'scanning':
        return (
          <View className="items-center py-4 mb-4">
            <ActivityIndicator size="large" color="#000" />
            <Text className="text-sm font-medium mt-3 text-center opacity-70">
              Scanning 6 network signals...
            </Text>
          </View>
        );

      case 'blocked':
        return (
          <View className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
            <Text className="text-center text-red-600 font-bold text-base mb-1">
              🛡️ Transaction Blocked
            </Text>
            <Text className="text-center text-red-500 text-sm">
              {guardianResult?.humanMessage}
            </Text>
            <Text className="text-center text-red-400 text-xs mt-2 font-mono">
              Reason: {guardianResult?.reason}
            </Text>
          </View>
        );

      case 'challenged':
        return (
          <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
            <Text className="text-center text-amber-700 font-bold text-base mb-1">
              ⚠️ Identity Verification Required
            </Text>
            <Text className="text-center text-amber-600 text-sm">
              {guardianResult?.humanMessage}
            </Text>
          </View>
        );

      case 'authenticating':
        return (
          <View className="items-center py-4 mb-4">
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text className="text-sm font-medium mt-3 text-center opacity-70">
              Waiting for biometric verification...
            </Text>
          </View>
        );

      case 'approved':
        return (
          <View className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
            <Text className="text-center text-green-600 font-bold text-base mb-1">
              ✓ Payment Successful
            </Text>
            <Text className="text-center text-green-500 text-sm">
              {guardianResult?.humanMessage}
            </Text>
            {guardianResult?.txnId && (
              <Text className="text-center text-green-400 text-xs mt-2 font-mono">
                TXN: {guardianResult.txnId}
              </Text>
            )}
          </View>
        );

      case 'error':
        return (
          <View className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
            <Text className="text-center text-red-600 font-bold text-base">
              Something went wrong. Please try again.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  // Dynamic button rendering based on flow state
  const renderActions = () => {
    if (flowState === 'scanning' || flowState === 'authenticating') {
      return null; // Hide buttons during processing
    }

    if (flowState === 'challenged') {
      return (
        <View className="flex-row gap-3">
          <Button 
            onPress={handleClose} 
            variant="outline"
            className="flex-1 h-14 rounded-xl bg-white/50 border-gray-200"
          >
            <Text className="font-semibold text-black text-lg">Cancel</Text>
          </Button>
          <Button 
            onPress={handleBiometric}
            className="flex-1 h-14 rounded-xl bg-amber-500"
          >
            <Text className="text-white font-semibold text-lg">🔐 {capability.label}</Text>
          </Button>
        </View>
      );
    }

    if (flowState === 'approved' || flowState === 'blocked' || flowState === 'error') {
      return (
        <Button 
          onPress={handleClose}
          className="h-14 rounded-xl bg-black"
        >
          <Text className="text-white font-semibold text-lg">Done</Text>
        </Button>
      );
    }

    // Default: idle state
    return (
      <View className="flex-row gap-3">
        <Button 
          onPress={handleClose} 
          variant="outline"
          className="flex-1 h-14 rounded-xl bg-white/50 border-gray-200"
        >
          <Text className="font-semibold text-black text-lg">Cancel</Text>
        </Button>
        <Button 
          onPress={handleSend} 
          disabled={isSendDisabled}
          className={`flex-1 h-14 rounded-xl ${isSendDisabled ? 'bg-black/30' : 'bg-black'}`}
        >
          <Text className={`font-semibold text-lg ${isSendDisabled ? 'text-white/50' : 'text-white'}`}>Send</Text>
        </Button>
      </View>
    );
  };

  return (
    <RNModal 
      visible={visible} 
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <BlurView 
            intensity={80} 
            tint="systemMaterialDark" 
            className="flex-1 justify-center p-5"
          >
            <TouchableWithoutFeedback>
              <View className="bg-white/90 p-6 rounded-[32px] shadow-2xl border border-white/20">
                <Text className="text-2xl font-bold mb-6 text-center">SEND CASH</Text>
                
                <Input
                  placeholder="Mobile Number"
                  placeholderTextColor="#999"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!isInputLocked}
                  className="mb-4 bg-white/70 border-white/50 rounded-xl h-14 px-4 text-lg"
                />
                
                <Input
                  placeholder="Amount (USD)"
                  placeholderTextColor="#999"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  editable={!isInputLocked}
                  className="mb-4 bg-white/70 border-white/50 rounded-xl h-14 px-4 text-lg"
                />

                {convertedLocal && (
                  <View className="bg-black/5 rounded-xl px-4 py-2.5 mb-6 flex-row justify-between items-center">
                    <Text className="text-sm opacity-60">≈ {localCurrency.code} equivalent</Text>
                    <Text className="text-base font-bold">{localCurrency.symbol}{parseFloat(convertedLocal).toLocaleString()}</Text>
                  </View>
                )}

                {renderStatus()}
                {renderActions()}
              </View>
            </TouchableWithoutFeedback>
          </BlurView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </RNModal>
  );
}
