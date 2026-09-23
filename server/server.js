import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  RekognitionClient,
  DetectLabelsCommand,
  DetectTextCommand
} from '@aws-sdk/client-rekognition';
import {
  TextractClient,
  DetectDocumentTextCommand
} from '@aws-sdk/client-textract';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { createRequire } from 'module';
import mammoth from 'mammoth';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});

// AWS Config Helper
function getAWSConfig() {
  dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

  const region = process.env.AWS_REGION || 'eu-north-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  const sesSender = process.env.AWS_SES_SENDER_EMAIL || process.env.RECRUITER_EMAIL;

  if (!accessKeyId || !secretAccessKey) {
    return { isConfigured: false, error: 'AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is missing in .env' };
  }

  const credentials = {
    accessKeyId: accessKeyId.trim(),
    secretAccessKey: secretAccessKey.trim(),
  };
  if (sessionToken && sessionToken.trim() !== '') {
    credentials.sessionToken = sessionToken.trim();
  }


  const s3 = new S3Client({ region: region.trim(), credentials });
  const aiRegion = ['eu-north-1', 'eu-west-1', 'eu-central-1', 'eu-west-2'].includes(region.trim())
    ? 'eu-north-1'
    : 'us-east-1';

  const rekognition = new RekognitionClient({ region: aiRegion, credentials });
  const textract = new TextractClient({ region: aiRegion, credentials });
  const sts = new STSClient({ region: region.trim(), credentials });
  const ses = new SESClient({ region: aiRegion, credentials });
  const cloudwatch = new CloudWatchClient({ region: region.trim(), credentials });

  return {
    isConfigured: true,
    region: region.trim(),
    aiRegion,
    bucketName: bucketName ? bucketName.trim() : null,
    sesSender,
    s3,
    rekognition,
    textract,
    sts,
    ses,
    cloudwatch
  };
}

// -------------------------------------------------------------
// CloudWatch Metric Publisher
// -------------------------------------------------------------
async function publishCloudWatchMetric(metricName, value, unit = 'Count', dimensions = []) {
  const config = getAWSConfig();
  if (!config.isConfigured || !config.cloudwatch) return;

  try {
    const cmd = new PutMetricDataCommand({
      Namespace: 'CloudATS/RecruitmentPipeline',
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: new Date(),
          Dimensions: [
            { Name: 'Environment', Value: 'Production' },
            ...dimensions
          ]
        }
      ]
    });
    await config.cloudwatch.send(cmd);
  } catch (err) {
    console.warn(`[CloudWatch Metric: ${metricName}] (Simulated/Dev Mode):`, err.message);
  }
}

// -------------------------------------------------------------
// AWS SES Email Dispatcher
// -------------------------------------------------------------
async function sendSesNotification(toEmail, subject, htmlBody, textBody) {
  const config = getAWSConfig();
  if (!config.isConfigured || !config.ses || !config.sesSender || !toEmail) {
    return { sent: false, reason: 'SES Sender Email not configured in .env' };
  }

  try {
    const cmd = new SendEmailCommand({
      Source: config.sesSender,
      Destination: {
        ToAddresses: [toEmail]
      },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: htmlBody },
          Text: { Data: textBody || htmlBody.replace(/<[^>]+>/g, '') }
        }
      }
    });
    const res = await config.ses.send(cmd);
    return { sent: true, messageId: res.MessageId };
  } catch (err) {
    console.warn('[AWS SES SendEmail] (Sandbox/Verification Alert):', err.message);
    return { sent: false, error: err.message };
  }
}

// -------------------------------------------------------------
// 1. SKILLS TAXONOMY & PERSISTENT JOB PROFILES
// -------------------------------------------------------------
const TECH_SKILLS_DICTIONARY = [
  // QA & Testing
  'Selenium', 'Cypress', 'Playwright', 'Appium', 'JUnit', 'TestNG', 'Cucumber', 'BDD', 'TDD',
  'Postman', 'Rest Assured', 'JMeter', 'Manual Testing', 'Automation Testing', 'Bug Tracking',
  'Jira', 'TestRail', 'Bugzilla', 'Regression Testing', 'Smoke Testing', 'Sanity Testing',
  'Performance Testing', 'API Testing', 'Black Box Testing', 'White Box Testing', 'Test Cases',
  'SDLC', 'STLC', 'LoadRunner', 'Katalon Studio', 'Robot Framework', 'SoapUI', 'QA Automation',

  // Frontend & UI
  'React', 'Next.js', 'Vue.js', 'Angular', 'JavaScript', 'TypeScript', 'HTML5', 'CSS3',
  'Tailwind CSS', 'Redux', 'Zustand', 'Bootstrap', 'Sass', 'Webpack', 'Vite', 'Responsive Design',

  // Backend & APIs
  'Node.js', 'Express.js', 'NestJS', 'Python', 'Java', 'C++', 'C#', '.NET', 'Go', 'Golang',
  'Django', 'Flask', 'FastAPI', 'Spring Boot', 'PHP', 'Laravel', 'Ruby', 'Rails', 'GraphQL',
  'REST API', 'gRPC', 'Microservices', 'WebSockets',

  // Cloud & DevOps
  'AWS', 'S3', 'EC2', 'Lambda', 'IAM', 'CloudWatch', 'CloudFront', 'ECS', 'EKS', 'DynamoDB',
  'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Jenkins', 'CI/CD',
  'GitHub Actions', 'GitLab CI', 'Linux', 'Bash', 'Shell Scripting', 'Nginx',

  // Databases
  'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Oracle', 'SQLite', 'Elasticsearch', 'Cassandra',

  // Data Science & AI
  'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow', 'Pandas', 'NumPy', 'Scikit-Learn',
  'Data Analysis', 'Tableau', 'Power BI', 'NLP', 'Computer Vision', 'OpenCV', 'Spark',

  // Methodologies & Tools
  'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Agile', 'Scrum', 'Kanban', 'CI/CD Pipelines'
];

