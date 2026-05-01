import React, { useState } from 'react';
import { View, Modal as RNModal, TouchableWithoutFeedback } from 'react-native';
import { List } from 'react-native-paper';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
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

function TransactionReceiptModal({ transaction, visible, onClose }: { transaction: Transaction | null, visible: boolean, onClose: () => void }) {
  if (!transaction) return null;
  
  const icon = getIcon(transaction);
  const formattedDate = transaction.date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = formatTime(transaction.date);

  return (
    <RNModal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <BlurView intensity={80} tint="systemMaterialDark" className="flex-1 justify-center p-5">
          <TouchableWithoutFeedback>
            <View className="bg-white/90 p-6 rounded-[32px] shadow-2xl border border-white/20 items-center">
              <View className="h-16 w-16 rounded-full bg-black/5 items-center justify-center mb-4">
                <Ionicons name={icon.name} size={32} color={icon.color} />
              </View>
              
              <Text className="text-2xl font-bold mb-1">
                {transaction.type === 'blocked' ? 'Blocked' : formatAmount(transaction)}
              </Text>
              <Text className="text-sm opacity-60 mb-6">
                {transaction.type === 'blocked' ? 'Security Alert' : 'Successful Payment'}
              </Text>
              
              <View className="w-full bg-black/5 rounded-2xl p-4 mb-6">
                <View className="flex-row justify-between mb-3">
                  <Text className="text-sm opacity-60">Status</Text>
                  <Text className={`text-sm font-bold ${transaction.type === 'blocked' ? 'text-red-500' : 'text-green-600'}`}>
                    {transaction.type === 'blocked' ? 'Declined' : 'Completed'}
                  </Text>
                </View>
                
                <View className="flex-row justify-between mb-3">
                  <Text className="text-sm opacity-60">To</Text>
                  <Text className="text-sm font-bold">{transaction.recipient || 'N/A'}</Text>
                </View>
                
                <View className="flex-row justify-between mb-3">
                  <Text className="text-sm opacity-60">Date</Text>
                  <Text className="text-sm font-bold">{formattedDate}</Text>
                </View>
                
                <View className="flex-row justify-between mb-3">
                  <Text className="text-sm opacity-60">Time</Text>
                  <Text className="text-sm font-bold">{formattedTime}</Text>
                </View>

                {transaction.type === 'blocked' && transaction.reason && (
                  <View className="flex-row justify-between mt-2 pt-3 border-t border-black/10">
                    <Text className="text-sm opacity-60">Reason</Text>
                    <Text className="text-sm font-bold text-red-500 text-right flex-1 ml-4">{transaction.reason}</Text>
                  </View>
                )}

                <View className="flex-row justify-between mt-3 pt-3 border-t border-black/10">
                  <Text className="text-sm opacity-60">Transaction ID</Text>
                  <Text className="text-xs font-mono font-bold opacity-70">{transaction.id}</Text>
                </View>
              </View>
              
              <Button onPress={onClose} className="w-full h-14 rounded-xl bg-black">
                <Text className="text-white font-semibold text-lg">Close</Text>
              </Button>
            </View>
          </TouchableWithoutFeedback>
        </BlurView>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}

export function HistoryActivity() {
  const { transactions } = useTransactions();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

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
                onPress={() => setSelectedTx(tx)}
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
      <TransactionReceiptModal 
        transaction={selectedTx} 
        visible={!!selectedTx} 
        onClose={() => setSelectedTx(null)} 
      />
    </View>
  );
}
