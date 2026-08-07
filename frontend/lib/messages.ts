
// Centralized messages for AppShield AI UI

export const APP_NAME = "AppShield AI";
export const APP_TAGLINE = "Fraud Detection Platform";

export const LOGIN = {
  heading: "Smarter Analysis.",
  headingAccent: "Safer Applications.",
  introduction: "Leverage advanced AI to detect malicious apps, risky permissions, and potential threats before they harm your users.",
  welcome: "Welcome Back!",
  signInPrompt: "Sign in to continue to",
  emailLabel: "Email Address",
  emailPlaceholder: "admin@example.com",
  passwordLabel: "Password",
  passwordPlaceholder: "Enter your password",
  remember: "Remember me",
  forgotPassword: "Forgot Password?",
  signIn: "Sign In",
  signingIn: "Signing In...",
  continueWithGoogle: "Continue with Google",
  noAccount: "Don’t have an account?",
  signUp: "Sign up",
  trustLine: "Secure. Intelligent. Reliable.",
  features: [
    { key: "models", title: "Advanced AI Models", body: "State-of-the-art ML models for accurate and reliable threat detection." },
    { key: "analysis", title: "Deep Analysis", body: "Comprehensive scan across permissions, code, behavior, and reputation." },
    { key: "privacy", title: "Privacy Focused", body: "Your data is encrypted and secure. We value your privacy." },
  ],
};

// Metadata
export const METADATA = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description: "AI-powered Android application fraud detection platform",
};

// Topbar
export const TOPBAR = {
  researchMode: "Research Mode",
  productionMode: "Production Mode",
};

// Sidebar
export const SIDEBAR = {
  navSections: {
    main: "Main",
    research: "Research",
    analytics: "Analytics",
    management: "Management",
  },
  navItems: {
    dashboard: "Dashboard",
    newScan: "New Scan",
    scanHistory: "Scan History",
    batchScan: "Batch Scan",
    researchMode: "Research Mode",
    modelComparison: "Model Comparison",
    benchmarkResults: "Benchmark Results",
    riskAnalytics: "Risk Analytics",
    trendsInsights: "Trends & Insights",
    reports: "Reports",
    datasets: "Datasets",
    modelTraining: "Model Training",
    users: "Users",
    systemLogs: "System Logs",
    settings: "Settings",
  },
  systemStatus: {
    title: "System Status",
    allOperational: "All Systems Operational",
    modelsTrained: "Models Trained",
    scansToday: "Scans Today",
    avgAccuracy: "Avg. Accuracy",
    lastTraining: "Last Training",
  },
  collapse: "Collapse",
};

// New Scan Page
export const NEW_SCAN = {
  title: "New Scan",
  subtitle: "Analyze an Android application for fraud risk",
  chooseMethod: "Choose input method",
  tabs: {
    playStoreUrl: "Play Store URL",
    apkUrl: "APK Download URL",
    apkUpload: "Upload APK",
    packageName: "Package Name",
    apkHash: "APK Hash (SHA256)",
  },
  placeholders: {
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.example.app",
    apkUrl: "https://example.com/app.apk",
    packageName: "com.whatsapp",
    apkHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  },
  selectApkFile: "Click to select an .apk file",
  runScan: "Run Scan",
  analyzing: "Analyzing...",
  errors: {
    invalidPlayUrl: "Enter a Play Store app details URL with id=, or use Package Name with com.instagram.android.",
    noInput: "Please provide valid input for your selected scan type.",
    scanFailed: "Scan failed.",
  },
  info: "Scans run the full 7-module pipeline (permissions, reviews, static analysis, developer reputation, certificate, icon similarity, metadata) before returning a fused ML prediction with explanations.",
};

// Dashboard Page
export const DASHBOARD = {
  title: "Scan Result",
  subtitle: "Comprehensive AI Analysis Report",
  downloadPdf: "Download PDF Report",
  share: "Share",
};

// Module Score Card
export const MODULE_SCORE_CARD = {
  viewDetails: "View Details",
  riskLabels: {
    low: "Low Risk",
    moderate: "Moderate Risk",
    high: "High Risk",
  },
};

// Datasets Page
export const DATASETS = {
  title: "Datasets",
  subtitle: "Upload and manage training datasets for every AI module",
  infoNote: "Each module gets its own upload area and its own storage folder under /datasets/<module>/raw/. Uploaded files are auto-renamed as <module>_<source>_<date>_<id>.<ext> so the training pipeline can always find them. Once you've uploaded raw sources, run your preprocessing into /datasets/combined/processed/training_data.csv and trigger training from the Research Mode page.",
  adminLogin: {
    title: "Admin Login Required",
    subtitle: "Dataset upload, listing, and deletion are protected admin actions.",
    usernamePlaceholder: "Username",
    passwordPlaceholder: "Password",
    signIn: "Sign In",
    loginFailed: "Login failed",
  },
};

// Research Mode Page
export const RESEARCH = {
  title: "Research Mode",
  subtitle: "Compare multiple ML models and analyze performance",
  demoNote: "Demo data shown — click Train / Benchmark Models once the backend is running to see live results.",
  trainButton: {
    default: "Train / Benchmark Models",
    training: "Training...",
  },
  adminLogin: {
    title: "Admin Login Required",
    subtitle: "Training is protected. Benchmark viewing stays public.",
    usernamePlaceholder: "Username",
    passwordPlaceholder: "Password",
    signIn: "Sign In",
    loginFailed: "Login failed",
    notAuthenticated: "Please sign in as admin before training models.",
  },
  comparison: "Model Comparison",
  quickSummary: "Quick Summary",
  overallRiskScore: "Overall Risk Score",
  performanceRadar: "Performance Radar Chart",
  radarPlaceholder: "Radar Chart Visualization",
  rocCurve: "ROC Curve Comparison",
  rocPlaceholder: "ROC Curve Visualization",
  allMetrics: "All Metrics",
  confusionMatrix: {
    titlePrefix: "Confusion Matrix (Best Model:",
    viewFullExplanation: "View Full Explanation",
  },
  modelInsights: {
    title: "Model Insights & Recommendations",
    bestOverallModel: "Best Overall Model",
    whyThisModel: "Why this model?",
    whenToUseOthers: "When to use other models?",
    recommendation: "Recommendation",
    reasons: {
      highestAccuracy: "Highest accuracy on all metrics",
      bestGeneralization: "Best generalization",
      robustPerformance: "Robust performance across all categories",
      randomForest: "Random Forest: fastest training speed, ideal for prototyping",
      xgboost: "XGBoost: great balance between speed and accuracy",
      catboost: "CatBoost: handles categorical features extremely well",
      stackingEnsemble: "Use Stacking Ensemble for maximum accuracy in production. Use LightGBM for faster real-time scanning.",
    },
  },
};

// Scan History Page
export const SCAN_HISTORY = {
  title: "Scan History",
  subtitle: "All previous application scans",
  noScans: "No scans yet — run one from",
  newScanLinkText: "New Scan",
  noScansNote: ", or connect the backend to see live history here.",
  tableHeaders: {
    app: "App",
    prediction: "Prediction",
    riskScore: "Risk Score",
    model: "Model",
  },
};
