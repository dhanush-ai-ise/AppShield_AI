export type Prediction = "Safe" | "Suspicious" | "Fraudulent";

export interface ModuleScore {
  module: string;
  score: number; // 0-1
  reasons: string[];
}

export interface ScanResult {
  scan_id: string;
  app_name: string;
  package_name: string;
  version?: string;
  developer?: string;
  category?: string;
  downloads?: string;
  rating?: number;
  app_icon?: string;
  size_mb?: number;
  sha256?: string;
  scanned_at?: string;
  input_type?: string;
  source?: string;
  status?: string;
  overall_risk_score: number; // 0-100
  trust_score: number;
  prediction: Prediction;
  confidence: number;
  model_used: string;
  module_scores?: Record<string, ModuleScore>;
  permissions?: string[];
  top_contributors: { feature: string; label: string; impact_percent: number }[];
  flag_reasons: { module: string; reason: string; level: string; score: number }[];
  class_probabilities?: { Safe?: number; Suspicious?: number; Fraudulent?: number } & Record<string, number>;
  screenshots?: string[];
  metadata?: Record<string, any>;
  certificate?: Record<string, any>;
  [key: string]: any;
}

export interface ModelBenchmarkEntry {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc: number;
  training_time_s: number | null;
  inference_time_s: number | null;
  confusion_matrix?: number[][];
}

export interface BenchmarkResponse {
  results: Record<string, ModelBenchmarkEntry>;
  best_model: string;
  last_trained_at?: string;
}
