import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, RefreshControl,
} from 'react-native';
import mobileApi from '../lib/api';

export default function HistoryScreen() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPredictions = async () => {
    try {
      const result = await mobileApi.getPredictions();
      setPredictions(result.items || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadPredictions(); }, []);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High': return '#ef4444';
      case 'Moderate': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.riskDot, { backgroundColor: getRiskColor(item.riskLevel) }]} />
        <Text style={[styles.riskLabel, { color: getRiskColor(item.riskLevel) }]}>
          {item.riskLevel} Risk
        </Text>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      <Text style={styles.probability}>
        {(item.probability * 100).toFixed(1)}% probability
      </Text>
      <View style={styles.metrics}>
        <Text style={styles.metric}>Glucose: {item.inputFeatures?.Glucose}</Text>
        <Text style={styles.metric}>BMI: {item.inputFeatures?.BMI}</Text>
        <Text style={styles.metric}>Age: {item.inputFeatures?.Age}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Prediction History</Text>
        <Text style={styles.count}>{predictions.length} assessments</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : predictions.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No predictions yet</Text>
          <Text style={styles.emptySubtext}>Submit a risk assessment to see results here</Text>
        </View>
      ) : (
        <FlatList
          data={predictions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPredictions(); }} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  count: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  riskDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  riskLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  date: { fontSize: 12, color: '#94a3b8' },
  probability: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  metrics: { flexDirection: 'row', gap: 16 },
  metric: { fontSize: 12, color: '#64748b' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94a3b8' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  emptySubtext: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
});
