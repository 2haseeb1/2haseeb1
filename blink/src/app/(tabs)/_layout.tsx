import { Tabs } from 'expo-router/js-tabs';

import { CheckIcon, RingIcon, StackIcon } from '@/components/icons';
import { useTheme } from '@/theme/useTheme';

/**
 * Three tabs, no more: what to do now, what can wait, what is already done.
 * Settings lives behind a header button on Today because it is not a destination.
 */
export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textFaint,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <RingIcon color={color} filled />,
        }}
      />
      <Tabs.Screen
        name="later"
        options={{
          title: 'Later',
          tabBarIcon: ({ color }) => <StackIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="done"
        options={{
          title: 'Done',
          tabBarIcon: ({ color }) => <CheckIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
