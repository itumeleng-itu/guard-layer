import React from 'react';
import { View } from 'react-native';
import { List } from 'react-native-paper';
import { Text } from '@/components/ui/text';
import { BlurView } from 'expo-blur';

export function HistoryActivity() {
  return (
    <View className="mt-6 flex-1 rounded-t-[32px] overflow-hidden border-t border-white/60 shadow-sm">
      <BlurView intensity={60} tint="light" className="p-6 flex-1 min-h-[400px]">
        <View className="bg-white/40 absolute top-0 left-0 right-0 bottom-0" />
        
        <Text className="text-xl font-bold pl-2 pt-1 mb-4">Activity</Text>
        
        <List.Item
          title="Blocked Trans"
          description="Security Alert"
          left={props => <List.Icon {...props} icon="shield-alert" color="red" />}
          className="bg-white/50 rounded-xl mb-3"
        />
        <List.Item
          title="Money In"
          description="+R2000.00"
          left={props => <List.Icon {...props} icon="arrow-down-bold" color="green" />}
          className="bg-white/50 rounded-xl mb-3"
        />
        <List.Item
          title="Itumeleng"
          description="-R300.00"
          left={props => <List.Icon {...props} icon="arrow-up-bold" color="orange" />}
          className="bg-white/50 rounded-xl mb-3"
        />
      </BlurView>
    </View>
  );
}
