import React, { useState } from 'react';
import { 
  View, 
  Platform, 
  Modal as RNModal, 
  KeyboardAvoidingView, 
  TouchableWithoutFeedback, 
  Keyboard 
} from 'react-native';
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { BlurView } from 'expo-blur';

interface SendMoneyModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SendMoneyModal({ visible, onClose }: SendMoneyModalProps) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [sent, setSent] = useState(false);

  const isDisabled = !phone.trim() || !amount.trim() || sent;

  const handleClose = () => {
    Keyboard.dismiss();
    setPhone("");
    setAmount("");
    setSent(false);
    onClose();
  };

  const handleSend = () => {
    if (isDisabled) return;
    setSent(true);
    // TODO: Process payment logic here
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
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!sent}
                  className="mb-4 bg-white/70 border-white/50 rounded-xl h-14 px-4 text-lg"
                />
                
                <Input
                  placeholder="Amount (ZAR)"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  editable={!sent}
                  className="mb-6 bg-white/70 border-white/50 rounded-xl h-14 px-4 text-lg"
                />

                {sent && (
                  <Text className="text-center text-green-600 font-semibold mb-4 text-base">
                    ✓ Payment sent successfully
                  </Text>
                )}

                <View className="flex-row gap-3">
                  <Button 
                    onPress={handleClose} 
                    variant="outline"
                    className="flex-1 h-14 rounded-xl bg-white/50 border-gray-200"
                  >
                    <Text className="font-semibold text-black text-lg">{sent ? 'Done' : 'Cancel'}</Text>
                  </Button>
                  <Button 
                    onPress={handleSend} 
                    disabled={isDisabled}
                    className={`flex-1 h-14 rounded-xl ${isDisabled ? 'bg-black/30' : 'bg-black'}`}
                  >
                    <Text className={`font-semibold text-lg ${isDisabled ? 'text-white/50' : 'text-white'}`}>Send</Text>
                  </Button>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </BlurView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </RNModal>
  );
}
