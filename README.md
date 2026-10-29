# 🚀 EMBEDX Technical Examination & Certification Platform

> **Official Standalone Assessment & Certification System**  
> **SRM TRP Engineering College (Autonomous), Irungalur, Tiruchirappalli**  
> Hands-on Technical Workshop: *"Basics of Embedded Systems & Embedded Programming Language"*

---

## 🌟 Key Architecture & Portals

1. **Student Assessment Hub (`index.html`)**
   - **Universal Google Authentication:** Allows students to sign in with **ANY Google account** (personal or college domain).
   - **First-Time Registration Gate:** 
     - Student Full Name is strictly enforced in **CAPITAL LETTERS** (`input-uppercase`).
     - Year of study strictly restricted to **`I Year`** and **`II Year`**.
     - Authenticated Google email address is automatically extracted and locked (read-only).
     - Once registered, future visits bypass the registration screen automatically and load the dashboard directly.
   - **Live Proctored Examination Engine:** 
     - Fullscreen auto-request with high-contrast, mobile touch-optimized question player.
     - Multi-layer anti-cheat tracking: Tab switching, app minimization, window blur, and fullscreen exit detection.
     - 3-Warning policy: Warning 1 (Alert), Warning 2 (Final Warning), Warning 3 (Automatic Instant Submission & Infraction Log).
   - **Live Workshop Switchboard Synchronization:** Phase 1 (Quiz 1 & 2) and Phase 2 (Quiz 3, 4 & 5) are controlled dynamically by the workshop administrator.
   - **Official Certificate Studio:** Instant generation of verifiable certificates upon achieving passing scores with QR code and print/PDF support.

2. **Admin Control Center (`admin.html`)**
   - **Live Workshop Switchboard:** Real-time toggles for Phase 1 & Phase 2 live availability.
   - **Countdown Timer Duration Controller:** Dynamically set examination duration (10, 15, 20, or 30 minutes) for all connected participants.
   - **Emergency Hall Broadcast:** Push instant announcement banners to all students.
   - **Question Bank Author & Publisher:** Create, modify, and export questions across all 5 workshop sessions.
   - **Live Anti-Cheat Infraction Stream:** Real-time audit log of student violations with CSV audit export.
   - **Mark Sheet & Results Analytics:** View, filter by year, and export complete student results to CSV/Excel.

3. **Auditorium Projector Presentation Mode (`projector.html`)**
   - **Tailored for the 5th Floor CSE Seminar Hall Projector Screen:** Cinema-grade 16:9 widescreen layout with ultra-crisp typography legible from 30+ meters.
   - **Top-3 Podium Showcase:** 🥇 1st Place Gold Champion, 🥈 2nd Place Silver, 🥉 3rd Place Bronze.
   - **Dynamic Live Leaderboard:** Auto-refresh ticker updating rankings every 10 seconds.
   - **Zero Clutter:** Presentation-only design with no interactive test inputs or admin controls.

---

## 📦 Directory Structure

```
embedx-quiz-platform/
├── assets/
│   └── branding/              # College & EmbedX high-res logos, emblems, and seals
├── css/
│   └── portal.css             # Cyber-academic dark design system & mobile styles
├── js/
│   └── questions.js           # Full 5-session question bank and answer keys
├── index.html                 # Student Assessment & Certification Portal
├── admin.html                 # Organizer & Faculty Live Control Center
├── projector.html             # 5th Floor Seminar Hall Projector Presentation
├── firebase.json              # Firebase Hosting configuration
├── .firebaserc                # Firebase project identifier (embedx-assessment)
├── package.json               # NPM package descriptor & scripts
└── README.md                  # System manual and deployment guide
```

---

## 💻 Step-by-Step Git Bash Commands for New GitHub Repository

Follow these commands in **Git Bash** to push this folder to your brand-new GitHub repository:

### Step 1: Open Git Bash and navigate into the folder
```bash
cd /c/embedx-quiz-platform
```

### Step 2: Initialize Git in this folder
```bash
git init
```

### Step 3: Add all files to staging
```bash
git add .
```

### Step 4: Create your initial commit
```bash
git commit -m "feat: Initial commit of EMBEDX Standalone Quiz Platform 2.0"
```

### Step 5: Set default branch to main
```bash
git branch -M main
```

### Step 6: Link to your new GitHub repository
*(Create an empty repository on GitHub first, e.g., `https://github.com/YOUR_USERNAME/embedx-quiz-platform.git`, then run:)*
```bash
git remote add origin https://github.com/YOUR_USERNAME/embedx-quiz-platform.git
```

### Step 7: Push all files to GitHub
```bash
git push -u origin main
```

---

## 🚀 Live Firebase Deployment

To deploy this standalone platform to Firebase Hosting:

```bash
cd /c/EmbedX/embedx-quiz-platform
firebase deploy --only hosting
```

Your live endpoints will be available at:
- **Student Assessment Hub:** `https://embedx-assessment.web.app/`
- **Admin Control Center:** `https://embedx-assessment.web.app/admin.html`
- **Seminar Hall Projector Display:** `https://embedx-assessment.web.app/projector.html`