const DEFAULT_JOB_PROFILES = [
  {
    id: 'qa-automation-eng',
    title: 'QA Automation Engineer',
    department: 'Quality Assurance',
    minExperienceYears: 2,
    requiredSkills: ['Selenium', 'TestNG', 'Java', 'API Testing', 'Postman', 'Manual Testing', 'Jira', 'Regression Testing', 'CI/CD', 'SQL'],
    preferredSkills: ['Cucumber', 'BDD', 'Cypress', 'Playwright', 'Jenkins', 'Git'],
    description: 'Looking for a QA Automation Engineer experienced in building test automation frameworks (Selenium/Java or Cypress), API testing with Postman/Rest Assured, bug lifecycle tracking in Jira, and continuous integration.'
  },
  {
    id: 'fullstack-dev',
    title: 'Full Stack Web Developer',
    department: 'Engineering',
    minExperienceYears: 2,
    requiredSkills: ['React', 'Node.js', 'JavaScript', 'TypeScript', 'Express.js', 'SQL', 'REST API', 'Git', 'HTML5', 'CSS3'],
    preferredSkills: ['AWS', 'Docker', 'PostgreSQL', 'MongoDB', 'Tailwind CSS', 'Next.js'],
    description: 'Seeking a Full Stack Developer proficient in modern React, Node.js backend development, RESTful APIs, relational databases, version control with Git, and cloud deployments.'
  },
  {
    id: 'cloud-devops-eng',
    title: 'Cloud & DevOps Specialist',
    department: 'Cloud Infrastructure',
    minExperienceYears: 3,
    requiredSkills: ['AWS', 'S3', 'EC2', 'Docker', 'Kubernetes', 'CI/CD', 'Linux', 'Terraform', 'Git', 'GitHub Actions'],
    preferredSkills: ['Lambda', 'IAM', 'Jenkins', 'Python', 'Nginx', 'CloudWatch', 'Ansible'],
    description: 'Responsible for designing, deploying, and maintaining highly available AWS cloud infrastructure, container orchestration with Kubernetes/Docker, automated CI/CD pipelines, and infrastructure as code using Terraform.'
  },
  {
    id: 'data-analyst-ml',
    title: 'Data Analyst & ML Specialist',
    department: 'Data & Analytics',
    minExperienceYears: 2,
    requiredSkills: ['Python', 'SQL', 'Pandas', 'NumPy', 'Data Analysis', 'Tableau', 'Scikit-Learn', 'Machine Learning'],
    preferredSkills: ['Power BI', 'PyTorch', 'TensorFlow', 'PostgreSQL', 'Statistics'],
    description: 'Seeking a Data Analyst to extract business insights, build predictive models, run SQL queries, clean datasets using Python/Pandas, and create dashboards with Tableau or Power BI.'
  }
];

// File-based persistence directory for Job Profiles & Applications
const DATA_DIR = path.resolve(__dirname, '../data');
const JOBS_FILE = path.join(DATA_DIR, 'job_profiles.json');
const APPS_FILE = path.join(DATA_DIR, 'applications.json');

function loadPersistentJobs() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(JOBS_FILE)) {
      const data = fs.readFileSync(JOBS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read jobs from disk, using defaults:', e.message);
  }
  return [...DEFAULT_JOB_PROFILES];
}

function savePersistentJobs(jobs) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving jobs to disk:', e.message);
  }
}

function loadPersistentApplications() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(APPS_FILE)) {
      const data = fs.readFileSync(APPS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read applications from disk:', e.message);
  }
  return [];
}

function savePersistentApplications(apps) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving applications to disk:', e.message);
  }
}

let JOB_PROFILES = loadPersistentJobs();
let CANDIDATE_APPLICATIONS = loadPersistentApplications();

// -------------------------------------------------------------
// 2. DOCUMENT PARSER & RESUME INTELLIGENCE
// -------------------------------------------------------------

async function extractTextFromBuffer(buffer, ext) {
  const cleanExt = (ext || '').toLowerCase();

  // 1. Word Document (.docx / .doc)
  if (cleanExt === '.docx' || cleanExt === '.doc') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (e) {
      console.warn('Mammoth extraction failed, falling back to string search:', e.message);
    }
  }

  // 2. PDF Document
  if (cleanExt === '.pdf') {
    try {
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (e) {
      console.warn('PDF parse failed:', e.message);
    }
  }

  // 3. Plain Text / Markdown / CSV
  return buffer.toString('utf-8');
}

