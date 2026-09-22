# ☁️ CloudATS — Cloud-Native Resume Screener & Candidate Pipeline

![AWS Cloud Architecture](https://img.shields.io/badge/AWS-S3%20%7C%20STS%20%7C%20Textract%20%7C%20CloudWatch%20%7C%20SES-232F3E?logo=amazon-aws&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite%20%2B%20TailwindCSS-61DAFB?logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

**CloudATS** is an enterprise-grade, cloud-native recruitment platform and automated candidate screening pipeline. It bridges recruiters and applicants by enabling recruiters to create custom job roles, generate shareable application URLs, ingest resumes directly into **AWS S3**, automatically compute **ATS match scores**, rank candidates from highest to lowest, and export candidate lists directly into **Excel / CSV format**.

---

## 🎯 Key Features

### 1. 💼 Recruiter Job Creation & 1-Click Shareable Links
- **Role Customization**: Define Job Title, Department, Minimum Experience, Required Skills, Preferred Skills, and full Role Descriptions.
- **Dynamic Application Links**: 1-click **"Share Candidate Link"** generates unique public URLs (`http://<DOMAIN>/?apply=JOB_ID`) with clipboard copy feedback.
- **Role Manager**: Switch active screening roles or add new job openings in seconds.

### 2. 🌐 Dedicated Public Candidate Application Portal (`/?apply=JOB_ID`)
- **Distraction-Free Candidate Interface**: Candidates opening the shared link see only the branded application page for that specific job role.
- **Zero Recruiter Clutter**: No recruiter buttons, no access to other candidate data, rankings, or internal ATS scoring mechanisms.
- **Candidate Submission Form**: Name, Email, Phone, Years of Experience, Portfolio/LinkedIn, and Cover Note.
- **Drag-and-Drop Resume Upload**: Ingests `.pdf`, `.docx`, `.doc`, and `.txt` documents.
- **Cloud Confirmation Receipt**: Instant on-screen receipt with unique Application Reference ID (`app-xxx`) upon AWS S3 storage.

### 3. 🧠 Automated ATS Scoring & Ranked Candidate Pipeline
- **Descending Match Leaderboard**: Automatically ranks all applicants for the selected role from highest score to lowest:
  - **Rank #1 Top Match** (Emerald glow badge)
  - **Rank #2 Good Match** (Blue badge)
  - **Rank #3+ Moderate Fit** (Amber badge)
- **Weighted ATS Algorithm**:
  - **Skills Score (55%)**: Direct matching of required and preferred technical competencies.
  - **Experience Score (25%)**: Ratio of candidate experience to role requirement.
  - **Relevance Score (20%)**: Semantic document frequency and keyword hit rate.
- **Matched vs Missing Skills**: Live green/amber tag breakdown for fast visual screening.
- **AI-Tailored Technical Interview Questions**: Auto-generates customized technical questions based on candidate strengths, missing requirements, and cloud infrastructure experience.
- **Encrypted S3 Presigned URLs**: Secure, time-limited download links (1h, 24h, 7d) without making the S3 bucket public.

### 4. 📊 1-Click Excel / CSV Export
- Click **"Download Excel (.csv)"** to export a spreadsheet report.
- **Formatted Columns**:
  1. `Rank`
  2. `Candidate Name`
  3. `Email`
  4. `Phone`
  5. `Experience (Years)`
  6. `Target Job Role`
  7. `ATS Match Score (%)`
  8. `Recommendation Fit`
  9. `Matched Skills`
  10. `Missing Skills`
  11. `Skills Score (%)`
  12. `Experience Score (%)`
  13. `Relevance Score (%)`
  14. `Application Date`
  15. `S3 Object Key`
  16. `Notes / Portfolio`
- **Excel Compatible**: Formatted with UTF-8 BOM encoding for clean display in Microsoft Excel and Google Sheets.

### 5. 🔒 Recruiter Security Lock
- Protects recruiter panel from unauthorized public access.
- Requires passcode authentication (**Default**: `cloudats2026`, configurable via `.env`).

---

## ☁️ AWS Cloud Architecture

```mermaid
flowchart TD
    subgraph Candidate Portal [/apply?job=id]
        A[Candidate submits application & resume]
    end

    subgraph AWS Cloud Infrastructure
        B[AWS S3: Partitioned Object Storage /resumes/jobId/]
        C[AWS Textract / Parser: OCR & Skill Extraction]
        D[ATS Matching Engine: Weighted Score & Ranking]
        E[AWS CloudWatch: Real-Time Telemetry & Custom Metrics]
        F[AWS SES: Automated Candidate Email Confirmation]
        G[AWS STS: IAM Dynamic Identity Validation]
    end

    subgraph Recruiter Dashboard [/]
        H[Passcode Authentication Lock]
        I[Ranked Candidate Pipeline #1, #2, #3...]
        J[1-Click Candidate Link Generator]
        K[Excel / CSV Spreadsheet Exporter]
        L[AI Technical Interview Question Generator]
        M[AWS Cloud Ecosystem HUD]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    D --> F
    D --> I
    G --> H
    H --> I
    I --> J
    I --> K
    I --> L
    I --> M
```

| AWS Service | Purpose in CloudATS |
|---|---|
| **AWS S3** | Partitioned resume storage (`resumes/{jobId}/{timestamp}-{filename}`) with encrypted presigned URLs. |
| **AWS STS** | Validates IAM sessions, retrieves dynamic Account ID, and inspects caller ARN. |
| **AWS Textract** | AI OCR service to extract text, education, and technical skills from PDF and Word documents. |
| **AWS CloudWatch** | Emits custom telemetry metrics (`ResumesIngested`, `TopMatchesDetected`, `AtsMatchScore`) under the `CloudATS` namespace. |
| **AWS SES** | Dispatches automated candidate confirmation emails and recruiter application notifications. |

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite 5, TailwindCSS, Lucide React Icons, Axios
- **Backend**: Node.js, Express 5, Multer (Memory Storage)
- **AWS SDK v3**:
  - `@aws-sdk/client-s3` & `@aws-sdk/s3-request-presigner`
  - `@aws-sdk/client-sts`
  - `@aws-sdk/client-textract`
  - `@aws-sdk/client-cloudwatch`
  - `@aws-sdk/client-ses`
  - `@aws-sdk/client-rekognition`
- **Document Intelligence**: `mammoth` (DOCX parser), `pdf-parse` (PDF extractor)
- **Deployment**: Single-port Express production static serving + PM2 on AWS EC2

---

## 📁 Repository Structure

```
cloudats/
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules (protects .env & node_modules)
├── index.html                # Vite HTML entry point
├── package.json              # Dependencies and scripts
├── tailwind.config.js        # Tailwind CSS styling configuration
├── vite.config.js            # Vite bundler & API proxy configuration
├── data/                     # Persistent JSON data stores
│   ├── applications.json     # Saved candidate applications & ATS scores
│   └── job_profiles.json     # Configured job role descriptions & criteria
├── server/
│   └── server.js             # Express API server & AWS Cloud integrations
└── src/
    ├── main.jsx              # React DOM entry
    ├── App.jsx               # Top-level view router (Candidate vs Recruiter)
    ├── api.js                # Frontend API client
    ├── index.css             # Tailwind design tokens & base styles
    └── components/
        ├── CandidatePortal.jsx    # Pure, distraction-free candidate application page
        ├── RecruiterLogin.jsx     # Recruiter authentication lock screen
        └── RecruiterDashboard.jsx # Recruiter pipeline, ranking & Excel export panel
```

---

## 💻 Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/shravanbpatel954/CloudATS-CareerPortal.git
cd CloudATS-CareerPortal
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` with your AWS credentials:
```env
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=eu-north-1
AWS_S3_BUCKET_NAME=your_s3_bucket_name
AWS_SES_SENDER_EMAIL=your_verified_email@gmail.com
RECRUITER_PASSCODE=cloudats2026
PORT=5000
```

### 4. Start the Application
```bash
npm run dev
```
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`
- **Recruiter Passcode**: `cloudats2026`

---

## 🚀 AWS EC2 Production Deployment Guide

Deploying CloudATS on AWS EC2 allows anyone worldwide to access your candidate portal and recruiter panel.

### Step 1: Launch an EC2 Instance
1. In the **AWS Console**, navigate to **EC2** ➔ **Launch Instance**.
2. **Name**: `CloudATS-Server`
3. **AMI**: **Ubuntu 24.04 LTS** (Free Tier eligible).
4. **Instance Type**: `t2.micro` or `t3.micro`.
5. **Key Pair**: Select your `.pem` key pair.
6. **Security Group Rules (Inbound)**:
   - **SSH**: Port `22` (Source: `0.0.0.0/0`)
   - **Custom TCP**: Port `5000` (Source: `0.0.0.0/0`)
   - **HTTP**: Port `80` (Source: `0.0.0.0/0`)

### Step 2: Connect to EC2 & Install Node.js
Connect via SSH:
```bash
ssh -i "your-key.pem" ubuntu@<YOUR-EC2-PUBLIC-IP>
```

Install Node.js 20, Git, and PM2:
```bash
sudo apt update -y && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pm2
```

### Step 3: Clone Repository & Configure `.env`
```bash
git clone https://github.com/shravanbpatel954/CloudATS-CareerPortal.git
cd CloudATS-CareerPortal
npm install

# Create production .env file
nano .env
```

Paste your `.env` configuration:
```env
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=eu-north-1
AWS_S3_BUCKET_NAME=your_s3_bucket_name
AWS_SES_SENDER_EMAIL=your_verified_email@gmail.com
RECRUITER_PASSCODE=cloudats2026
PORT=5000
```
*(Save with `Ctrl + O`, `Enter`, and exit with `Ctrl + X`)*

### Step 4: Build & Start with PM2
```bash
# Build React frontend bundle
npm run build

# Start server 24/7 in background with PM2
pm2 start server/server.js --name cloudats
pm2 save
pm2 startup
```

### Step 5: Access Live URLs from Anywhere
- **Recruiter Command Center**: `http://<YOUR-EC2-PUBLIC-IP>:5000/` *(Passcode: `cloudats2026`)*
- **Candidate Application Link**: `http://<YOUR-EC2-PUBLIC-IP>:5000/?apply=qa-automation-eng`

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/recruiter` | Verifies recruiter passcode and returns session token |
| `GET` | `/api/status` | Returns AWS S3 and STS IAM caller status |
| `GET` | `/api/cloud/overview` | Detailed live status for S3, STS, Textract, CloudWatch, and SES |
| `GET` | `/api/jobs` | Retrieves all configured job roles |
| `POST` | `/api/jobs` | Creates a new custom job role and criteria |
| `DELETE` | `/api/jobs/:id` | Deletes a custom job role |
| `GET` | `/api/jobs/:id/public` | Public role details for candidate portal |
| `POST` | `/api/candidate/apply` | Ingests candidate form & resume to S3, runs ATS scoring, emits CloudWatch metrics, and sends SES email |
| `GET` | `/api/ats/pipeline` | Retrieves ranked candidate list ordered by ATS score descending |
| `GET` | `/api/ats/export` | Generates and downloads candidate spreadsheet (`.csv` / Excel format) |
| `DELETE` | `/api/candidate/application/:id` | Deletes a candidate application from the pipeline |
| `GET` | `/api/files` | Lists objects stored in the AWS S3 bucket |
| `GET` | `/api/files/share` | Generates a time-limited presigned S3 download URL |

---

## ⚙️ Environment Variables Reference

| Variable | Description | Required | Default |
|---|---|---|---|
| `AWS_ACCESS_KEY_ID` | AWS IAM User Access Key | Yes | — |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM User Secret Key | Yes | — |
| `AWS_REGION` | AWS Region for S3 bucket | Yes | `eu-north-1` |
| `AWS_S3_BUCKET_NAME` | S3 Bucket name for storing candidate resumes | Yes | — |
| `AWS_SES_SENDER_EMAIL` | Verified AWS SES Sender email for candidate confirmations | Optional | — |
| `AWS_SESSION_TOKEN` | Session token for AWS Academy/Learner Lab accounts | Optional | — |
| `RECRUITER_PASSCODE` | Passcode to lock and unlock the Recruiter Dashboard | Yes | `cloudats2026` |
| `PORT` | Server listening port | Optional | `5000` |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
