import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ScrollView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import mobileApi from '../lib/api';

const PIMA_FIELDS = [
  { key: 'Pregnancies', label: 'Pregnancies', min: 0, max: 20 },
  { key: 'Glucose', label: 'Glucose (mg/dL)', min: 0, max: 300 },
  { key: 'BloodPressure', label: 'Blood Pressure (mm Hg)', min: 0, max: 200 },
  { key: 'SkinThickness', label: 'Skin Thickness (mm)', min: 0, max: 100 },
  { key: 'Insulin', label: 'Insulin (μU/mL)', min: 0, max: 1000 },
  { key: 'BMI', label: 'BMI (kg/m²)', min: 0, max: 80 },
  { key: 'DiabetesPedigreeFunction', label: 'Diabetes Pedigree', min: 0, max: 3 },
  { key: 'Age', label: 'Age (years)', min: 1, max: 120 },
];

export default function PredictionScreen() {
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePredict = async () => {
    const input: any = {};
    for (const field of PIMA_FIELDS) {
      const val = parseFloat(values[field.key] || '0');
      if (isNaN(val) || val < field.min || val > field.max) {
        Alert.alert('Validation Error', `${field.label} must be between ${field.min} and ${field.max}`);
        return;
      }
      input[field.key] = val;
    }

    setLoading(true);
    try {
      const prediction = await mobileApi.createPrediction(input);
      setResult(prediction);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High': return '#ef4444';
      case 'Moderate': return '#f59e0b';
      default: return '#10b981';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Hello, {user?.firstName} 👋</Text>
        <Text style={styles.title}>Diabetes Risk Assessment</Text>
        <Text style={styles.note}>Enter your health metrics below</Text>

        {PIMA_FIELDS.map((field) => (
          <View key={field.key} style={styles.fieldGroup}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              style={styles.input}
              value={values[field.key] || ''}
              onChangeText={(text) => setValues((prev) => ({ ...prev, [field.key]: text }))}
              keyboardType="numeric"
              placeholder={`${field.min}–${field.max}`}
              placeholderTextColor="#94a3b8"
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handlePredict}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Analyzing...' : 'Get Risk Assessment'}</Text>
        </TouchableOpacity>

        {result && (
          <View style={styles.resultCard}>
            <View style={[styles.riskBadge, { backgroundColor: getRiskColor(result.riskLevel) + '20' }]}>
              <Text style={[styles.riskText, { color: getRiskColor(result.riskLevel) }]}>
                {result.riskLevel} Risk
              </Text>
            </View>
            <Text style={styles.probability}>
              Probability: {(result.probability * 100).toFixed(1)}%
            </Text>
            <Text style={styles.disclaimer}>{result.disclaimer}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  note: { fontSize: 13, color: '#94a3b8', marginBottom: 20 },
  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', color: '#475569', marginBottom: 4 },
  input: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    padding: 12, fontSize: 16, color: '#0f172a',
  },
  button: {
    backgroundColor: '#2563eb', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resultCard: {
    marginTop: 24, backgroundColor: '#fff', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  riskBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  riskText: { fontSize: 16, fontWeight: '700' },
  probability: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  disclaimer: { fontSize: 11, color: '#94a3b8', lineHeight: 16, marginTop: 8 },
});