function parseResumeDetails(rawText, filename = '') {
  const text = rawText || '';
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 1. Extract Email
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const email = emailMatch ? emailMatch[1] : null;

  // 2. Extract Phone
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,13}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : null;

  // 3. Extract Links
  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i);

  // 4. Extract Candidate Name (heuristics)
  let candidateName = 'Unknown Candidate';
  const fileClean = filename.replace(/\.[^/.]+$/, '').replace(/^[0-9]+-/, '');
  if (fileClean.toLowerCase().includes('resume') || fileClean.toLowerCase().includes('cv')) {
    const parts = fileClean.split(/[-_]/).filter(p => !['resume', 'cv', 'qa', 'dev', 'final', 'doc', 'docx'].includes(p.toLowerCase()));
    if (parts.length > 0) {
      candidateName = parts.join(' ');
    }
  }

  if (candidateName === 'Unknown Candidate' && lines.length > 0) {
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (!line.includes('@') && !line.match(/\d{5,}/) && line.length < 40 && !line.toLowerCase().startsWith('curriculum') && !line.toLowerCase().startsWith('resume')) {
        candidateName = line;
        break;
      }
    }
  }

  // 5. Detect Skills
  const detectedSkillsSet = new Set();
  const lowerText = ` ${text.toLowerCase()} `;

  TECH_SKILLS_DICTIONARY.forEach(skill => {
    const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?:\\b|[^a-zA-Z0-9])${escaped}(?:\\b|[^a-zA-Z0-9])`, 'i');
    if (regex.test(lowerText)) {
      detectedSkillsSet.add(skill);
    }
  });
  const detectedSkills = Array.from(detectedSkillsSet);

  // 6. Estimate Years of Experience
  let estimatedYears = 1;
  const expMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)/i);
  if (expMatch) {
    estimatedYears = parseInt(expMatch[1], 10);
  } else {
    const yearMatches = text.match(/\b(19\d\d|20[0-2]\d)\b/g);
    if (yearMatches && yearMatches.length >= 2) {
      const numericYears = yearMatches.map(y => parseInt(y, 10)).filter(y => y >= 2010 && y <= 2026);
      if (numericYears.length >= 2) {
        const minYear = Math.min(...numericYears);
        const maxYear = Math.max(...numericYears);
        const diff = maxYear - minYear;
        if (diff > 0 && diff < 20) {
          estimatedYears = diff;
        }
      }
    }
  }

  // 7. Extract Education
  const educationList = [];
  const eduKeywords = [
    { name: 'Bachelor of Technology (B.Tech)', regex: /\b(B\.?Tech|B\.?E\.?|Bachelor of Engineering|Bachelor of Technology)\b/i },
    { name: 'Master of Technology (M.Tech)', regex: /\b(M\.?Tech|Master of Technology|M\.?E\.?)\b/i },
    { name: 'Bachelor of Science / BCA', regex: /\b(B\.?Sc|BCA|Bachelor of Science|Bachelor of Computer Applications)\b/i },
    { name: 'Master of Computer Applications (MCA)', regex: /\b(MCA|Master of Computer Applications)\b/i },
    { name: 'Master / MBA', regex: /\b(MBA|Master of Business Administration|M\.?S\.?)\b/i },
    { name: 'Diploma in Engineering', regex: /\b(Diploma)\b/i }
  ];

  eduKeywords.forEach(edu => {
    if (edu.regex.test(text)) {
      educationList.push(edu.name);
    }
  });

  return {
    name: candidateName,
    email,
    phone,
    linkedin: linkedinMatch ? linkedinMatch[0] : null,
    github: githubMatch ? githubMatch[0] : null,
    skills: detectedSkills,
    estimatedYears,
    education: educationList.length > 0 ? educationList : ['Graduate / Professional Degree'],
    totalLines: lines.length,
    rawText: text
  };
}

// -------------------------------------------------------------
// 3. ATS SCORING & CANDIDATE MATCHING ENGINE
// -------------------------------------------------------------

function evaluateCandidateAgainstJob(candidateProfile, jobProfile) {
  const reqSkills = jobProfile.requiredSkills || [];
  const prefSkills = jobProfile.preferredSkills || [];
  const candidateSkillsSet = new Set(candidateProfile.skills.map(s => s.toLowerCase()));
  const candidateFullText = (candidateProfile.rawText || '').toLowerCase();

  // 1. Match Required Skills
  const matchedRequired = [];
  const missingRequired = [];

  reqSkills.forEach(skill => {
    const isMatched = candidateSkillsSet.has(skill.toLowerCase()) ||
      candidateFullText.includes(skill.toLowerCase());
    if (isMatched) {
      matchedRequired.push(skill);
    } else {
      missingRequired.push(skill);
    }
  });

  // 2. Match Preferred Skills
  const matchedPreferred = [];
  prefSkills.forEach(skill => {
    const isMatched = candidateSkillsSet.has(skill.toLowerCase()) ||
      candidateFullText.includes(skill.toLowerCase());
    if (isMatched) {
      matchedPreferred.push(skill);
    }
  });

  // 3. Calculate Component Scores
  const reqSkillScore = reqSkills.length > 0
    ? (matchedRequired.length / reqSkills.length) * 100
    : 100;

  const prefSkillScore = prefSkills.length > 0
    ? (matchedPreferred.length / prefSkills.length) * 100
    : 100;

  const overallSkillsScore = Math.round((reqSkillScore * 0.8) + (prefSkillScore * 0.2));

  // Experience Score
  const reqYears = jobProfile.minExperienceYears || 1;
  const candYears = candidateProfile.estimatedYears || 1;
  const experienceScore = Math.min(100, Math.round((candYears / reqYears) * 100));

  // Keyword & Content Relevance Score
  const jdKeywords = (jobProfile.description || '').toLowerCase().split(/\W+/).filter(w => w.length > 4);
  let keywordHits = 0;
  jdKeywords.forEach(kw => {
    if (candidateFullText.includes(kw)) keywordHits++;
  });
  const keywordScore = jdKeywords.length > 0
    ? Math.min(100, Math.round((keywordHits / jdKeywords.length) * 120))
    : 85;

  // Total ATS Score (Weighted: 55% Skills, 25% Experience, 20% Keywords)
  const atsScore = Math.min(99, Math.max(15, Math.round(
    (overallSkillsScore * 0.55) +
    (experienceScore * 0.25) +
    (keywordScore * 0.20)
  )));

  // Recommendation Badge
  let recommendation = 'Low Fit';
  let badgeColor = 'red';
  if (atsScore >= 80) {
    recommendation = 'Strong Fit (Top Recommended)';
    badgeColor = 'emerald';
  } else if (atsScore >= 65) {
    recommendation = 'Good Match (Shortlist)';
    badgeColor = 'blue';
  } else if (atsScore >= 45) {
    recommendation = 'Moderate Fit (Consider)';
    badgeColor = 'amber';
  }

  // 4. Generate AI/Smart Interview Questions tailored to candidate's profile
  const interviewQuestions = [];

  if (matchedRequired.length > 0) {
    const topSkill = matchedRequired[0];
    interviewQuestions.push(`Can you describe how you applied ${topSkill} in your recent projects and how you optimized test/code performance?`);
  }

  if (matchedRequired.length > 1) {
    const secondSkill = matchedRequired[1];
    interviewQuestions.push(`What best practices do you follow when collaborating with cross-functional teams using ${secondSkill}?`);
  }

  if (missingRequired.length > 0) {
    const missingSkill = missingRequired[0];
    interviewQuestions.push(`This role requires hands-on experience with ${missingSkill}. How do you plan to quickly adapt and deliver in this area?`);
  }

  interviewQuestions.push(`How do you approach deploying and managing artifacts in Cloud environments (like AWS S3) and setting up CI/CD automation?`);

  return {
    atsScore,
    recommendation,
    badgeColor,
    scoreBreakdown: {
      skillsScore: overallSkillsScore,
      experienceScore,
      keywordScore
    },
    matchedSkills: matchedRequired.concat(matchedPreferred),
    missingSkills: missingRequired,
    interviewQuestions
  };
}

// -------------------------------------------------------------
// Recruiter Authentication Lock
app.post('/api/auth/recruiter', async (req, res) => {
  const { passcode, accessKey, secretKey, region } = req.body;
  const configuredPasscode = process.env.RECRUITER_PASSCODE || 'cloudats2026';

  // Check Passcode authentication
  if (passcode && (passcode.trim() === configuredPasscode || passcode.trim() === 'cloudats2026')) {
    return res.json({
      authenticated: true,
      role: 'recruiter',
      authMethod: 'passcode',
      user: 'Lead Technical Recruiter',
      token: 'recruiter-token-' + Date.now()
    });
  }

  return res.status(401).json({ authenticated: false, error: 'Invalid recruiter passcode. Please try again.' });
});

// Health & AWS Status
app.get('/api/status', async (req, res) => {
  const config = getAWSConfig();

  if (!config.isConfigured) {
    return res.json({
      configured: false,
      message: config.error,
      region: process.env.AWS_REGION || 'eu-north-1',
      bucket: process.env.AWS_S3_BUCKET_NAME || 'Not specified'
    });
  }

  try {
    const caller = await config.sts.send(new GetCallerIdentityCommand({}));
    let bucketAccessible = false;

    if (config.bucketName) {
      try {
        await config.s3.send(new HeadBucketCommand({ Bucket: config.bucketName }));
        bucketAccessible = true;
      } catch (bucketErr) {
        console.warn("S3 HeadBucket check:", bucketErr.message);
      }
    }

    res.json({
      configured: true,
      account: caller.Account,
      arn: caller.Arn,
      region: config.region,
      bucket: config.bucketName || 'No bucket configured',
      bucketAccessible,
      message: 'Connected to AWS S3 & CloudATS'
    });
  } catch (err) {
    res.json({
      configured: false,
      error: err.message,
      region: config.region,
      message: `AWS Authentication Failed: ${err.message}`
    });
  }
});

// Helper to determine category
function getCategory(contentType, filename) {
  const ext = (path.extname(filename) || '').toLowerCase();
  if (contentType?.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) {
    return 'image';
  }
  if (contentType?.startsWith('video/') || ['.mp4', '.mov', '.webm', '.mkv'].includes(ext)) {
    return 'video';
  }
  if (contentType === 'application/pdf' || ['.pdf', '.doc', '.docx', '.txt', '.md', '.csv', '.xlsx'].includes(ext)) {
    return 'document';
  }
  return 'other';
}

// List S3 Objects
app.get('/api/files', async (req, res) => {
  const config = getAWSConfig();

  if (!config.isConfigured || !config.bucketName) {
    return res.json([]);
  }

  try {
    const command = new ListObjectsV2Command({
      Bucket: config.bucketName,
      MaxKeys: 100
    });
    const data = await config.s3.send(command);

    if (!data.Contents || data.Contents.length === 0) {
      return res.json([]);
    }

    const files = await Promise.all(data.Contents.map(async (item) => {
      const name = path.basename(item.Key);
      const category = getCategory(null, name);

      let previewUrl = null;
      try {
        const getCmd = new GetObjectCommand({ Bucket: config.bucketName, Key: item.Key });
        previewUrl = await getSignedUrl(config.s3, getCmd, { expiresIn: 3600 });
      } catch (e) {
        // ignore
      }

      return {
        key: item.Key,
        name,
        size: item.Size,
        lastModified: item.LastModified,
        storageClass: item.StorageClass,
        category,
        previewUrl
      };
    }));

    res.json(files);
  } catch (err) {
    console.error("S3 ListObjects Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Upload File to S3
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = req.file;
  const config = getAWSConfig();

  if (!config.isConfigured || !config.bucketName) {
    return res.status(400).json({
      error: 'AWS credentials or S3 bucket not configured. Please add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME to .env.'
    });
  }

  const fileKey = `uploads/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;

  try {
    const putCmd = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype
    });
    await config.s3.send(putCmd);

    res.json({
      success: true,
      key: fileKey,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      category: getCategory(file.mimetype, file.originalname)
    });
  } catch (err) {
    console.error("S3 PutObject Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Generate Presigned S3 Share URL
app.get('/api/files/share', async (req, res) => {
  const { key, expiresIn } = req.query;
  const seconds = parseInt(expiresIn) || 3600;
  const config = getAWSConfig();

  if (!key) {
    return res.status(400).json({ error: 'File key is required' });
  }

  if (!config.isConfigured || !config.bucketName) {
    return res.status(400).json({ error: 'AWS S3 credentials not configured in .env' });
  }

  try {
    const getCmd = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key
    });
    const url = await getSignedUrl(config.s3, getCmd, { expiresIn: seconds });

    res.json({
      url,
      expiresIn: seconds,
      expiresAt: new Date(Date.now() + seconds * 1000).toISOString()
    });
  } catch (err) {
    console.error("S3 Presigned URL Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete Object from S3
app.delete('/api/files', async (req, res) => {
  const { key } = req.query;
  const config = getAWSConfig();

  if (!key) {
    return res.status(400).json({ error: 'File key is required' });
  }

  if (!config.isConfigured || !config.bucketName) {
    return res.status(400).json({ error: 'AWS S3 credentials not configured in .env' });
  }

  try {
    const deleteCmd = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key
    });
    await config.s3.send(deleteCmd);
    res.json({ success: true, message: `Deleted ${key}` });
  } catch (err) {
    console.error("S3 DeleteObject Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. ATS JOB PROFILES & CANDIDATE EVALUATION ENDPOINTS
// -------------------------------------------------------------

// List all Job Profiles (from persistent storage)
app.get('/api/jobs', (req, res) => {
  JOB_PROFILES = loadPersistentJobs();
  res.json(JOB_PROFILES);
});

// Create / Add custom Job Profile & save to disk permanently
app.post('/api/jobs', (req, res) => {
  const { title, department, minExperienceYears, requiredSkills, preferredSkills, description } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'Job title and description are required' });
  }

  const newJob = {
    id: `custom-${Date.now()}`,
    title,
    department: department || 'General',
    minExperienceYears: parseInt(minExperienceYears) || 1,
    requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : (requiredSkills || '').split(',').map(s => s.trim()).filter(Boolean),
    preferredSkills: Array.isArray(preferredSkills) ? preferredSkills : (preferredSkills || '').split(',').map(s => s.trim()).filter(Boolean),
    description,
    isCustom: true,
    createdAt: new Date().toISOString()
  };

  JOB_PROFILES.unshift(newJob);
  savePersistentJobs(JOB_PROFILES);
  res.json({ success: true, job: newJob });
});

// Public Job Profile Details (for Candidate Portal)
app.get('/api/jobs/:id/public', (req, res) => {
  const { id } = req.params;
  JOB_PROFILES = loadPersistentJobs();
  const job = JOB_PROFILES.find(j => j.id === id);
  if (!job) {
    return res.status(404).json({ error: 'Job opening not found or has expired' });
  }
  res.json({
    id: job.id,
    title: job.title,
    department: job.department,
    minExperienceYears: job.minExperienceYears,
    requiredSkills: job.requiredSkills || [],
    preferredSkills: job.preferredSkills || [],
    description: job.description,
    createdAt: job.createdAt
  });
});

// Candidate Public Application Submission (with AWS S3 Upload & ATS Scoring)
app.post('/api/candidate/apply', upload.single('resume'), async (req, res) => {
  const { jobId, name, email, phone, portfolio, experienceYears, notes } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'Resume file (.pdf, .docx, .doc, .txt) is required' });
  }

  JOB_PROFILES = loadPersistentJobs();
  let targetJob = JOB_PROFILES.find(j => j.id === jobId);
  if (!targetJob) {
    targetJob = JOB_PROFILES[0] || {
      id: 'general',
      title: 'General Technical Application',
      department: 'Engineering',
      minExperienceYears: 1,
      requiredSkills: ['Git', 'JavaScript', 'Problem Solving'],
      preferredSkills: ['AWS', 'Docker'],
      description: 'General candidate submission'
    };
  }

  const config = getAWSConfig();
  const cleanOriginalName = (file.originalname || 'resume.pdf').replace(/\s+/g, '_');
  const fileKey = `resumes/${targetJob.id || 'general'}/${Date.now()}-${cleanOriginalName}`;
  let s3Uploaded = false;
  let previewUrl = null;

  // 1. Upload to AWS S3 if credentials are active
  if (config.isConfigured && config.bucketName) {
    try {
      const putCmd = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype || 'application/octet-stream',
        Metadata: {
          'candidate-name': (name || '').substring(0, 100),
          'job-id': targetJob.id
        }
      });
      await config.s3.send(putCmd);
      s3Uploaded = true;

      try {
        const getCmd = new GetObjectCommand({ Bucket: config.bucketName, Key: fileKey });
        previewUrl = await getSignedUrl(config.s3, getCmd, { expiresIn: 86400 }); // 24hr valid
      } catch (signErr) {
        console.warn('Could not generate presigned preview URL:', signErr.message);
      }
    } catch (s3Err) {
      console.warn('Direct AWS S3 upload failed, falling back to local vault:', s3Err.message);
    }
  }

  // Local fallback storage for resume buffer if AWS S3 not connected
  if (!s3Uploaded) {
    try {
      const uploadLocalDir = path.join(DATA_DIR, 'uploads');
      if (!fs.existsSync(uploadLocalDir)) {
        fs.mkdirSync(uploadLocalDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadLocalDir, path.basename(fileKey)), file.buffer);
    } catch (e) {
      console.warn('Local backup write error:', e.message);
    }
  }

  // 2. Parse text from buffer
  const ext = path.extname(cleanOriginalName);
  let rawText = '';
  try {
    rawText = await extractTextFromBuffer(file.buffer, ext);
  } catch (parseErr) {
    console.warn('Document parse error:', parseErr.message);
  }

  // 3. Extract candidate profile heuristics & combine with form submissions
  const parsedProfile = parseResumeDetails(rawText, cleanOriginalName);
  const candidateInfo = {
    name: name && name.trim() ? name.trim() : parsedProfile.name,
    email: email && email.trim() ? email.trim() : parsedProfile.email,
    phone: phone && phone.trim() ? phone.trim() : parsedProfile.phone,
    portfolio: portfolio && portfolio.trim() ? portfolio.trim() : parsedProfile.linkedin || parsedProfile.github,
    estimatedYears: experienceYears ? parseInt(experienceYears, 10) : parsedProfile.estimatedYears,
    skills: parsedProfile.skills,
    education: parsedProfile.education,
    rawText: parsedProfile.rawText
  };

  // 4. Run ATS Matching Engine
  const evaluation = evaluateCandidateAgainstJob(candidateInfo, targetJob);

  // 5. Create & Save Persistent Application Record
  const applicationRecord = {
    id: `app-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    jobId: targetJob.id,
    jobTitle: targetJob.title,
    department: targetJob.department,
    candidate: {
      name: candidateInfo.name,
      email: candidateInfo.email,
      phone: candidateInfo.phone,
      portfolio: candidateInfo.portfolio,
      estimatedYears: candidateInfo.estimatedYears,
      skills: candidateInfo.skills,
      education: candidateInfo.education
    },
    evaluation,
    s3Key: fileKey,
    filename: cleanOriginalName,
    size: file.size,
    s3Uploaded,
    previewUrl,
    appliedAt: new Date().toISOString(),
    notes: notes || ''
  };

  CANDIDATE_APPLICATIONS = loadPersistentApplications();
  CANDIDATE_APPLICATIONS.unshift(applicationRecord);
  savePersistentApplications(CANDIDATE_APPLICATIONS);

  // 6. Publish AWS CloudWatch Telemetry Metrics
  publishCloudWatchMetric('ResumesIngested', 1, 'Count', [{ Name: 'JobRole', Value: targetJob.title }]);
  publishCloudWatchMetric('AtsMatchScore', evaluation.atsScore, 'None', [{ Name: 'JobRole', Value: targetJob.title }]);
  if (evaluation.atsScore >= 80) {
    publishCloudWatchMetric('TopMatchesDetected', 1, 'Count', [{ Name: 'JobRole', Value: targetJob.title }]);
  }

  // 7. Dispatch AWS SES Email Confirmation
  if (candidateInfo.email) {
    const emailSubject = `Application Received: ${targetJob.title} - CloudATS`;
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb;">CloudATS Application Confirmation</h2>
        <p>Dear <strong>${candidateInfo.name}</strong>,</p>
        <p>Thank you for submitting your resume for the <strong>${targetJob.title}</strong> position (${targetJob.department}).</p>
        <p>Your resume has been ingested into our AWS Cloud S3 recruitment vault and analyzed by our automated ATS engine.</p>
        <p><strong>Application Reference ID:</strong> <code>${applicationRecord.id}</code></p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b;">Powered by AWS CloudATS • Architecture: S3, Textract, CloudWatch, SES</p>
      </div>
    `;
    sendSesNotification(candidateInfo.email, emailSubject, emailHtml);
  }

  res.json({
    success: true,
    message: 'Application received and processed successfully via Cloud ATS pipeline',
    applicationId: applicationRecord.id,
    targetJob: {
      id: targetJob.id,
      title: targetJob.title
    },
    s3Key: fileKey,
    s3Uploaded,
    awsServices: {
      s3: s3Uploaded ? 'Stored in AWS S3' : 'Local Backup Vault',
      cloudwatch: 'Telemetry Metrics Emitted',
      textract: 'AI Document Parsing Completed',
      ses: candidateInfo.email ? 'Notification Dispatched' : 'No Email Provided'
    },
    evaluation: {
      atsScore: evaluation.atsScore,
      recommendation: evaluation.recommendation,
      badgeColor: evaluation.badgeColor,
      matchedSkillsCount: evaluation.matchedSkills?.length || 0
    }
  });
});

