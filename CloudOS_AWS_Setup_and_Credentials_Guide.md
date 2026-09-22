# CloudOS — AWS Setup, Credentials & Zero-Budget Safety Guide

## Purpose

Set up the AWS resources required by CloudOS.

Target architecture:

```text
React
  ↓
Amazon Cognito
  ↓
API Gateway
  ↓
AWS Lambda
  ├── EC2
  ├── DynamoDB
  └── CloudWatch (optional)
```

The project is designed for the AWS Free plan/credits. AWS currently describes the Free plan as providing up to USD $200 in credits for new customers, with $100 initially and up to another $100 through qualifying activities. The Free plan ends after six months or when credits are exhausted, whichever comes first; AWS states Free-plan customers are not charged unless they convert to a Paid plan. Exact eligibility and service availability must be checked in the account's current Billing/Free Tier page. 

**Do not treat “Free” as unlimited usage.** EC2 and other usage can consume credits. Keep the project deliberately small and monitor the account.

---

# 1. AWS Services

Required:

```text
Amazon Cognito
Amazon API Gateway
AWS Lambda
Amazon DynamoDB
Amazon EC2
AWS IAM
```

Optional later:

```text
Amazon CloudWatch
AWS Systems Manager
Amazon S3
Amazon CloudFront
```

AWS documents API Gateway + Lambda integrations and serverless Lambda/DynamoDB APIs as supported architectures.

---

# 2. Billing Safety — Do This First

Before creating EC2:

```text
AWS Console
→ Billing and Cost Management
→ Free Tier / Free plan usage
```

Check:

```text
Plan type
Credit balance
Plan expiration
Current usage
Free usage/limits
```

AWS provides Free Tier usage/credit tracking in the Billing/Account experience.

---

# 3. Enable Free Tier Alerts

Open:

```text
Billing and Cost Management
→ Billing preferences
```

Enable:

```text
Receive AWS Free Tier usage alerts
```

AWS documents that Free Tier alerts notify the account when usage exceeds 85% of a Free Tier limit.

---

# 4. Create a Zero-Spend Budget

Go to:

```text
Billing and Cost Management
→ Budgets
→ Create budget
→ Use a template
→ Zero spend budget
```

Add your email for notifications.

AWS provides a Zero spend budget template specifically for monitoring spending against Free Tier boundaries.

**Important:** a budget/alert is a warning mechanism, not a technical firewall that prevents every possible charge. Keep the architecture within the Free plan/credit limits and clean up resources.

---

# 5. Do Not Upgrade to Paid Plan Automatically

Do not choose:

```text
Upgrade to Paid plan
```

just because a tutorial tells you to.

If a service is unavailable under the current plan, stop and reassess rather than upgrading automatically.

---

# 6. Select One Region

Suggested:

```text
ap-south-1
```

Mumbai.

Use the same region for the main resources where possible.

Set:

```env
AWS_REGION=ap-south-1
```

AMI IDs are region-specific.

---

# 7. AWS CLI

Install AWS CLI and verify:

```bash
aws --version
```

For local development, configure the AWS CLI credential store:

```bash
aws configure
```

Provide:

```text
AWS Access Key ID
AWS Secret Access Key
Default region: ap-south-1
Output: json
```

Do not commit `~/.aws/credentials`.

For Lambda, prefer an IAM execution role instead of putting access keys in Lambda environment variables.

---

# 8. IAM

Do not use the AWS root account for application operations.

Create an appropriate IAM identity/role for development and a Lambda execution role for the application.

The application runtime will eventually need permissions around:

```text
EC2
DynamoDB
CloudWatch (optional)
SSM (optional)
```

Avoid giving the runtime:

```text
AdministratorAccess
```

Use only the permissions required by CloudOS.

---

# 9. Amazon Cognito User Pool

Open:

```text
Amazon Cognito
→ User Pools
→ Create user pool
```

Suggested name:

```text
CloudOS-Users
```

Use email as the sign-in identifier.

You need:

```text
User Pool ID
App Client ID
Region
```

Example format:

```text
User Pool ID:
ap-south-1_xxxxxxxxx

App Client ID:
xxxxxxxxxxxxxxxxxxxxxxxx
```

---

# 10. Cognito App Client

Create an app client for the browser application.

Configure the authentication flow according to the Cognito SDK/Managed Login approach chosen for CloudOS.

Frontend values:

```env
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=
VITE_COGNITO_REGION=ap-south-1
```

Backend/API configuration:

```env
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
COGNITO_REGION=ap-south-1
```

Do not put a Cognito client secret into React.

---

# 11. Cognito Hosted UI / Managed Login (Optional)

