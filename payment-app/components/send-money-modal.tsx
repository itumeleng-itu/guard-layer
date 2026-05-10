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
import type { GuardianResult } from '@/lib/guardian-client';
import {
  confirmGuardianAfterBio,
  initiateGuardianCheck,
  isLiveGuardianEnabled,
  settleFrictionlessPayment,
} from '@/lib/guardian-client';
import { useTransactions } from '@/hooks/use-transactions';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FlowState = 
  | 'idle'           // Form ready for input
  | 'confirming'     // Confirmation dialog
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
  const insets = useSafeAreaInsets();

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

  // Reset if modal is opened again while we are in a final state
  useEffect(() => {
    if (visible && ['approved', 'blocked', 'error'].includes(flowState)) {
      resetState();
    }
  }, [visible, flowState]);

  // Auto-dismiss final toasts after 5 seconds
  useEffect(() => {
    if (['approved', 'blocked', 'error'].includes(flowState)) {
      const timer = setTimeout(() => {
        resetState();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [flowState]);

  const parsedAmount = parseFloat(amount) || 0;
  const convertedLocal = exchangeRate && parsedAmount > 0
    ? (parsedAmount * exchangeRate).toFixed(2)
    : null;

  // Validation for Sub-Saharan African phone numbers
  const isValidPhone = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/\s/g, '');
    const ssaCodes = [
      { code: '+27', length: 12 },  // South Africa
      { code: '+254', length: 13 }, // Kenya
      { code: '+234', length: 14 }, // Nigeria
      { code: '+233', length: 13 }, // Ghana
      { code: '+256', length: 13 }, // Uganda
      { code: '+255', length: 13 }, // Tanzania
      { code: '+250', length: 13 }, // Rwanda
      { code: '+263', length: 13 }, // Zimbabwe
      { code: '+260', length: 13 }, // Zambia
      { code: '+267', length: 12 }, // Botswana
      { code: '+258', length: 13 }, // Mozambique
      { code: '+244', length: 13 }, // Angola
    ];

    if (!cleanPhone.startsWith('+')) return false;
    if (!/^\+[0-9]+$/.test(cleanPhone)) return false;

    // Live middleware (Nokia sandbox, etc.) may use non-SSA E.164 numbers.
    if (isLiveGuardianEnabled()) {
      return cleanPhone.length >= 10 && cleanPhone.length <= 17;
    }

    const match = ssaCodes.find(c => cleanPhone.startsWith(c.code));
    if (!match) return false;
    return cleanPhone.length === match.length;
  };

  const handlePhoneChange = (text: string) => {
    // Only allow plus sign at the start, digits, and spaces
    const formatted = text.replace(/(?!^)\+/g, '').replace(/[^0-9+\s]/g, '');
    setPhone(formatted);
  };

  const isFormValid = isValidPhone(phone) && parsedAmount > 0;
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
    if (flowState === 'idle' || flowState === 'confirming') {
      resetState();
    }
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
        const result = await confirmGuardianAfterBio(amount, phone, guardianResult?.transactionRef);
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

  const handleSend = () => {
    if (isSendDisabled) return;
    Keyboard.dismiss();
    setFlowState('confirming');
  };

  const handleConfirm = () => {
    Keyboard.dismiss();
    setFlowState('scanning');

    const runCheck = async () => {
      try {
        let result = await initiateGuardianCheck(amount, phone);

        if (
          result.decision === 'APPROVE' &&
          isLiveGuardianEnabled() &&
          result.transactionRef
        ) {
          try {
            const settled = await settleFrictionlessPayment(amount, phone, result.transactionRef);
            result = {
              ...result,
              txnId: settled.txnId,
              humanMessage: settled.humanMessage ?? result.humanMessage,
            };
          } catch {
            setGuardianResult(result);
            setFlowState('error');
            return;
          }
        }

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

    // Mock-only pacing so the “scanning” state is visible; live calls finish as fast as the network.
    if (isLiveGuardianEnabled()) {
      void runCheck();
    } else {
      setTimeout(() => void runCheck(), 5000);
    }
  };

  // Dynamic status indicator (inline for loading states)
  const renderInlineStatus = () => {
    if (flowState === 'scanning') {
      return (
        <View className="items-center py-4 mb-4">
          <ActivityIndicator size="large" color="#000" />
          <Text className="text-sm font-medium mt-3 text-center opacity-70">
            Scanning 6 network signals...
          </Text>
        </View>
      );
    }
    
    if (flowState === 'authenticating') {
      return (
        <View className="items-center py-4 mb-4">
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text className="text-sm font-medium mt-3 text-center opacity-70">
            Waiting for biometric verification...
          </Text>
        </View>
      );
    }
    
    return null;
  };

  // Toast notification for final feedback messages
  const renderToast = () => {
    if (!['approved', 'blocked', 'challenged', 'error', 'authenticating'].includes(flowState)) {
      return null;
    }

    let content = null;

    switch (flowState) {
      case 'authenticating':
        content = (
          <View className="items-center py-2">
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text className="text-center text-white text-base mt-3">
              Confirming with GuardLayer…
            </Text>
          </View>
        );
        break;
      case 'blocked':
        content = (
          <View>
            <Text className="text-center text-red-400 font-bold text-lg mb-2">
              🛡️ Transaction Blocked
            </Text>
            <Text className="text-center text-white text-base">
              {guardianResult?.humanMessage}
            </Text>
            <Text className="text-center text-white/50 text-xs mt-3 font-mono">
              Reason: {guardianResult?.reason}
            </Text>
          </View>
        );
        break;
      case 'challenged':
        content = (
          <View>
            <Text className="text-center text-white font-bold text-lg mb-2">
               Verification Required
            </Text>
            <Text className="text-center text-white text-base mb-4">
              {guardianResult?.humanMessage}
            </Text>
            <Button onPress={handleBiometric} className="bg-white rounded-full h-12 px-6 mx-auto w-full">
              <Text className="text-black font-bold text-base"> Verify Identity</Text>
            </Button>
          </View>
        );
        break;
      case 'approved':
        content = (
          <View>
            <Text className="text-center text-green-400 font-bold text-lg mb-2">
              ✓ Payment Successful
            </Text>
            <Text className="text-center text-white text-base">
              {guardianResult?.humanMessage}
            </Text>
          </View>
        );
        break;
      case 'error':
        content = (
          <View>
            <Text className="text-center text-red-400 font-bold text-lg mb-2">
              Error
            </Text>
            <Text className="text-center text-white text-base">
              Something went wrong. Please try again.
            </Text>
          </View>
        );
        break;
    }

    return (
      <Animated.View 
        entering={SlideInUp.duration(400).springify()} 
        exiting={SlideOutUp.duration(300)}
        style={{ position: 'absolute', top: Math.max(insets.top + 16, 40), left: 16, right: 16, zIndex: 9999 }}
      >
        <BlurView
          intensity={90}
          tint="dark"
          style={{ borderRadius: 24, overflow: 'hidden', padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
        >
          {content}
          {flowState !== 'challenged' && (
             <Button onPress={() => setFlowState('idle')} variant="ghost" className="absolute top-2 right-2 w-8 h-8 rounded-full items-center justify-center">
                <Text className="text-white/40 text-xl font-light">×</Text>
             </Button>
          )}
        </BlurView>
      </Animated.View>
    );
  };

  const renderFormContent = () => {
    if (flowState === 'confirming') {
      return (
        <View className="py-2">
          <Text className="text-center text-gray-600 mb-6 text-base">
            Are you sure you want to send {localCurrency.symbol}{parseFloat(convertedLocal || '0').toLocaleString()} (USD {amount}) to {phone}?
          </Text>
        </View>
      );
    }

    return (
      <>
        <Input
          placeholder="+27 Mobile Number"
          placeholderTextColor="#999"
          value={phone}
          onChangeText={handlePhoneChange}
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
      </>
    );
  };

  // Dynamic button rendering based on flow state
  const renderActions = () => {
    if (flowState === 'confirming') {
      return (
        <View className="flex-row gap-3">
          <Button 
            onPress={() => setFlowState('idle')} 
            variant="outline"
            className="flex-1 h-14 rounded-xl bg-white/50 border-gray-200"
          >
            <Text className="font-semibold text-black text-lg">Cancel</Text>
          </Button>
          <Button 
            onPress={handleConfirm}
            className="flex-1 h-14 rounded-xl bg-black"
          >
            <Text className="text-white font-semibold text-lg">Confirm</Text>
          </Button>
        </View>
      );
    }

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
    <>
      <RNModal 
        visible={visible && ['idle', 'confirming', 'scanning', 'authenticating'].includes(flowState)} 
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
                  <Text className="text-2xl font-bold mb-6 text-center">
                    {flowState === 'confirming' ? 'CONFIRM' : 'SEND CASH'}
                  </Text>
                  
                  {renderFormContent()}
                  {renderInlineStatus()}
                  {renderActions()}
                </View>
              </TouchableWithoutFeedback>
            </BlurView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </RNModal>

      {/* Render toast entirely outside the RNModal so it displays when modal is closed */}
      {renderToast()}
    </>
  );
}
