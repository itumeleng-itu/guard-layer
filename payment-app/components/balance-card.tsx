import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

interface BalanceCardProps {
  balance: string;
}

export function BalanceCard({ balance }: BalanceCardProps) {
  return (
    <View className="py-4 mb-4 bg-transparent">
      <Text className="text-base opacity-50 font-bold">CURRENT BALANCE</Text>
      <Text className="text-4xl font-bold mt-1">
        ${balance}
      </Text>
    </View>
  );
}
