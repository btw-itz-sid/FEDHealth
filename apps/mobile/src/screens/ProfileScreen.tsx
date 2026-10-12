import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Text>
        </View>
        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role}</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Type</Text>
            <Text style={styles.infoValue}>{user?.role === 'patient' ? 'Patient' : 'Researcher'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.infoValue}>FedHealth v0.1.0</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          This is a research platform for educational purposes. Predictions are not clinical diagnoses.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1, padding: 24, alignItems: 'center', paddingTop: 40 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#1d4ed8' },
  name: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  email: { fontSize: 14, color: '#64748b', marginTop: 4 },
  roleBadge: {
    marginTop: 12, paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: '#dbeafe', borderRadius: 12,
  },
  roleText: { fontSize: 12, fontWeight: '600', color: '#1d4ed8', textTransform: 'capitalize' },
  infoCard: {
    width: '100%', marginTop: 32, backgroundColor: '#fff',
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0',
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoLabel: { fontSize: 14, color: '#64748b' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },
  logoutButton: {
    marginTop: 32, width: '100%', padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2', alignItems: 'center',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#ef4444' },
  disclaimer: {
    marginTop: 24, fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 16,
  },
});