If using Cognito Managed Login/Hosted UI:

```text
Cognito
→ User Pool
→ App integration
→ Domain
```

Create/configure a domain.

Then:

```env
VITE_COGNITO_DOMAIN=
```

Configure exact callback/logout URLs. For local development the application may use a URL such as:

```text
http://localhost:5173
```

Use the exact route required by the selected authentication library.

---

# 12. DynamoDB

Open:

```text
DynamoDB
→ Tables
→ Create table
```

Table name:

```text
CloudOS_VMs
```

Primary key:

```text
vmId
```

Recommended GSI:

```text
ownerId-index
```

Partition key:

```text
ownerId
```

Sort key:

```text
createdAt
```

Suggested item:

```json
{
  "vmId": "cloudos-123",
  "ownerId": "cognito-user-sub",
  "awsInstanceId": "i-0123456789",
  "name": "ubuntu-dev",
  "os": "Ubuntu 24.04",
  "amiId": "ami-xxxxxxxx",
  "instanceType": "t3.micro",
  "region": "ap-south-1",
  "status": "running",
  "createdAt": "2026-09-22T10:00:00Z",
  "updatedAt": "2026-09-22T10:00:00Z"
}
```

Set:

```env
DYNAMODB_TABLE_NAME=CloudOS_VMs
```

---

# 13. EC2 — Initial VM

Only create EC2 after billing protection is configured.

Open:

```text
EC2
→ Instances
→ Launch instance
```

For MVP:

```text
OS: Ubuntu Server 24.04 LTS
```

Find the official Ubuntu image in the EC2 console and copy its AMI ID.

Do not copy an AMI ID from an old tutorial without checking the selected region.

Set:

```env
EC2_AMI_ID=
```

---

# 14. EC2 Instance Type

Use only a small instance type that is currently eligible under the account's Free plan/credits.

Example:

```text
t3.micro
```

Verify the current eligibility and pricing in the AWS console before launching.

Set:

```env
EC2_INSTANCE_TYPE=t3.micro
```

Do not assume an instance is free merely because it appears in an old tutorial.

---

# 15. EC2 Key Pair

If the first terminal implementation uses SSH:

```text
EC2
→ Network & Security
→ Key Pairs
→ Create key pair
```

Example:

```text
CloudOS-Key
```

Download the private key once and store it outside Git.

Example:

```text
C:\CloudOS\secrets\CloudOS-Key.pem
```

Backend/Lambda configuration, if applicable:

```env
EC2_KEY_PAIR_NAME=CloudOS-Key
SSH_PRIVATE_KEY_PATH=
```

Never expose this key to React.

---

# 16. EC2 Security Group

Create:

```text
CloudOS-VM-SG
```

For an initial SSH-based Linux terminal test, you may need:

```text
SSH
TCP
22
```

Restrict the source IP as much as practical.

Do not blindly open SSH to:

```text
0.0.0.0/0
```

Copy the Security Group ID:

```text
sg-xxxxxxxx
```

Set:

```env
EC2_SECURITY_GROUP_ID=
```

A later terminal implementation should investigate AWS Systems Manager Session Manager to reduce the need for public SSH access.

---

# 17. VPC / Subnet

For MVP, use a suitable existing/default VPC and subnet if they meet the requirements.

Copy the subnet ID:

```text
subnet-xxxxxxxx
```

Set:

```env
EC2_SUBNET_ID=
```

The subnet must be in the selected region/VPC and compatible with the EC2 configuration.

---

# 18. Ubuntu SSH Username

For the official Ubuntu EC2 image, the default user is commonly:

```text
ubuntu
```

Set:

```env
SSH_USERNAME=ubuntu
```

Verify it for the exact AMI you select.

---

# 19. Lambda Functions

Create serverless backend functions such as:

```text
cloudos-list-vms
cloudos-create-vm
cloudos-get-vm
cloudos-start-vm
cloudos-stop-vm
cloudos-restart-vm
cloudos-delete-vm
```

For a small MVP, some operations can share a function, but keep the code modular.

Runtime:

```text
Node.js
```

Select a currently supported Node.js Lambda runtime shown by AWS.

---

# 20. Lambda Environment Variables

Use:

```env
AWS_REGION=ap-south-1

DYNAMODB_TABLE_NAME=CloudOS_VMs

EC2_AMI_ID=
EC2_INSTANCE_TYPE=t3.micro
EC2_KEY_PAIR_NAME=
EC2_SECURITY_GROUP_ID=
EC2_SUBNET_ID=

COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
COGNITO_REGION=ap-south-1

SSH_USERNAME=ubuntu
SSH_PRIVATE_KEY_PATH=
```