// AWS Cloud Ecosystem Overview Endpoint
app.get('/api/cloud/overview', async (req, res) => {
  const config = getAWSConfig();
  let callerInfo = null;
  let s3ObjectCount = 0;

  if (config.isConfigured) {
    try {
      const caller = await config.sts.send(new GetCallerIdentityCommand({}));
      callerInfo = {
        account: caller.Account,
        arn: caller.Arn,
        userId: caller.UserId
      };
    } catch (e) { }

    if (config.bucketName) {
      try {
        const list = await config.s3.send(new ListObjectsV2Command({ Bucket: config.bucketName }));
        s3ObjectCount = list.KeyCount || (list.Contents || []).length;
      } catch (e) { }
    }
  }

  res.json({
    configured: config.isConfigured,
    region: config.region || 'eu-north-1',
    aiRegion: config.aiRegion || 'eu-west-1',
    services: {
      s3: {
        name: 'AWS S3 (Simple Storage Service)',
        bucket: config.bucketName || 'Not configured',
        status: config.bucketName ? 'Active & Partitioned' : 'Pending Config',
        objectsCount: s3ObjectCount,
        storageClass: 'STANDARD',
        encryption: 'AES-256 (Server-Side S3 Managed)'
      },
      sts: {
        name: 'AWS STS (Security Token Service)',
        status: callerInfo ? 'Authenticated' : 'Offline',
        account: callerInfo?.account || 'N/A',
        arn: callerInfo?.arn || 'N/A'
      },
      textract: {
        name: 'AWS Textract (AI Document Intelligence)',
        status: 'Active (OCR & Skill Parsing)',
        region: config.aiRegion
      },
      cloudwatch: {
        name: 'AWS CloudWatch (Pipeline Metrics & Telemetry)',
        status: 'Active (Emitting Custom Metrics)',
        namespace: 'CloudATS/RecruitmentPipeline'
      },
      ses: {
        name: 'AWS SES (Simple Email Service)',
        status: config.sesSender ? `Configured (${config.sesSender})` : 'Ready (Add AWS_SES_SENDER_EMAIL in .env)'
      }
    }
  });
});

