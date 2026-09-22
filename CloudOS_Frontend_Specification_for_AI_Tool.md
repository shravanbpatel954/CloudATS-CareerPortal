# CloudOS — Frontend Specification for Cursor / Antigravity

## Purpose

Build the **frontend only** for **CloudOS**, a multi-user cloud VM management platform.

The user flow is:

```text
Register/Login
      ↓
CloudOS Dashboard
      ↓
Create Virtual Machine
      ↓
AWS creates a real EC2 VM
      ↓
VM appears in the user's private dashboard
      ↓
Start / Stop / Restart / Terminate
      ↓
Open browser terminal connected to the real Linux VM
```

The frontend is only the control interface. The final backend architecture is:

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

**Do not build a Node.js/Express server. Do not call EC2 directly from React.**

---

## 1. Technology

Use:

- React + Vite
- JavaScript or TypeScript
- React Router
- Tailwind CSS
- Axios or fetch
- xterm.js for the terminal UI

Do not add unnecessary libraries.

---

## 2. Environment Variables

Create `.env.example`:

```env
VITE_API_BASE_URL=

VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=
VITE_COGNITO_REGION=

# Only if Cognito Managed Login / Hosted UI is used
VITE_COGNITO_DOMAIN=
```

Leave all values blank. Never invent credentials.

**Never put these in React:**

```env
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=
EC2_PRIVATE_KEY=
SSH_PRIVATE_KEY=
```

Anything exposed through `VITE_*` can be visible in the browser.

---

## 3. Product/Visual Direction

The UI should feel like a **mini AWS/Cloud provider console**, not a generic CRUD SaaS app.

Use:

- clean technical dashboard
- sidebar navigation
- compact infrastructure cards
- clear RUNNING/STOPPED/CREATING status badges
- VM details
- terminal view
- confirmation dialogs for destructive actions
- responsive desktop-first design

Avoid:

- marketing-heavy landing pages
- fake statistics
- excessive gradients/animations
- fake cloud resources in the final UI

Suggested brand:

```text
☁ CloudOS
```

---

## 4. Routes

Public:

```text
/
/login
/register
```

Authenticated:

```text
/dashboard
/create-vm
/vms/:vmId
/vms/:vmId/terminal
/profile
```

Optional future admin routes:

```text
/admin
/admin/users
/admin/vms
```

Implement protected routing.

---

## 5. Main Layout

Sidebar:

```text
☁ CloudOS

Dashboard
Virtual Machines
Create VM
Terminal
Profile

----------------
Help
Logout
```

Header:

```text
CloudOS                         User
Region: ap-south-1
```

Do not hard-code a fake region in real API mode. Use configuration/state.

---

## 6. Login

Create a clean login screen:

```text
CloudOS

Email
[________________]

Password
[________________]

[ Sign In ]

Forgot password?
Create account
```

Use Amazon Cognito for the actual authentication flow.

Create an authentication abstraction such as:

```js
signIn(email, password)
signUp(email, password)
confirmSignUp(...)
signOut()
getCurrentUser()
getAccessToken()
```

Do not implement password storage or authentication cryptography manually.

---

## 7. Registration

Fields:

```text
Email
Password
Confirm Password
```

Support Cognito verification states if enabled:

```text
Creating account...
Verification required
Account created
Registration failed
```

---

## 8. Dashboard

The main dashboard should look approximately like:

```text
┌─────────────────────────────────────────────────────────┐
│ CloudOS                                  Shravan        │
├─────────────────────────────────────────────────────────┤
│ Dashboard                                               │
│ Manage your cloud virtual machines                     │
│                                                         │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│ │ Total VMs  │ │ Running    │ │ Stopped    │           │
│ │     2      │ │     1      │ │     1      │           │
│ └────────────┘ └────────────┘ └────────────┘           │
│                                                         │
│ My Virtual Machines                   [+ Create VM]    │
│                                                         │
│ ┌───────────────────────────────────────────────────┐  │
│ │ Ubuntu-Dev                    ● RUNNING           │  │
│ │ Ubuntu 24.04 • t3.micro • ap-south-1              │  │
│ │ [ Open ] [ Stop ] [ Restart ]                    │  │
│ └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

Do not ship fake statistics as real data. Mock data may be isolated under `src/mock/` for UI development only.

---

## 9. VM Card

Display:

```text
VM Name
Operating System
Status
Instance Type
Region
Created Date
```

Actions depend on state:

```text
RUNNING → Open / Stop / Restart
STOPPED → Start / Delete
CREATING → View details
```

Disable duplicate clicks while an operation is in progress.

---

## 10. Create VM

Create a simple form:

```text
Create Virtual Machine

VM Name
[ ubuntu-dev ]

Operating System
[ Ubuntu 24.04 ▼ ]

Instance Type
[ t3.micro ▼ ]

Region
[ ap-south-1 ▼ ]

[ Launch VM ]
```

For MVP, show only Ubuntu 24.04, one small eligible instance type, and the selected region.

The backend is authoritative and must validate all values.

---

## 11. Creation State

After launch:

```text
Creating your virtual machine...

✓ Request submitted
✓ AWS instance creation started
● Waiting for instance
○ Ready
```

Do not use a fake fixed-duration animation. Poll/use real API state when connected.

---

## 12. VM Details

Example:

```text
Ubuntu-Dev                         ● RUNNING

Operating System     Ubuntu 24.04
Instance Type        t3.micro
Region               ap-south-1
Instance ID          i-xxxxxxxx
Public IP            xxx.xxx.xxx.xxx
Created              date/time