Do not put long-lived AWS secret keys here when an IAM execution role can be used.

---

# 21. Lambda IAM Execution Role

Create an execution role with the minimum required permissions.

Conceptual permissions:

```text
EC2:
  DescribeInstances
  RunInstances
  StartInstances
  StopInstances
  RebootInstances
  TerminateInstances

DynamoDB:
  PutItem
  GetItem
  Query
  UpdateItem
  DeleteItem
```

Optional later:

```text
CloudWatch
SSM
```

Avoid AdministratorAccess.

---

# 22. API Gateway

Create an **HTTP API** and connect routes to Lambda.

Routes:

```text
GET    /vms
POST   /vms
GET    /vms/{vmId}
POST   /vms/{vmId}/start
POST   /vms/{vmId}/stop
POST   /vms/{vmId}/restart
DELETE /vms/{vmId}
GET    /vms/{vmId}/terminal
```

API Gateway provides HTTP endpoints for Lambda and supports authorization controls including Cognito integration.

---

# 23. API Gateway Cognito Authorization

Conceptually:

```text
React
  ↓
Cognito JWT
  ↓
API Gateway Authorizer
  ↓
Lambda
```

The Lambda must derive the authenticated user's identity from the verified request context/token.

Never trust a browser-supplied `ownerId` for authorization.

---

# 24. API URL

After API deployment, copy the real invoke URL from API Gateway.

Example format:

```text
https://xxxxxxxx.execute-api.ap-south-1.amazonaws.com
```

Set:

```env
VITE_API_BASE_URL=
```

Do not invent this value.

---

# 25. CORS

Configure API Gateway CORS for the frontend origin.

Local development may use:

```text
http://localhost:5173
```

The final deployed frontend origin must be configured explicitly.

Avoid unrestricted CORS in the final application unless deliberately required.

---

# 26. VM Ownership / Multi-Tenancy

Every VM record must contain:

```text
ownerId
```

The request flow is:

```text
Cognito JWT
   ↓
Authenticated user
   ↓
VM lookup
   ↓
Compare ownerId
   ↓
Allow / Deny
```

Example:

```text
User A requests VM-B

VM-B.ownerId = User B
Current user = User A

→ 403 Forbidden
```

This check belongs on the backend, not only in React.

---

# 27. EC2 Lifecycle Mapping

```text
Create VM
  → EC2 RunInstances

Start
  → EC2 StartInstances

Stop
  → EC2 StopInstances

Restart
  → EC2 RebootInstances

Delete
  → EC2 TerminateInstances

Status
  → EC2 DescribeInstances
```

The database links:

```text
CloudOS VM ID
    ↓
EC2 Instance ID
    ↓
Cognito Owner ID
```

---

# 28. Application Safety Limits

Start with:

```text
MAX_VMS_PER_USER=1
MAX_TOTAL_ACTIVE_VMS=1 or 2
ALLOWED_REGION=ap-south-1
ALLOWED_INSTANCE_TYPE=t3.micro
ALLOWED_OS=Ubuntu 24.04
```

These limits prevent accidental resource growth during the college demo.

---

# 29. VM Shutdown Policy

At minimum, provide a highly visible:

```text
STOP VM
```

button.

Later implement automatic shutdown after a configurable idle period.

Example:

```text
VM running
   ↓
Idle timeout
   ↓
Warning
   ↓
Stop VM
```

Always stop/terminate resources when the demo is finished.

---

# 30. CloudWatch

Optional for MVP.

Later use it for:

```text
EC2 CPU utilization
Lambda logs
API errors
```

Do not create unnecessary custom metrics.

---

# 31. S3 / CloudFront

Optional.

The React frontend can initially run locally while the backend is developed.

Later, if desired:

```text
React build
   ↓
S3
   ↓
CloudFront
```

Check current Free plan/credit availability before adding any additional resources.

---

# 32. No Render Backend

Do not create a traditional Render backend for CloudOS.

The intended backend is:

```text
API Gateway
    ↓
Lambda
```

This avoids maintaining a continuously running Express server and keeps the project focused on AWS cloud services.

---

# 33. Browser Terminal

Target architecture:

```text
Browser
  ↓
Terminal UI
  ↓
AWS terminal/session layer
  ↓
EC2 Ubuntu
```

The frontend must never receive:

```text
AWS secret key
SSH private key
EC2 credentials
```

For the final implementation, investigate AWS Systems Manager Session Manager as a secure alternative to exposing SSH publicly.

---

# 34. Frontend `.env.example`

