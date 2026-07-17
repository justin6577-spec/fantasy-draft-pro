import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/theme/theme';

function TabIcon({ label, icon }: { label: string; icon: string }): React.JSX.Element {
  return (
    <View style={styles.tabButton}>
      <Text style={styles.tabIcon}>{icon}</Text>
      <Text style={styles.tabLabel}>{label}</Text>
    </View>
  );
}

export default function TabsLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: () => (
            <TabIcon label="Home" icon={'🏠'} />
          ),
        }}
      />
      <Tabs.Screen
        name="gameday"
        options={{
          tabBarIcon: () => (
            <TabIcon label="Game Day" icon={'📊'} />
          ),
        }}
      />
      <Tabs.Screen
        name="scores"
        options={{
          tabBarIcon: () => (
            <TabIcon label="Scores" icon={'🏈'} />
          ),
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          tabBarIcon: () => (
            <TabIcon label="Leagues" icon={'🏆'} />
          ),
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          tabBarIcon: () => (
            <TabIcon label="Players" icon={'📋'} />
          ),
        }}
      />
      <Tabs.Screen
        name="paywall"
        options={{
          tabBarIcon: () => (
            <TabIcon label="Upgrade" icon={'⭐'} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabButton: {
    alignItems: 'center',
    gap: 2,
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 22,
  },
  tabLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
});
