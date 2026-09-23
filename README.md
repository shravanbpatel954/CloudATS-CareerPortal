# ☁️ CloudATS — Cloud-Native Resume Screener & Candidate Pipeline

---

## 1. 📌 Executive Summary & Project Overview

**CloudATS** is an enterprise-grade, cloud-native Applicant Tracking System (ATS) and Candidate Intelligence Screener. Built on modern web standards (React 18, Tailwind CSS, Express 5, and Node.js), CloudATS automates the resume screening and candidate evaluation lifecycle through deep integration with Amazon Web Services (AWS).

### 🎯 Key Objectives:
- **Zero-Friction Candidate Application Portal**: Public-facing, distraction-free application links (`/?apply=<jobId>`) allowing candidates to upload resumes and submit structured profiles.
- **Automated Resume Ingestion & OCR**: Multi-format document parsing (`.pdf`, `.docx`, `.doc`, `.txt`, `.png`, `.jpg`) backed by AWS document intelligence.
- **Intelligent ATS Scoring Engine**: Weighted multi-factor candidate scoring (Skills Match, Experience Ratio, Document Keyword Relevance) with automatic leaderboard ranking (#1 Top Match, #2 Good Match, #3+ Moderate).
- **Recruiter Productivity Suite**: 1-click job role creation, custom skill taxonomy assignment, AI-generated technical interview questions, encrypted S3 presigned document viewing, and 1-click Excel/CSV pipeline export.
- **Enterprise Cloud Observability**: Real-time AWS telemetry, CloudWatch custom metric publishing, and automated SES candidate email confirmations.

---

## 2. 🏛️ AWS Cloud Architecture Diagram

```mermaid
flowchart TD
    subgraph Client Layer
        CP["🌐 Candidate Application Portal<br/>(Public: /?apply=job-id)"]
        RD["🔒 Recruiter ATS Command Center<br/>(Passcode Protected: /)"]
    end

    subgraph Compute & Hosting ["Compute & Hosting (AWS EC2)"]
        EC2["🖥️ Amazon EC2 Instance (Ubuntu 24.04 LTS)<br/>Node.js 22 + Express 5 Backend + React 18 SPA<br/>PM2 Process Manager (Port 5000)"]
    end

    subgraph Storage & Ingestion ["Storage & Identity"]
        S3["🪣 Amazon S3 Bucket<br/>Partitioned Storage: /resumes/{jobId}/<br/>Encrypted Presigned URLs (1h, 24h, 7d)"]
        STS["🔑 AWS STS (Security Token Service)<br/>Caller Identity & Academy Session Token Resolver"]
        IAM["🛡️ AWS IAM<br/>Least-Privilege Role & Policy Enforcement"]
    end

    subgraph AI & Document Intelligence ["AI & Document Intelligence"]
        TXT["📄 Amazon Textract<br/>OCR & Document Text Extraction"]
        REK["👁️ Amazon Rekognition<br/>Profile Image & Credential Label Detection"]
        PARSER["⚡ Multi-Format Document Engine<br/>Mammoth (.docx) + PDF-Parse (.pdf)"]
    end

    subgraph Notification & Telemetry ["Observability & Communication"]
        CW["📊 Amazon CloudWatch<br/>Namespace: CloudATS/RecruitmentPipeline<br/>Metrics: ResumeUploaded, CandidateEvaluated"]
        SES["✉️ Amazon SES (Simple Email Service)<br/>Automated Candidate Application Receipts"]
    end

    CP -->|"1. Submits Resume & Form"| EC2
    RD -->|"Manage Jobs, Screen & Export"| EC2

    EC2 -->|"2. Authenticates Credentials"| STS
    EC2 -->|"3. Stores Raw Resume"| S3
    EC2 -->|"4. Ingests Document for OCR"| TXT
    EC2 -->|"5. Analyzes Visual Credentials"| REK
    EC2 -->|"Fallback Local Parser"| PARSER

    EC2 -->|"6. Publishes Telemetry Metrics"| CW
    EC2 -->|"7. Dispatches Receipt Email"| SES
    EC2 -->|"8. Generates Time-Limited Download Link"| S3
```

---

## 3. ☁️ Deep-Dive: AWS Services Utilized

| AWS Service | Core Purpose in CloudATS | Integration Details & SDK Calls |
| :--- | :--- | :--- |
| **Amazon EC2** | Production Application Hosting | Hosts the unified Node.js runtime and statically served React SPA under PM2 process supervisor. |
| **Amazon S3** | Object Storage for Resumes | Secure partitioned bucket storage (`/resumes/{jobId}/...`) with encrypted Presigned URLs. |
| **Amazon Textract** | AI Document OCR & Parsing | Optical character recognition for extracting text and structured data from PDF resumes. |
| **Amazon Rekognition** | Image Analysis & Verification | Deep-learning visual inspection, credential badge recognition, and label detection. |
| **Amazon CloudWatch** | Operational Metrics & Monitoring | Custom metric publishing under namespace `CloudATS/RecruitmentPipeline` for real-time telemetry. |
| **Amazon SES** | Transactional Email Dispatch | Sends automated, branded application confirmation emails to candidates upon successful submission. |
| **AWS STS** | Identity & Session Validation | Dynamically verifies IAM caller identity and supports short-lived session tokens (AWS Academy/Labs). |
| **AWS IAM** | Access Control & Security Governance | Enforces Least Privilege access policies for backend services. |

---

### 3.1. Amazon EC2 (Elastic Compute Cloud)
- **Role**: Serves as the compute backbone hosting the entire CloudATS platform.
- **Instance Specification**:
  - **OS**: Ubuntu Linux (24.04 LTS / 22.04 LTS)
  - **Runtime**: Node.js 22.x LTS with npm 10.x
  - **Process Management**: **PM2** ensures continuous execution, background uptime, automatic reboot recovery, and memory monitoring.
  - **Networking & Firewall**: EC2 Security Group configured with inbound TCP rule on port `5000` (or `80`/`443` when behind Nginx reverse proxy).
  - **Single-Server Architecture**: The Express 5 backend directly serves the pre-compiled production Vite/React build from `/dist`, minimizing compute footprint and latency.

---

### 3.2. Amazon S3 (Simple Storage Service)
- **Role**: Highly scalable, durable (99.999999999% durability) object store for resumes and applicant documents.
- **Key Implementation Highlights**:
  - **Partitioning Strategy**: Resumes are organized hierarchically:
    ```text
    s3://your-cloudats-bucket/resumes/{jobId}/{timestamp}_{filename}
    ```
  - **Presigned URLs (`@aws-sdk/s3-request-presigner`)**:
    - Generates temporary, cryptographically signed URLs for viewing or downloading candidate resumes without making the S3 bucket public.
    - Selectable expiration windows: **1 Hour**, **24 Hours**, or **7 Days**.
  - **Metadata Tagging**: Ingested files store metadata headers including candidate name, email, target job role ID, and application timestamp.

---

### 3.3. Amazon Textract
- **Role**: Machine learning document analysis service for OCR and resume text extraction.
- **Features Used**:
  - `DetectDocumentTextCommand`: Analyzes raw document byte arrays to extract high-accuracy text streams from multi-column PDF resumes.
  - **Hybrid Fallback Engine**: If Textract reaches rate limits or non-standard formats, CloudATS seamlessly falls back to embedded multi-format parsers (`pdf-parse`, `mammoth` for `.docx`, and text sanitizers).

---

### 3.4. Amazon Rekognition
- **Role**: Computer vision service powered by deep learning for visual document and candidate credential analysis.
- **Features Used**:
  - `DetectLabelsCommand`: Automatically analyzes image-based candidate uploads (such as certificates, portfolios, or image resumes), identifying key technical objects, document types, and visual properties with confidence percentages (>70%).
  - `DetectTextCommand`: Extracts embedded text from graphical images and scanned certificates.

---

### 3.5. Amazon CloudWatch
- **Role**: Observability and operational intelligence.
- **Custom Metrics Published**:
  - **Namespace**: `CloudATS/RecruitmentPipeline`
  - **Dimensions**: `Environment=Production`
  - **Key Metrics Tracked**:
    - `ResumeUploaded` (Count): Tracks real-time incoming application volume.
    - `CandidateEvaluated` (Count): Monitors ATS automated screening runs.
    - `PipelineExported` (Count): Logs candidate data export events.
- **SDK Action**: Executed asynchronously using `PutMetricDataCommand` to ensure zero impact on candidate response times.

---

### 3.6. Amazon SES (Simple Email Service)
- **Role**: Enterprise cloud email notification service.
- **Automated Workflows**:
  - Dispatches immediate, HTML-formatted confirmation receipts to candidates upon resume upload.
  - Includes candidate application ID (`app-xxxxxx`), submitted job title, and company receipt acknowledgment.
  - Handles sandbox verification gracefully with informative console logging when SES is in development mode.

---

### 3.7. AWS STS & IAM (Security Token Service & Access Management)
- **Role**: Secure authentication and identity federation.
- **Features Used**:
  - `GetCallerIdentityCommand`: Validates active IAM credentials, AWS Account ID, and ARN on server startup.
  - **AWS Academy / Learner Lab Support**: Full support for `AWS_SESSION_TOKEN` environment variable for temporary session-based credential rotation.
  - **Least Privilege IAM Policy Recommendation**:
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "s3:PutObject",
            "s3:GetObject",
            "s3:ListBucket",
            "s3:DeleteObject"
          ],
          "Resource": [
            "arn:aws:s3:::your-cloudats-bucket",
            "arn:aws:s3:::your-cloudats-bucket/*"
          ]
        },
        {
          "Effect": "Allow",
          "Action": [
            "textract:DetectDocumentText",
            "rekognition:DetectLabels",
            "rekognition:DetectText",
            "cloudwatch:PutMetricData",
            "ses:SendEmail",
            "sts:GetCallerIdentity"
          ],
          "Resource": "*"
        }
      ]
    }
    ```

---

## 4. 🧠 ATS Scoring Algorithm & Candidate Ranking Logic

CloudATS evaluates applicant resumes against role requirements using a multi-dimensional weighted matching algorithm:

$$\text{ATS Total Score} = (0.55 \times \text{Skills Score}) + (0.25 \times \text{Experience Score}) + (0.20 \times \text{Relevance Score})$$

### 1. Skills Score (55% Weight)
- Matches parsed resume text against:
  - **Required Skills** (Weighted higher: $1.0\times$)
  - **Preferred Skills** (Bonus weight: $0.5\times$)
- Compares against the comprehensive **Tech Skills Dictionary** spanning 100+ technologies (Testing/QA, Frontend, Backend, Cloud/DevOps, Databases, AI/ML).

### 2. Experience Score (25% Weight)
- Evaluates candidate years of experience against role requirement:
  $$\text{Experience Score} = \min\left(100, \frac{\text{Candidate Years}}{\text{Required Years}} \times 100\right)$$

### 3. Relevance Score (20% Weight)
- Analyzes term frequency-inverse density, keyword density, and role-specific taxonomy occurrences across the extracted resume text.

### 4. Automated Ranking & Tier Badges
- **Rank #1 — Strong Match (Score $\ge 80\%$)**: Emerald Highlight + Leaderboard crown.
- **Rank #2 — Good Match (Score $60\% - 79\%$)**: Blue Badge + Recommended for Interview.
- **Rank #3+ — Moderate Fit (Score $< 60\%$)**: Amber Badge + Skill gap review suggested.

---

## 5. 📊 1-Click Excel / CSV Export Feature

Recruiters can export candidate evaluation pipelines for any role with a single click:
- **Encoding**: UTF-8 with Byte Order Mark (`\uFEFF`) ensuring full compatibility with Microsoft Excel, Apple Numbers, and Google Sheets.
- **Data Fields Exported**:
  1. Rank Position (`#1`, `#2`, ...)
  2. Candidate Name
  3. Email & Phone Number
  4. Years of Experience
  5. Target Job Role Title
  6. ATS Overall Match Score (%)
  7. Fit Recommendation (`Top Match`, `Good Match`, `Moderate Fit`)
  8. Matched Skills List
  9. Missing Skills / Gaps
  10. Skills Score breakdown (%)
  11. Experience Score breakdown (%)
  12. Keyword Relevance Score breakdown (%)
  13. S3 Document Object Key
  14. Application Timestamp