```env
VITE_API_BASE_URL=

VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=
VITE_COGNITO_REGION=
VITE_COGNITO_DOMAIN=
```

Only public browser configuration belongs here.

---

# 35. Backend/Lambda Configuration

```env
AWS_REGION=ap-south-1

DYNAMODB_TABLE_NAME=CloudOS_VMs

EC2_AMI_ID=
EC2_INSTANCE_TYPE=t3.micro
EC2_KEY_PAIR_NAME=
EC2_SECURITY_GROUP_ID=
EC2_SUBNET_ID=

COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
COGNITO_REGION=ap-south-1

SSH_USERNAME=ubuntu
SSH_PRIVATE_KEY_PATH=
```

Do not put long-lived AWS secret keys in source code.

---

# 36. Credential Checklist

Before backend implementation:

```text
AWS
[ ] Free plan confirmed
[ ] Credit balance checked
[ ] Plan expiration checked
[ ] Free Tier alerts enabled
[ ] Zero-spend budget configured
[ ] Region selected

Cognito
[ ] User Pool ID
[ ] App Client ID
[ ] Region
[ ] Hosted UI domain (only if used)

DynamoDB
[ ] CloudOS_VMs table
[ ] ownerId-index GSI

EC2
[ ] Ubuntu 24.04 AMI ID
[ ] Eligible small instance type
[ ] Key pair name
[ ] Security Group ID
[ ] Subnet ID
[ ] SSH username

Lambda
[ ] Functions created
[ ] Execution role created
[ ] EC2 permissions
[ ] DynamoDB permissions

API Gateway
[ ] HTTP API created
[ ] Routes created
[ ] Lambda integrations
[ ] Cognito authorization
[ ] CORS
[ ] Invoke URL
```

---

# 37. Recommended Setup Order

Follow this order exactly:

```text
1. Verify AWS Free plan
        ↓
2. Check credit balance and expiration
        ↓
3. Enable Free Tier alerts
        ↓
4. Create Zero Spend Budget
        ↓
5. Select region
        ↓
6. Create Cognito User Pool
        ↓
7. Create DynamoDB table + GSI
        ↓
8. Create IAM roles
        ↓
9. Create/test a simple Lambda
        ↓
10. Test Lambda → DynamoDB
        ↓
11. Create EC2 security group
        ↓
12. Select Ubuntu AMI
        ↓
13. Create EC2 key pair if SSH is used
        ↓
14. Manually launch ONE small EC2 test VM
        ↓
15. Test it
        ↓
16. Stop/terminate test VM
        ↓
17. Implement Lambda → EC2 provisioning
        ↓
18. Create API Gateway routes
        ↓
19. Add Cognito authorization
        ↓
20. Connect React
        ↓
21. Implement ownership checks
        ↓
22. Implement terminal
```

---

# 38. Zero-Budget Safety Rules

```text
1. Do not upgrade to Paid plan automatically.
2. Do not use large EC2 instances.
3. Do not create NAT Gateway.
4. Do not create RDS.
5. Do not create a Load Balancer.
6. Do not create unnecessary Elastic IPs.
7. Keep MAX_TOTAL_ACTIVE_VMS very low.
8. Stop the VM after testing.
9. Terminate resources that are no longer needed.
10. Check Free Tier/credit usage after every significant test.
11. Keep the Zero Spend Budget enabled.
12. Never commit secrets or .pem files.
```

---

# 39. Final `.gitignore` Requirements

At minimum:

```text
.env
.env.*
!.env.example
*.pem
*.key
node_modules/
dist/
```

Never commit:

```text
AWS secret keys
AWS access keys
SSH private keys
Cognito passwords
JWTs/tokens
production secrets
```

---

# 40. Final Target Architecture

```text
                         CLOUDOS
                            |
              +-------------+-------------+
              |                           |
          Cognito                       React
              |                           |
              |                     Dashboard/UI
              |                           |
              +-------------+-------------+
                            |
                       API Gateway
                            |
                     Cognito Authorizer
                            |
                          Lambda
                            |
             +--------------+--------------+
             |              |              |
          DynamoDB         EC2         CloudWatch
             |              |
       VM ownership     Real Linux VM
       + metadata            |
                             |
                        Browser Terminal
```

The goal is that the final demonstration uses **real AWS resources** rather than simulated VM states:

```text
Register
   ↓
Login
   ↓
Create Ubuntu VM
   ↓
AWS EC2 launches real VM
   ↓
VM becomes RUNNING
   ↓
Open terminal
   ↓
Run Linux commands
   ↓
Stop VM
   ↓
Login as another user
   ↓
Second user cannot see/access first user's VM
```
