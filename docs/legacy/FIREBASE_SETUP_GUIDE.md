# EMBEDX Platform — Firebase Authentication & Hosting Setup Guide

This guide explains how to configure Google Authentication and host the standalone `/quiz/` portal using Google Firebase.

---

## 1. Firebase Authentication Setup (Google Sign-In)

To enable real Google Workspace login with domain enforcement (`@trp.srmtrichy.edu.in`):

### Step 1: Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and enter a name (e.g. `embedx-assessment`).
3. Google Analytics is optional; click **Create Project**.

### Step 2: Enable Google Authentication
1. In your Firebase Console side menu, navigate to **Build** &rarr; **Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab, click on **Google**.
4. Toggle **Enable**.
5. Set your **Project support email** (your official college email).
6. Click **Save**.

### Step 3: Register Web App & Get Firebase Config
1. In Project Overview (gear icon &rarr; **Project settings**).
2. Under **Your apps**, click the Web icon (`</>`).
3. Enter app nickname: `EMBEDX Quiz App`.
4. Check **Also set up Firebase Hosting for this app**.
5. Click **Register app**.
6. Firebase will display your `firebaseConfig` snippet:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   // Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyACO6JtEgvD_n5m5haPV-0y91Z76UI9C18",
  authDomain: "embedx-assessment.firebaseapp.com",
  projectId: "embedx-assessment",
  storageBucket: "embedx-assessment.firebasestorage.app",
  messagingSenderId: "803481654330",
  appId: "1:803481654330:web:3bd07cd5cf42c4de1e5103",
  measurementId: "G-S94VH65XXC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
   ```
7. Copy these keys and update `firebaseConfig` inside [`quiz/index.html`](../quiz/index.html#L707).

---

## 2. Deploying to Firebase Hosting via Git Bash

### Step 1: Install Firebase CLI
In Git Bash, run:
```bash
npm install -g firebase-tools
```

### Step 2: Log In to Google Firebase
```bash
firebase login
```
*(This opens your browser to authorize Firebase CLI).*

### Step 3: Deploy the Portal
To deploy the whole website including `/quiz`:
```bash
firebase deploy --only hosting
```

Your assessment portal will immediately be live at:
`https://<your-firebase-project>.web.app/quiz/`

---

## 3. Institutional Domain Restriction

The client authentication engine strictly validates that the authenticated Google account ends with:
```javascript
email.toLowerCase().endsWith('@trp.srmtrichy.edu.in')
```
If a student attempts to sign in with a personal `@gmail.com` account, Firebase immediately signs them out and blocks access with an **ACCESS RESTRICTED** security notice.

