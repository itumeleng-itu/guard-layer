import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Avatar } from 'react-native-paper';
import { Text } from '@/components/ui/text';

export function Header({ userName = "Itu", location = "Johannesburg" }) {
  const [greeting, setGreeting] = useState("Good Day");
  const [timeString, setTimeString] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hour = now.getHours();

      if (hour < 12) {
        setGreeting("Good Morning");
      } else if (hour < 18) {
        setGreeting("Good Afternoon");
      } else {
        setGreeting("Good Evening");
      }

      const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Get a short timezone string (e.g., GMT+2 or EST)
      const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(now);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      const timeZoneName = tzPart ? tzPart.value : "";

      setTimeString(`${formattedTime} ${timeZoneName}`);
    };

    updateTime();
    // Update every minute to keep time accurate
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View className="flex-row items-center px-5 pt-4 pb-2">
      <Avatar.Image 
        size={50} 
        source={{ uri: 'https://i.pravatar.cc/300' }} 
      />
      <View className="ml-4">
        <Text className="text-xl font-bold">{greeting}, {userName}</Text>
        <Text className="text-sm opacity-70">{location}, {timeString}</Text>
      </View>
    </View>
  );
}
