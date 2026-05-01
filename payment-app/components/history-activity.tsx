import React from 'react';
import { View } from 'react-native';
import { List } from 'react-native-paper';
import { Text } from '@/components/ui/text';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTransactions, type Transaction } from '@/hooks/use-transactions';

function getIcon(tx: Transaction) {
  switch (tx.type) {
    case 'blocked':
      return { name: 'shield-outline' as const, color: '#ef4444' };
    case 'received':
      return { name: 'arrow-down-circle-outline' as const, color: '#22c55e' };
    case 'sent':
      return { name: 'arrow-up-circle-outline' as const, color: '#f97316' };
  }
}

function formatAmount(tx: Transaction) {
  const prefix = tx.type === 'received' ? '+' : '-';
  return `${prefix}R${tx.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function HistoryActivity() {
  const { transactions } = useTransactions();

  return (
    <View className="mt-6 flex-1 rounded-t-[32px] overflow-hidden border-t border-white/60 shadow-sm">
      <BlurView intensity={60} tint="light" className="p-6 flex-1 min-h-[400px]">
        <View className="bg-white/40 absolute top-0 left-0 right-0 bottom-0" />
        
        <Text className="text-xl font-bold pl-2 pt-1 mb-4">Activity</Text>

        {transactions.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
            <Text className="text-base opacity-40 mt-3 text-center">
              No transactions yet
            </Text>
            <Text className="text-sm opacity-30 mt-1 text-center">
              Send cash to see your activity here
            </Text>
          </View>
        ) : (
          transactions.map((tx) => {
            const icon = getIcon(tx);
            return (
              <List.Item
                key={tx.id}
                title={tx.type === 'blocked' ? 'Blocked Transaction' : tx.recipient}
                description={tx.type === 'blocked' 
                  ? `Security: ${tx.reason || 'Risk detected'}` 
                  : `${formatAmount(tx)} · ${formatTime(tx.date)}`}
                left={props => (
                  <Ionicons 
                    name={icon.name} 
                    size={40} 
                    color={icon.color} 
                    style={[props.style, { alignSelf: 'center', marginLeft: 8, marginRight: 8 }]} 
                  />
                )}
                className="bg-white/50 rounded-xl mb-3"
              />
            );
          })
        )}
      </BlurView>
    </View>
  );
}
