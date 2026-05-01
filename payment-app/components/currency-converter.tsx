import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';

interface CurrencyConverterProps {
  targetCurrency?: string;
  flag?: string;
  symbol?: string;
}

export function CurrencyConverter({ 
  targetCurrency = "ZAR", 
  flag = "🇿🇦",
  symbol = "R"
}: CurrencyConverterProps) {
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRate() {
      try {
        const apiKey = process.env.EXPO_PUBLIC_EXCHANGE_RATE_API;
        if (!apiKey) {
          console.warn("API key EXPO_PUBLIC_EXCHANGE_RATE_API is missing.");
          setLoading(false);
          return;
        }

        const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`);
        const data = await response.json();

        if (data && data.result === 'success' && data.conversion_rates) {
          setRate(data.conversion_rates[targetCurrency]);
        } else {
          console.error("API Error:", data);
        }
      } catch (error) {
        console.error("Network Error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRate();
  }, [targetCurrency]);

  return (
    <View className="flex-row items-center justify-between bg-black/10 rounded-2xl p-2 mb-2 shadow-sm">
      <View className="flex-row items-center">
        <Text className="text-lg mr-2 font-medium">🇺🇸 USD</Text>
        <Text className="text-sm opacity-50 mx-1">→</Text>
        <Text className="text-lg ml-2 font-medium">{flag} {targetCurrency}</Text>
      </View>
      
      <View className="bg-transparent px-3 py-1.5 rounded-lg">
        {loading ? (
          <ActivityIndicator size="small" color="#000" />
        ) : rate ? (
          <Text className="text-lg font-bold">
            $1 = {symbol}{rate.toFixed(2)}
          </Text>
        ) : (
          <Text className="text-xs text-red-500 font-medium">Error</Text>
        )}
      </View>
    </View>
  );
}
