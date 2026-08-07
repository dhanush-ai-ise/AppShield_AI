"use client";
import { useEffect, useState } from "react";
import { Database, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import DatasetUploadCard, { DatasetModuleInfo } from "@/components/DatasetUploadCard";
import { api } from "@/lib/api";
import { DATASETS } from "@/lib/messages";

const MODULES: DatasetModuleInfo[] = [
  {
    key: "permissions",
    title: "1. Permission Dataset",
    description: "Android permission matrices labeled benign/malware, used to train the Permission Analysis module.",
    expectedFormat: "CSV — one row per app, one column per permission (0/1), + a label column",
    sources: [
      { name: "Android Permission Dataset (Kaggle)", url: "https://www.kaggle.com/datasets/saurabhshahane/android-permission-dataset", note: "benign vs malware, permission matrix" },
      { name: "App Permissions Android (Kaggle)", url: "https://www.kaggle.com/datasets/gauthamp10/app-permissions-android", note: "2.2M+ apps, permission data" },
      { name: "CICMalDroid2020 (UNB CIC)", url: "https://www.unb.ca/cic/datasets/maldroid-2020.html", note: "17K+ APKs, 5 categories incl. Benign" },
    ],
  },
  {
    key: "reviews",
    title: "2. Review Dataset",
    description: "Google Play review text + fake/spam review labels, used to train the Review Analysis (NLP) module.",
    expectedFormat: "CSV — columns: review_text, rating, label(real/fake) or sentiment",
    sources: [
      { name: "Google Play Store Reviews (Kaggle)", url: "https://www.kaggle.com/datasets/prakharrathi25/google-play-store-reviews", note: "real app reviews for sentiment" },
      { name: "Fake Reviews Dataset (Kaggle)", url: "https://www.kaggle.com/datasets/mexwell/fake-reviews-dataset", note: "40k reviews, 50/50 real vs fake" },
      { name: "Deceptive Opinion Spam Corpus (Kaggle)", url: "https://www.kaggle.com/datasets/rtatman/deceptive-opinion-spam-corpus", note: "gold-standard truthful vs deceptive text" },
    ],
  },
  {
    key: "icons",
    title: "3. Icon Dataset",
    description: "Reference app icon / logo images used to build the trusted-icon embedding database for clone detection.",
    expectedFormat: "Image files (PNG/JPG), organized as one folder per package/brand name",
    sources: [
      { name: "LLD — Large Logo Dataset (ETH Zurich)", url: "https://data.vision.ee.ethz.ch/cvl/lld/", note: "600K+ logos/icons" },
      { name: "Logo Dataset — 2341 classes (Kaggle)", url: "https://www.kaggle.com/datasets/siddharthkumarsah/logo-dataset-2341-classes-and-167140-images", note: "167K images, 2341 brand classes" },
      { name: "Icons-50 (Kaggle)", url: "https://www.kaggle.com/datasets/danhendrycks/icons50", note: "10K icons across platforms/styles" },
    ],
  },
  {
    key: "apk_static",
    title: "4. APK Static Analysis Dataset",
    description: "Labeled APKs / extracted static features (manifest, API calls, permissions) for the APK Static Analysis module.",
    expectedFormat: "Raw APKs (.apk) or pre-extracted feature CSV, + benign/malware label",
    sources: [
      { name: "CICMalDroid2020 (UNB CIC)", url: "https://www.unb.ca/cic/datasets/maldroid-2020.html", note: "raw APKs + extracted features" },
      { name: "Drebin Dataset", url: "https://drebin.mlsec.org/", note: "5,560 malware APKs — academic email request required" },
      { name: "Android Malware Dataset for ML (Kaggle)", url: "https://www.kaggle.com/datasets/shashwatwork/android-malware-dataset-for-machine-learning", note: "215-feature CSV derived from Drebin, ready to use" },
      { name: "AndroZoo", url: "https://androzoo.uni.lu", note: "millions of raw APKs — academic access request required" },
    ],
  },
  {
    key: "certificates",
    title: "5. Certificate Dataset",
    description: "Trusted publisher signing-certificate fingerprints. No single public dataset exists — build this by extracting certs from verified apps in the APK datasets below with Androguard/apksigner.",
    expectedFormat: "CSV — package_name, sha256_fingerprint, issuer, is_trusted",
    sources: [
      { name: "CICMalDroid2020 APKs (extract certs yourself)", url: "https://www.unb.ca/cic/datasets/maldroid-2020.html", note: "parse signing certs from benign-labeled APKs" },
      { name: "AndroZoo APKs (extract certs yourself)", url: "https://androzoo.uni.lu", note: "large benign app pool for trusted-cert seeding" },
    ],
  },
  {
    key: "metadata",
    title: "6. Metadata Dataset",
    description: "App store listing metadata (downloads, ratings, version history, size) for the Metadata Analysis module.",
    expectedFormat: "CSV — package_name, downloads, rating, rating_count, size_mb, version_count, category",
    sources: [
      { name: "Google Play Store Apps (Kaggle)", url: "https://www.kaggle.com/datasets/lava18/google-play-store-apps", note: "10K+ apps, classic starter dataset" },
      { name: "Google Playstore Apps — large (Kaggle)", url: "https://www.kaggle.com/datasets/gauthamp10/google-playstore-apps", note: "2M+ apps, much larger" },
    ],
  },
  {
    key: "combined",
    title: "7. Combined / Fused Training Dataset",
    description: "The final fused dataset actually consumed by app/ml/train_models.py — one row per app with all 7 module risk scores + the ground-truth label. Build this by running every module above over a labeled APK set and writing out the fusion_engine feature vector + label.",
    expectedFormat: "CSV columns: permission_risk, review_risk, apk_static_risk, developer_risk, certificate_risk, icon_similarity_risk, metadata_risk, label(0=Safe,1=Suspicious,2=Fraudulent)",
    sources: [
      { name: "Build script: seed_synthetic_data.py", url: "https://www.unb.ca/cic/datasets/maldroid-2020.html", note: "a synthetic version is auto-generated for development — replace with real fused data before production" },
    ],
  },
];

export default function DatasetsPage() {
  const router = useRouter();
  const [files, setFiles] = useState<Record<string, { raw_files: string[]; processed_files: string[] }>>({});

  function refresh() {
    api.listDatasets().then(setFiles).catch(() => {});
  }

  useEffect(() => {
    api
      .listDatasets()
      .then(setFiles)
      .catch(() => {
        api.logoutAdmin();
        router.push("/login?next=/datasets");
      });
  }, []);

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-h-screen">
        <Topbar title={DATASETS.title} subtitle={DATASETS.subtitle} icon={<Database size={20} className="text-brand-light" />} />

        <div className="px-8 py-6 space-y-6">
          <div className="panel p-4 flex items-start gap-3 border-brand/30">
            <Info size={16} className="text-brand-light mt-0.5 shrink-0" />
            <p className="text-xs text-slate-700 leading-relaxed">
              {DATASETS.infoNote}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {MODULES.map((m) => (
              <DatasetUploadCard
                key={m.key}
                info={m}
                files={files[m.key]?.raw_files ?? []}
                onChanged={refresh}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