---

## 6. 🛠️ Environment Configuration Reference (`.env`)

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `AWS_ACCESS_KEY_ID` | **Yes** | IAM Access Key ID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | **Yes** | IAM Secret Access Key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | **Yes** | AWS Region for S3, SES, etc. | `eu-north-1` |
| `AWS_S3_BUCKET_NAME` | **Yes** | Target S3 bucket for resumes | `cloudats-resumes-bucket` |
| `AWS_SESSION_TOKEN` | Optional | STS session token (Academy/Labs) | `IQoJb3JpZ2luX2Vj...` |
| `AWS_SES_SENDER_EMAIL` | Optional | Verified sender email for SES | `recruiter@yourdomain.com` |
| `RECRUITER_PASSCODE` | Optional | Recruiter dashboard password | `cloudats2026` |
| `PORT` | Optional | Backend HTTP server port | `5000` |
| `NODE_ENV` | Optional | Application runtime environment | `production` |

---

## 7. 🚀 Production Deployment & Maintenance Runbook (EC2)

### Starting & Managing with PM2
```bash
# 1. Check process status
pm2 status

# 2. View live streaming logs
pm2 logs cloudats

# 3. Restart application after updates
pm2 restart cloudats

# 4. Stop application
pm2 stop cloudats
```

### Health Check Endpoint
```bash
curl http://localhost:5000/api/status
```
**Expected Response**:
```json
{
  "status": "connected",
  "configured": true,
  "region": "eu-north-1",
  "bucket": "cloudats-resumes-bucket",
  "sesConfigured": true
}
```

---

*Authored for CloudATS Enterprise Recruitment Platform — Built on AWS Cloud Services.*
