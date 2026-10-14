// Mirrors PIMA_FEATURE_FIELDS in packages/shared-types and the API's CreatePredictionDto limits.

export interface FeatureField {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
  zeroMeansUnknown?: boolean;
}

export const PIMA_FEATURE_FIELDS: FeatureField[] = [
  { name: 'Pregnancies', label: 'Pregnancies', min: 0, max: 20, step: 1, unit: '', description: 'Number of times pregnant' },
  { name: 'Glucose', label: 'Glucose', min: 0, max: 300, step: 1, unit: 'mg/dL', description: 'Plasma glucose, 2 hours into an oral glucose tolerance test', zeroMeansUnknown: true },
  { name: 'BloodPressure', label: 'Blood Pressure', min: 0, max: 200, step: 1, unit: 'mm Hg', description: 'Diastolic blood pressure', zeroMeansUnknown: true },
  { name: 'SkinThickness', label: 'Skin Thickness', min: 0, max: 100, step: 1, unit: 'mm', description: 'Triceps skin fold thickness', zeroMeansUnknown: true },
  { name: 'Insulin', label: 'Insulin', min: 0, max: 1000, step: 1, unit: 'μU/mL', description: '2-hour serum insulin', zeroMeansUnknown: true },
  { name: 'BMI', label: 'BMI', min: 0, max: 80, step: 0.1, unit: 'kg/m²', description: 'Body mass index', zeroMeansUnknown: true },
  { name: 'DiabetesPedigreeFunction', label: 'Diabetes Pedigree', min: 0, max: 3, step: 0.001, unit: '', description: 'Family-history score (0.08 – 2.42 in the dataset)' },
  { name: 'Age', label: 'Age', min: 1, max: 120, step: 1, unit: 'years', description: 'Age in years' },
];

export const SAMPLE_PATIENTS: Record<string, Record<string, number>> = {
  'Higher-risk sample': {
    Pregnancies: 6, Glucose: 168, BloodPressure: 72, SkinThickness: 35,
    Insulin: 0, BMI: 38.0, DiabetesPedigreeFunction: 0.627, Age: 50,
  },
  'Lower-risk sample': {
    Pregnancies: 1, Glucose: 89, BloodPressure: 66, SkinThickness: 23,
    Insulin: 94, BMI: 24.2, DiabetesPedigreeFunction: 0.167, Age: 21,
  },
};
