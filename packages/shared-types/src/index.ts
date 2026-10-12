// ============================================
// FedHealth — Shared Type Definitions
// ============================================
// These types represent the API contracts between
// the frontend applications and the backend services.

// ---- User & Auth ----

export enum UserRole {
  PATIENT = 'patient',
  RESEARCHER = 'researcher',
  ADMIN = 'admin',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  consentGiven: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ---- Predictions ----

export interface PredictionInput {
  Pregnancies: number;
  Glucose: number;
  BloodPressure: number;
  SkinThickness: number;
  Insulin: number;
  BMI: number;
  DiabetesPedigreeFunction: number;
  Age: number;
}

export interface PredictionResult {
  id: string;
  userId: string;
  modelId: string;
  modelVersion: string;
  inputFeatures: PredictionInput;
  prediction: number;
  probability: number;
  riskLevel: 'Low' | 'Moderate' | 'High';
  disclaimer: string;
  createdAt: string;
}

export interface CreatePredictionRequest extends PredictionInput {
  modelId?: string;
}

// ---- Datasets ----

export enum DatasetStatus {
  PENDING = 'pending',
  VALIDATING = 'validating',
  VALID = 'valid',
  INVALID = 'invalid',
}

export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  filename: string;
  fileSize: number;
  uploadedBy: string;
  status: DatasetStatus;
  validationResult: DatasetValidation | null;
  numRows: number | null;
  numColumns: number | null;
  classDistribution: Record<string, number> | null;
  classBalance: number | null;
  fingerprint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetValidation {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  stats: DatasetStats;
}

export interface DatasetStats {
  num_rows: number;
  num_columns: number;
  class_distribution: Record<string, number>;
  class_balance: number;
  missing_values: Record<string, number>;
  zero_invalid_counts: Record<string, number>;
  duplicate_rows: number;
  feature_stats: Record<string, FeatureStats>;
}

export interface FeatureStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
  q25: number;
  q75: number;
}

// ---- Experiments ----

export enum ExperimentStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TrainingMethod {
  CENTRALIZED = 'centralized',
  LOCAL_ONLY = 'local_only',
  FEDAVG = 'fedavg',
}

export enum PartitionType {
  IID = 'iid',
  NON_IID = 'non_iid',
  NONE = 'none',
}

export interface Experiment {
  id: string;
  name: string;
  notes: string | null;
  createdBy: string;
  datasetId: string;
  trainingMethod: TrainingMethod;
  numClients: number;
  partitionType: PartitionType;
  numRounds: number;
  localEpochs: number;
  learningRate: number;
  batchSize: number;
  randomSeed: number;
  testSize: number;
  differentialPrivacy: boolean;
  dpConfig: Record<string, any> | null;
  status: ExperimentStatus;
  currentRound: number | null;
  errorMessage: string | null;
  modelId: string | null;
  configSnapshot: Record<string, any> | null;
  finalMetrics: ExperimentMetrics | null;
  durationSeconds: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExperimentRequest {
  name: string;
  notes?: string;
  datasetId: string;
  trainingMethod: TrainingMethod;
  numClients?: number;
  partitionType?: PartitionType;
  numRounds?: number;
  localEpochs?: number;
  learningRate?: number;
  batchSize?: number;
  randomSeed?: number;
  testSize?: number;
  differentialPrivacy?: boolean;
  dpConfig?: Record<string, any>;
}

export interface ExperimentMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc: number | null;
  confusion_matrix: number[][];
  num_train_samples: number;
  num_test_samples: number;
  training_duration_seconds: number;
  per_class: Record<string, ClassMetrics>;
}

export interface ClassMetrics {
  precision: number;
  recall: number;
  f1_score: number;
  support: number;
}

export interface ExperimentRound {
  id: string;
  experimentId: string;
  roundNumber: number;
  trainMetrics: Record<string, any> | null;
  evalMetrics: Record<string, any> | null;
  clientMetrics: Record<string, any>[] | null;
  participatingClients: number | null;
  durationSeconds: number | null;
  communicationBytes: number | null;
  createdAt: string;
}

// ---- Models ----

export enum ModelStatus {
  TRAINING = 'training',
  READY = 'ready',
  FAILED = 'failed',
  ARCHIVED = 'archived',
}

export interface MlModel {
  id: string;
  modelId: string;
  modelVersion: string;
  modelType: string;
  trainingMethod: string;
  datasetId: string | null;
  experimentId: string | null;
  featureColumns: string[];
  preprocessingConfig: Record<string, any> | null;
  trainingConfig: Record<string, any> | null;
  metrics: Record<string, any> | null;
  artifactPath: string | null;
  datasetFingerprint: string | null;
  status: ModelStatus;
  createdAt: string;
}

// ---- Audit ----

export enum AuditAction {
  USER_REGISTERED = 'user_registered',
  USER_LOGIN = 'user_login',
  USER_LOGIN_FAILED = 'user_login_failed',
  PREDICTION_CREATED = 'prediction_created',
  DATASET_UPLOADED = 'dataset_uploaded',
  EXPERIMENT_CREATED = 'experiment_created',
  EXPERIMENT_COMPLETED = 'experiment_completed',
  EXPERIMENT_FAILED = 'experiment_failed',
  ADMIN_ACTION = 'admin_action',
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  userId: string | null;
  userEmail: string | null;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

// ---- Pagination ----

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---- API Error ----

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// ---- Feature Schema (for dynamic form generation) ----

export interface FeatureField {
  name: string;
  label: string;
  type: 'number';
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
}

export const PIMA_FEATURE_FIELDS: FeatureField[] = [
  { name: 'Pregnancies', label: 'Pregnancies', type: 'number', min: 0, max: 20, step: 1, unit: '', description: 'Number of pregnancies' },
  { name: 'Glucose', label: 'Glucose', type: 'number', min: 0, max: 300, step: 1, unit: 'mg/dL', description: 'Plasma glucose concentration (2h OGTT)' },
  { name: 'BloodPressure', label: 'Blood Pressure', type: 'number', min: 0, max: 200, step: 1, unit: 'mm Hg', description: 'Diastolic blood pressure' },
  { name: 'SkinThickness', label: 'Skin Thickness', type: 'number', min: 0, max: 100, step: 1, unit: 'mm', description: 'Triceps skin fold thickness' },
  { name: 'Insulin', label: 'Insulin', type: 'number', min: 0, max: 1000, step: 1, unit: 'μU/mL', description: '2-Hour serum insulin' },
  { name: 'BMI', label: 'BMI', type: 'number', min: 0, max: 80, step: 0.1, unit: 'kg/m²', description: 'Body mass index' },
  { name: 'DiabetesPedigreeFunction', label: 'Diabetes Pedigree', type: 'number', min: 0, max: 3, step: 0.001, unit: '', description: 'Diabetes pedigree function' },
  { name: 'Age', label: 'Age', type: 'number', min: 1, max: 120, step: 1, unit: 'years', description: 'Age in years' },
];