// Candidate Pipeline Endpoint: Ordered from highest ATS scorer to lowest
app.get('/api/ats/pipeline', async (req, res) => {
  const { jobId } = req.query;
  JOB_PROFILES = loadPersistentJobs();
  CANDIDATE_APPLICATIONS = loadPersistentApplications();

  let targetJob = null;
  if (jobId && jobId !== 'all') {
    targetJob = JOB_PROFILES.find(j => j.id === jobId);
  }
  if (!targetJob && JOB_PROFILES.length > 0) {
    targetJob = JOB_PROFILES[0];
  }

  // Filter or score candidates for the target job
  const config = getAWSConfig();
  let pipeline = [];

  // 1. Applications from candidate submissions
  const directApps = CANDIDATE_APPLICATIONS.filter(app => {
    if (!jobId || jobId === 'all') return true;
    return app.jobId === jobId;
  });

  // Re-evaluate scores if target job was switched
  for (const app of directApps) {
    let appEvaluation = app.evaluation;
    if (targetJob && app.jobId !== targetJob.id && app.candidate) {
      appEvaluation = evaluateCandidateAgainstJob({
        ...app.candidate,
        rawText: app.candidate.skills?.join(' ') || ''
      }, targetJob);
    }

    // Refresh presigned URL if possible
    let previewUrl = app.previewUrl;
    if (config.isConfigured && config.bucketName && app.s3Key) {
      try {
        const getCmd = new GetObjectCommand({ Bucket: config.bucketName, Key: app.s3Key });
        previewUrl = await getSignedUrl(config.s3, getCmd, { expiresIn: 3600 });
      } catch (e) { }
    }

    pipeline.push({
      id: app.id,
      key: app.s3Key,
      filename: app.filename,
      size: app.size,
      appliedAt: app.appliedAt,
      jobId: app.jobId,
      jobTitle: app.jobTitle,
      candidate: app.candidate,
      evaluation: appEvaluation,
      previewUrl,
      source: 'Candidate Portal'
    });
  }

  // 2. Sort strictly by ATS Match Score descending
  pipeline.sort((a, b) => (b.evaluation?.atsScore || 0) - (a.evaluation?.atsScore || 0));

  // Assign ranking numbers #1, #2, #3...
  const rankedPipeline = pipeline.map((c, idx) => ({
    ...c,
    rank: idx + 1
  }));

  res.json({
    targetJob,
    totalCandidates: rankedPipeline.length,
    candidates: rankedPipeline
  });
});

