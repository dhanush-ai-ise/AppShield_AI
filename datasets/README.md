# Dataset Storage Guide — AppShield AI

This is the single source of truth for **where every dataset goes and what to name it.**
The backend's dataset router (`backend/app/routers/datasets_router.py`) and training
script (`backend/app/ml/train_models.py`) both read from these exact paths — don't
rename folders or the pipeline won't find your data.

## Folder structure

```
datasets/
├── permissions/
│   ├── raw/            ← original downloaded files, untouched
│   └── processed/      ← cleaned CSV ready for the permission module
├── reviews/
│   ├── raw/
│   └── processed/
├── icons/
│   ├── raw/             ← original icon/logo images, per source
│   └── processed/       ← precomputed embeddings (trusted_embeddings.npy)
├── apk_static/
│   ├── raw/             ← raw APKs or Drebin-style feature CSVs
│   └── processed/
├── certificates/
│   ├── raw/
│   └── processed/       ← trusted_fingerprints.csv (package_name, sha256, issuer)
├── metadata/
│   ├── raw/
│   └── processed/
└── combined/
    ├── raw/
    └── processed/
        └── training_data.csv   ← THE file app/ml/train_models.py trains on
```

## Naming convention (enforced automatically on upload via the Datasets page / API)

```
<module>_<source_name>_<YYYYMMDD>_<shortid>.<ext>
e.g. permissions_cicmaldroid2020_20260715_a1b2c3.csv
     icons_lld_logo_dataset_20260715_f9e8d7.zip
```

Upload through the **Datasets page** in the frontend (`/datasets`) or via:
```
POST /api/datasets/upload   (form fields: module, source_name, file)
```
This guarantees the naming convention above is always followed — don't drop files
into `raw/` manually unless you also follow this pattern.

---

## Where to download each dataset (verified open-source sources)

### 1. Permissions — `/datasets/permissions/raw/`
- **Android Permission Dataset (Kaggle)** — benign vs malware permission matrix
  https://www.kaggle.com/datasets/saurabhshahane/android-permission-dataset
- **App Permissions Android (Kaggle)** — 2.2M+ apps' permission data
  https://www.kaggle.com/datasets/gauthamp10/app-permissions-android
- **CICMalDroid2020 (Canadian Institute for Cybersecurity, UNB)** — 17,341 APKs across 5 categories including Benign
  https://www.unb.ca/cic/datasets/maldroid-2020.html

### 2. Reviews — `/datasets/reviews/raw/`
- **Google Play Store Reviews (Kaggle)** — real review text for sentiment
  https://www.kaggle.com/datasets/prakharrathi25/google-play-store-reviews
- **Fake Reviews Dataset (Kaggle)** — 40k reviews, 50/50 real vs. computer-generated fake
  https://www.kaggle.com/datasets/mexwell/fake-reviews-dataset
- **Deceptive Opinion Spam Corpus (Kaggle)** — gold-standard truthful vs. deceptive text, good for pretraining the fake-review classifier before fine-tuning on app reviews
  https://www.kaggle.com/datasets/rtatman/deceptive-opinion-spam-corpus

### 3. Icons — `/datasets/icons/raw/`
- **LLD — Large Logo Dataset (ETH Zurich CVL)** — 600K+ logos/icons, the standard academic source for this task
  https://data.vision.ee.ethz.ch/cvl/lld/
- **Logo Dataset – 2341 classes (Kaggle)** — 167K images across 2341 brand classes
  https://www.kaggle.com/datasets/siddharthkumarsah/logo-dataset-2341-classes-and-167140-images
- **Icons-50 (Kaggle)** — 10K icons across Apple/Google/Microsoft/Facebook styles, useful for style-robustness testing
  https://www.kaggle.com/datasets/danhendrycks/icons50

### 4. APK Static Analysis — `/datasets/apk_static/raw/`
- **CICMalDroid2020** — raw APKs + pre-extracted static features
  https://www.unb.ca/cic/datasets/maldroid-2020.html
- **Drebin Dataset** — the classic 5,560-malware-app benchmark. **Requires an email request** from an academic/company address (see site) — no direct download.
  https://drebin.mlsec.org/
- **Android Malware Dataset for ML (Kaggle)** — 215-feature CSV already extracted from Drebin — easiest way to get static features without APK parsing
  https://www.kaggle.com/datasets/shashwatwork/android-malware-dataset-for-machine-learning
- **AndroZoo** — millions of raw APKs (benign + malware) with SHA256/AV-scan metadata. **Requires an academic access request** via email (androzoo@uni.lu) — no anonymous downloads.
  https://androzoo.uni.lu

### 5. Certificates — `/datasets/certificates/raw/`
No ready-made public "trusted certificate" dataset exists. Build it yourself:
1. Pull a batch of known-legitimate APKs from CICMalDroid2020's Benign category or AndroZoo (filtered to apps with 0 AV detections).
2. Extract each signing certificate's SHA256 fingerprint with Androguard or `apksigner verify --print-certs`.
3. Save as `/datasets/certificates/processed/trusted_fingerprints.csv` with columns `package_name, sha256_fingerprint, issuer`.
4. Load that CSV into `backend/app/modules/certificate_analysis.py`'s `TRUSTED_FINGERPRINTS` dict (currently empty — this is the wiring step).

### 6. Metadata — `/datasets/metadata/raw/`
- **Google Play Store Apps (Kaggle)** — the classic 10K-app starter dataset (downloads, ratings, size, category)
  https://www.kaggle.com/datasets/lava18/google-play-store-apps
- **Google Playstore Apps — large (Kaggle)** — 2M+ apps, much more coverage for anomaly detection
  https://www.kaggle.com/datasets/gauthamp10/google-playstore-apps

### 7. Combined / Fused — `/datasets/combined/processed/training_data.csv`
This is **not downloaded** — it's the output of running all 7 modules over a labeled
APK set (Safe / Suspicious / Fraudulent) and writing out each app's 7 module scores
+ its ground-truth label. Ground truth labels come from the malware-family / benign
labels in CICMalDroid2020 or Drebin.

Columns required by `train_models.py`:
```
permission_risk, review_risk, apk_static_risk, developer_risk,
certificate_risk, icon_similarity_risk, metadata_risk, label
```
(`label`: 0 = Safe, 1 = Suspicious, 2 = Fraudulent)

**For development right now**, a synthetic version of this file is auto-generated by:
```
python -m app.ml.seed_synthetic_data
```
Replace it with the real fused dataset before training a model you intend to trust.

---

## Legal notes
- Drebin and AndroZoo both require an **academic access request by email** — budget a
  few days for approval before you need the data.
- Malware APKs are, by definition, malicious software. Only analyze them in an isolated
  environment and never execute them outside a sandbox.
- Respect each dataset's license/citation requirements (most academic malware datasets
  ask you to cite the originating paper — see each source's page).
