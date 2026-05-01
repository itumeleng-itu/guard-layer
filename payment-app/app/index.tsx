import React, { useState } from 'react';
import { View, ScrollView, Platform, Modal as RNModal, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Provider as PaperProvider, 
  MD3LightTheme,
  configureFonts
} from 'react-native-paper';
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { BlurView } from 'expo-blur';

import { Header } from '@/components/header';
import { BalanceCard } from '@/components/balance-card';
import { CurrencyConverter } from '@/components/currency-converter';
import { SendMoneyModal } from '@/components/send-money-modal';
import { HistoryActivity } from '@/components/history-activity';

const fontConfig = {
  fontFamily: Platform.select({
    ios: 'System', 
    default: 'Inter_400Regular',
  }),
};

const theme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
};

export default function App() {
  // State for Balance and Pop-up visibility
  const [balance, setBalance] = useState("12,450.00");
  const [visible, setVisible] = useState(false);

  const showModal = () => setVisible(true);
  const hideModal = () => setVisible(false);

  return (
    <PaperProvider theme={theme}>
      <View className="flex-1 bg-[#F2F2F7]">
        <SafeAreaView edges={['top']} className="flex-1">
          <Header />
          <ScrollView contentContainerClassName="flex-grow pt-2 z-10" showsVerticalScrollIndicator={false}>

            <View className="px-5 pb-2">
              {/* Balance Card */}
              <BalanceCard balance={balance} />

              {/* Currency Converter */}
              <CurrencyConverter targetCurrency="ZAR" flag="🇿🇦" symbol="R" />

              {/* Main Action Button */}
              <Button 
                onPress={showModal} 
                className="rounded-2xl my-2.5 bg-black h-14 shadow-lg shadow-black/20"
              >
                <Text className="text-white text-lg font-semibold">SEND CASH</Text>
              </Button>
            </View>

            {/* History/Activity Section */}
            <HistoryActivity />


          </ScrollView>

          {/* Send Money Modal */}
          <SendMoneyModal visible={visible} onClose={hideModal} />

        </SafeAreaView>
      </View>
    </PaperProvider>
  );
}