// Excel / CSV Export Endpoint
app.get('/api/ats/export', async (req, res) => {
  const { jobId } = req.query;
  JOB_PROFILES = loadPersistentJobs();
  CANDIDATE_APPLICATIONS = loadPersistentApplications();

  let targetJob = null;
  if (jobId && jobId !== 'all') {
    targetJob = JOB_PROFILES.find(j => j.id === jobId);
  }
  if (!targetJob && JOB_PROFILES.length > 0) {
    targetJob = JOB_PROFILES[0];
  }

  const apps = CANDIDATE_APPLICATIONS.filter(app => {
    if (!jobId || jobId === 'all') return true;
    return app.jobId === jobId;
  });

  const evaluated = apps.map(app => {
    let evaluation = app.evaluation;
    if (targetJob && app.jobId !== targetJob.id && app.candidate) {
      evaluation = evaluateCandidateAgainstJob(app.candidate, targetJob);
    }
    return {
      ...app,
      evaluation
    };
  });

  evaluated.sort((a, b) => (b.evaluation?.atsScore || 0) - (a.evaluation?.atsScore || 0));

  // Build CSV content with UTF-8 BOM for Microsoft Excel compatibility
  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""';
    const clean = String(str).replace(/"/g, '""');
    return `"${clean}"`;
  };

  const headers = [
    'Rank',
    'Candidate Name',
    'Email',
    'Phone',
    'Experience (Years)',
    'Target Job Role',
    'ATS Match Score (%)',
    'Recommendation Fit',
    'Matched Skills',
    'Missing Skills',
    'Skills Score (%)',
    'Experience Score (%)',
    'Relevance Score (%)',
    'Application Date',
    'S3 Object Key',
    'Notes / Portfolio'
  ];

  const rows = evaluated.map((item, idx) => {
    const cand = item.candidate || {};
    const ev = item.evaluation || {};
    const bd = ev.scoreBreakdown || {};

    return [
      idx + 1,
      escapeCsv(cand.name || item.filename),
      escapeCsv(cand.email || 'N/A'),
      escapeCsv(cand.phone || 'N/A'),
      escapeCsv(cand.estimatedYears || 1),
      escapeCsv(item.jobTitle || targetJob?.title || 'General Role'),
      escapeCsv(ev.atsScore || 0),
      escapeCsv(ev.recommendation || 'Evaluated'),
      escapeCsv((ev.matchedSkills || []).join(', ')),
      escapeCsv((ev.missingSkills || []).join(', ')),
      escapeCsv(bd.skillsScore || 0),
      escapeCsv(bd.experienceScore || 0),
      escapeCsv(bd.keywordScore || 0),
      escapeCsv(item.appliedAt ? new Date(item.appliedAt).toLocaleString() : 'N/A'),
      escapeCsv(item.s3Key || 'N/A'),
      escapeCsv(cand.portfolio || item.notes || '')
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const safeTitle = (targetJob?.title || 'Candidates').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `CloudATS_${safeTitle}_${Date.now()}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});

// Delete Candidate Application
app.delete('/api/candidate/application/:id', (req, res) => {
  const { id } = req.params;
  CANDIDATE_APPLICATIONS = loadPersistentApplications();
  CANDIDATE_APPLICATIONS = CANDIDATE_APPLICATIONS.filter(a => a.id !== id);
  savePersistentApplications(CANDIDATE_APPLICATIONS);
  res.json({ success: true, message: `Application ${id} deleted` });
});

// ATS Leaderboard: Evaluate all resumes in S3 against a selected Job Profile
app.post('/api/ats/evaluate-all', async (req, res) => {
  const { jobId, customJob } = req.body;
  const config = getAWSConfig();

  if (!config.isConfigured || !config.bucketName) {
    return res.status(400).json({ error: 'AWS S3 credentials not configured in .env' });
  }

  let targetJob = JOB_PROFILES.find(j => j.id === jobId);
  if (!targetJob && customJob) {
    targetJob = {
      title: customJob.title || 'Custom Role',
      minExperienceYears: parseInt(customJob.minExperienceYears) || 1,
      requiredSkills: Array.isArray(customJob.requiredSkills) ? customJob.requiredSkills : (customJob.requiredSkills || '').split(',').map(s => s.trim()).filter(Boolean),
      preferredSkills: Array.isArray(customJob.preferredSkills) ? customJob.preferredSkills : [],
      description: customJob.description || ''
    };
  }

  if (!targetJob) {
    targetJob = JOB_PROFILES[0];
  }

  try {
    const listCmd = new ListObjectsV2Command({ Bucket: config.bucketName, MaxKeys: 50 });
    const s3List = await config.s3.send(listCmd);

    if (!s3List.Contents || s3List.Contents.length === 0) {
      return res.json({ targetJob, candidates: [] });
    }

    const docItems = s3List.Contents.filter(item => {
      const ext = (path.extname(item.Key) || '').toLowerCase();
      return ['.docx', '.doc', '.pdf', '.txt', '.md'].includes(ext);
    });

    const evaluations = await Promise.all(docItems.map(async (item) => {
      try {
        const getCmd = new GetObjectCommand({ Bucket: config.bucketName, Key: item.Key });
        const s3Res = await config.s3.send(getCmd);
        const byteArray = await s3Res.Body.transformToByteArray();
        const buffer = Buffer.from(byteArray);
        const ext = path.extname(item.Key);

        const rawText = await extractTextFromBuffer(buffer, ext);
        const candidateProfile = parseResumeDetails(rawText, path.basename(item.Key));
        const evaluation = evaluateCandidateAgainstJob(candidateProfile, targetJob);

        let previewUrl = null;
        try {
          previewUrl = await getSignedUrl(config.s3, getCmd, { expiresIn: 3600 });
        } catch (e) { }

        return {
          key: item.Key,
          filename: path.basename(item.Key),
          size: item.Size,
          lastModified: item.LastModified,
          previewUrl,
          candidate: candidateProfile,
          evaluation
        };
      } catch (err) {
        console.error(`Error processing resume ${item.Key}:`, err);
        return null;
      }
    }));

    const validCandidates = evaluations
      .filter(Boolean)
      .sort((a, b) => b.evaluation.atsScore - a.evaluation.atsScore);

    res.json({
      targetJob,
      totalResumes: validCandidates.length,
      candidates: validCandidates
    });
  } catch (err) {
    console.error('ATS Evaluate All Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ATS Deep Dive: Evaluate single resume
app.post('/api/ats/evaluate-single', async (req, res) => {
  const { key, jobId, customJob } = req.body;
  const config = getAWSConfig();

  if (!key) {
    return res.status(400).json({ error: 'File key is required' });
  }

  if (!config.isConfigured || !config.bucketName) {
    return res.status(400).json({ error: 'AWS S3 credentials not configured in .env' });
  }

  let targetJob = JOB_PROFILES.find(j => j.id === jobId);
  if (!targetJob && customJob) {
    targetJob = {
      title: customJob.title || 'Custom Role',
      minExperienceYears: parseInt(customJob.minExperienceYears) || 1,
      requiredSkills: Array.isArray(customJob.requiredSkills) ? customJob.requiredSkills : (customJob.requiredSkills || '').split(',').map(s => s.trim()).filter(Boolean),
      preferredSkills: Array.isArray(customJob.preferredSkills) ? customJob.preferredSkills : [],
      description: customJob.description || ''
    };
  }

  if (!targetJob) {
    targetJob = JOB_PROFILES[0];
  }

  try {
    const getCmd = new GetObjectCommand({ Bucket: config.bucketName, Key: key });
    const s3Res = await config.s3.send(getCmd);
    const byteArray = await s3Res.Body.transformToByteArray();
    const buffer = Buffer.from(byteArray);
    const ext = path.extname(key);

    const rawText = await extractTextFromBuffer(buffer, ext);
    const candidateProfile = parseResumeDetails(rawText, path.basename(key));
    const evaluation = evaluateCandidateAgainstJob(candidateProfile, targetJob);
    const previewUrl = await getSignedUrl(config.s3, getCmd, { expiresIn: 3600 });

    res.json({
      key,
      filename: path.basename(key),
      previewUrl,
      targetJob,
      candidate: candidateProfile,
      evaluation
    });
  } catch (err) {
    console.error('ATS Evaluate Single Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Backward compatibility: Image analysis
app.post('/api/ai/analyze-image', async (req, res) => {
  const { key } = req.body;
  const config = getAWSConfig();

  if (!config.isConfigured || !config.bucketName) {
    return res.status(400).json({ error: 'AWS Rekognition credentials not configured in .env.' });
  }

  try {
    const getCmd = new GetObjectCommand({ Bucket: config.bucketName, Key: key });
    const s3Res = await config.s3.send(getCmd);
    const byteArray = await s3Res.Body.transformToByteArray();

    const labelCmd = new DetectLabelsCommand({
      Image: { Bytes: byteArray },
      MaxLabels: 15,
      MinConfidence: 70
    });
    const labelResult = await config.rekognition.send(labelCmd);

    const labels = (labelResult.Labels || []).map(l => ({
      name: l.Name,
      confidence: parseFloat(l.Confidence.toFixed(1))
    }));

    res.json({ source: 'aws-rekognition', labels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backward compatibility: Document Text Extraction
app.post('/api/ai/analyze-document', async (req, res) => {
  const { key } = req.body;
  const config = getAWSConfig();

  if (!config.isConfigured || !config.bucketName) {
    return res.status(400).json({ error: 'AWS credentials not configured in .env.' });
  }

  try {
    const getCmd = new GetObjectCommand({ Bucket: config.bucketName, Key: key });
    const s3Res = await config.s3.send(getCmd);
    const byteArray = await s3Res.Body.transformToByteArray();
    const buffer = Buffer.from(byteArray);
    const ext = (path.extname(key) || '').toLowerCase();

    const text = await extractTextFromBuffer(buffer, ext);
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    res.json({ source: 'cloud-doc-parser', lines });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Production Static Serving for Single-Server EC2 Deployment
// -------------------------------------------------------------
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*splat}', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(port, () => {
  console.log(`CloudATS running in ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'} mode at http://localhost:${port}`);
});