[ Open Terminal ]
[ Stop VM ] [ Restart VM ] [ Delete VM ]
```

Only display fields actually returned by the backend.

---

## 13. Delete Confirmation

Use a modal:

```text
Delete Virtual Machine?

This will permanently terminate:
Ubuntu-Dev

[ Cancel ]    [ Terminate VM ]
```

Use “Terminate” for the EC2 action.

---

## 14. Ownership UX

The frontend should call only:

```text
GET /vms
```

and display the resources returned for the authenticated user.

Do not send a browser-supplied `userId` as the source of authorization.

The backend will derive identity from the Cognito token and enforce:

```text
User A → VM A ✓
User A → VM B ✗
```

---

## 15. API Layer

Create:

```text
src/api/client.js
src/api/authApi.js
src/api/vmApi.js
```

Functions:

```js
getMyVMs()
getVM(vmId)
createVM(payload)
startVM(vmId)
stopVM(vmId)
restartVM(vmId)
deleteVM(vmId)
getTerminalInfo(vmId)
```

Use `VITE_API_BASE_URL`.

Protected requests should eventually send:

```text
Authorization: Bearer <JWT>
```

The frontend must not decide authorization by itself.

---

## 16. API Contract

Conceptual routes:

```text
GET    /vms
POST   /vms
GET    /vms/:vmId
POST   /vms/:vmId/start
POST   /vms/:vmId/stop
POST   /vms/:vmId/restart
DELETE /vms/:vmId
GET    /vms/:vmId/terminal
```

Example response:

```json
{
  "vmId": "cloudos-abc123",
  "awsInstanceId": "i-0123456789",
  "name": "ubuntu-dev",
  "os": "Ubuntu 24.04",
  "status": "running",
  "instanceType": "t3.micro",
  "region": "ap-south-1",
  "createdAt": "2026-09-22T10:00:00Z"
}
```

---

## 17. Error States

Handle:

```text
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
429 Too Many Requests
500 Server Error
```

Human-readable messages:

```text
Session expired. Please sign in again.
You are not authorized to access this VM.
This VM no longer exists.
The VM is already stopped.
AWS could not create the virtual machine.
Something went wrong. Please try again.
```

---

## 18. Empty/Loading States

No VMs:

```text
No virtual machines yet.
Create your first cloud VM and access it from your browser.

[ + Create Virtual Machine ]
```

Operations:

```text
Creating...
Starting...
Stopping...
Restarting...
Terminating...
```

---

## 19. Browser Terminal UI

Prepare a terminal page using xterm.js:

```text
┌────────────────────────────────────────────────────┐
│ Ubuntu-Dev                     ● RUNNING           │
├────────────────────────────────────────────────────┤
│ cloudos@ubuntu:~$ ls                               │
│ Desktop Documents Downloads                        │
│                                                    │
│ cloudos@ubuntu:~$                                  │
└────────────────────────────────────────────────────┘
```

For this frontend phase:

- build the terminal UI
- create a terminal service abstraction
- do not fake command execution
- do not expose SSH keys

Suggested files:

```text
src/terminal/Terminal.jsx
src/terminal/terminalService.js
```

The actual terminal transport will be implemented later.

---

## 20. Profile

Show basic account information:

```text
Profile

Email
<authenticated email>

Account
Active
```

Do not expose sensitive authentication internals.

---

## 21. Project Structure

Use approximately:

```text
src/
├── api/
│   ├── client.js
│   ├── authApi.js
│   └── vmApi.js
├── auth/
│   ├── AuthProvider.jsx
│   ├── ProtectedRoute.jsx
│   └── authService.js
├── components/
│   ├── Sidebar.jsx
│   ├── Header.jsx
│   ├── VMCard.jsx
│   ├── VMStatusBadge.jsx
│   ├── ConfirmDialog.jsx
│   ├── LoadingState.jsx
│   └── EmptyState.jsx
├── pages/
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── Dashboard.jsx
│   ├── CreateVM.jsx
│   ├── VMDetails.jsx
│   ├── Terminal.jsx
│   └── Profile.jsx
├── terminal/
│   ├── Terminal.jsx
│   └── terminalService.js
├── mock/
│   └── vmMockData.js
├── App.jsx
└── main.jsx
```

---

## 22. Mock Data Rule

Mock data is allowed only during frontend development.

Keep it isolated under:

```text
src/mock/
```

Make mock mode easy to disable.

Do not make fake VMs look like real cloud resources in the final application.

---

## 23. Do Not Implement Yet

Do not implement these in the frontend:

```text
AWS EC2 SDK
AWS access/secret keys
Lambda deployment
API Gateway creation
DynamoDB access
SSH private keys
EC2 provisioning
Admin backend
Billing logic
Auto-scaling
Windows VM
Graphical desktop
```

Those belong to the AWS backend/infrastructure phase.

---

## 24. Frontend Definition of Done

The generated frontend should contain:

- working React/Vite application
- login
- registration
- protected routes
- cloud-console dashboard
- VM list/cards
- create VM form
- VM details
- start/stop/restart/delete controls
- delete confirmation
- terminal UI
- Cognito integration structure
- API service abstraction
- `.env.example`
- loading/error/empty states
- responsive design

It must be ready to connect to the following real architecture:

```text
React
  ↓
Cognito
  ↓
API Gateway
  ↓
Lambda
  ↓
EC2 + DynamoDB
```

---

## 25. Final Instruction to Cursor / Antigravity

Build the frontend according to this specification. Do not invent AWS credentials or API URLs. Use environment-variable placeholders. Keep all AWS resource provisioning on the serverless backend. The browser is a control console, not the AWS credential holder.
