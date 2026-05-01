import React, { useState } from 'react';
import { View, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Provider as PaperProvider, 
  MD3LightTheme,
  configureFonts
} from 'react-native-paper';
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

import { Header } from '@/components/header';
import { BalanceCard } from '@/components/balance-card';
import { CurrencyConverter } from '@/components/currency-converter';
import { SendMoneyModal } from '@/components/send-money-modal';
import { HistoryActivity } from '@/components/history-activity';
import { useUserLocation } from '@/hooks/use-location';
import { TransactionProvider, useTransactions } from '@/hooks/use-transactions';

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

function HomeScreen() {
  const [visible, setVisible] = useState(false);
  const location = useUserLocation();
  const { balance } = useTransactions();

  const showModal = () => setVisible(true);
  const hideModal = () => setVisible(false);

  // Format balance with commas
  const formattedBalance = balance.toLocaleString('en-ZA', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });

  return (
    <View className="flex-1 bg-[#F2F2F7]">
      <SafeAreaView edges={['top']} className="flex-1">
        <Header cityName={location.city} />
        <ScrollView contentContainerClassName="flex-grow pt-2 z-10" showsVerticalScrollIndicator={false}>

          <View className="px-5 pb-2">
            {/* Balance Card — live balance from transaction store */}
            <BalanceCard balance={formattedBalance} />

            {/* Currency Converter — auto-detects local currency from GPS */}
            <CurrencyConverter 
              targetCurrency={location.currency.code} 
              flag={location.currency.flag} 
              symbol={location.currency.symbol} 
            />

            {/* Main Action Button */}
            <Button 
              onPress={showModal} 
              className="rounded-2xl my-2.5 bg-black h-14 shadow-lg shadow-black/20"
            >
              <Text className="text-white text-lg font-semibold">SEND CASH</Text>
            </Button>
          </View>

          {/* History/Activity Section — real transaction logs */}
          <HistoryActivity />

        </ScrollView>

        {/* Send Money Modal */}
        <SendMoneyModal visible={visible} onClose={hideModal} localCurrency={location.currency} />

      </SafeAreaView>
    </View>
  );
}

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <TransactionProvider>
        <HomeScreen />
      </TransactionProvider>
    </PaperProvider>
  );
}