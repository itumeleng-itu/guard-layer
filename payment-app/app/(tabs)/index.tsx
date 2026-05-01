import React, { useState } from 'react';
import { View, ScrollView, SafeAreaView } from 'react-native';
import { 
  Provider as PaperProvider, 
  Text, 
  Avatar, 
  Card, 
  Button, 
  Portal, 
  Modal, 
  TextInput,
  List
} from 'react-native-paper';

export default function App() {
  // State for Balance and Pop-up visibility
  const [balance, setBalance] = useState("12,450.00");
  const [visible, setVisible] = useState(false);
  
  // Pop-up form state
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");

  const showModal = () => setVisible(true);
  const hideModal = () => setVisible(false);

  return (
    <PaperProvider>
      <SafeAreaView className="flex-1 bg-gray-100">
        <ScrollView contentContainerClassName="p-5">
          
          {/* Header Section */}
          <View className="flex-row items-center mb-8 mt-2.5">
            <Avatar.Image 
              size={50} 
              source={{ uri: 'https://i.pravatar.cc/300' }} 
            />
            <View className="ml-4">
              <Text variant="titleMedium">Good Afternoon, Itu</Text>
              <Text variant="bodySmall">Johannesburg, 20:00</Text>
            </View>
          </View>

          {/* Balance Card */}
          <Card className="bg-white rounded-2xl py-2.5 mb-5 shadow-sm">
            <Card.Content>
              <Text variant="labelMedium" className="opacity-70">CURRENT BALANCE</Text>
              <Text variant="displaySmall" className="font-bold mt-1">
                ZAR {balance}
              </Text>
            </Card.Content>
          </Card>

          {/* Main Action Button */}
          <Button 
            mode="contained" 
            onPress={showModal} 
            className="rounded-xl my-2.5 bg-[#6200ee]"
            contentStyle={{ height: 55 }}
          >
            SEND CASH
          </Button>

          {/* History/Activity Section */}
          <View className="mt-8 bg-white rounded-2xl p-2.5 min-h-[300px]">
            <Text variant="titleLarge" className="pl-4 pt-2.5 mb-2.5">History/Activity</Text>
            
            <List.Item
              title="Blocked Trans"
              description="Security Alert"
              left={props => <List.Icon {...props} icon="shield-alert" color="red" />}
            />
            <List.Item
              title="Money In"
              description="+R2000.00"
              left={props => <List.Icon {...props} icon="arrow-down-bold" color="green" />}
            />
            <List.Item
              title="Itumeleng"
              description="-R300.00"
              left={props => <List.Icon {...props} icon="arrow-up-bold" color="orange" />}
            />
          </View>

          <Text className="text-center mt-5 opacity-50 italic">Every AI decision is logged</Text>
        </ScrollView>

        {/* --- SEND MONEY POP-UP (DIALOG) --- */}
        <Portal>
          <Modal 
            visible={visible} 
            onDismiss={hideModal} 
            contentContainerStyle={{ backgroundColor: 'white', padding: 25, margin: 20, borderRadius: 20 }}
          >
            <Text variant="headlineSmall" className="mb-5 text-center">Send Money</Text>
            
            <TextInput
              label="Mobile Number"
              value={phone}
              onChangeText={setPhone}
              mode="outlined"
              keyboardType="phone-pad"
              className="mb-4"
            />
            
            <TextInput
              label="Amount (ZAR)"
              value={amount}
              onChangeText={setAmount}
              mode="outlined"
              keyboardType="numeric"
              className="mb-4"
            />

            <Button 
              mode="contained" 
              onPress={hideModal} 
              className="mt-2.5 py-1 bg-[#6200ee]"
            >
              Send
            </Button>
          </Modal>
        </Portal>

      </SafeAreaView>
    </PaperProvider>
  );
}