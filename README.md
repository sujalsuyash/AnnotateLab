# AnnotateLab

A lightweight image and video annotation tool built for a 4-person research team. Upload images or videos, extract frames, label each one with an engagement state, and export everything as CSV for machine learning model training.

---

## What Is This?

AnnotateLab is a local-first annotation tool. Each team member runs the app on their own machine. All four people share the same cloud database and storage, so everyone sees the same data in real time.

Think of it as a simplified version of CVAT — without the complexity of tasks, jobs, or project management. Just upload, label, and store.

---

## Who Uses It

| Role | What They Do |
|---|---|
| Annotator (x2) | Upload images and videos, label each one |
| Supervisor (Professor) | View data, check progress, label occasionally |
| Head | View data, export CSV for analysis |

---

## Core Workflow
Login with Google
↓
Upload images or video
↓
Images compressed → uploaded to Cloudinary → saved to Supabase as "pending"
Video → FFmpeg extracts frames → uploaded to Cloudinary → saved to Supabase as "pending"
↓
Go to Annotate page
↓
Label each image: Engaged / Disengaged / Neutral + optional caption
↓
Record saved to Supabase as "complete"
↓
Head opens Data View → filters → exports CSV

---

## Tech Stack

### Frontend
| Tool | Purpose |
|---|---|
| React + Vite | UI framework |
| React Router v6 | Page navigation |
| Supabase JS Client | Auth + database |
| Google Fonts | Syne, DM Sans, DM Mono |

### Backend
| Tool | Purpose |
|---|---|
| Node.js + Express | Server |
| Multer | File upload handling |
| FFmpeg | Video frame extraction |
| Sharp | Image compression |
| Cloudinary | Cloud image storage |
| UUID | Unique file naming |

### Cloud Services
| Service | Purpose |
|---|---|
| Supabase | PostgreSQL database + Google OAuth |
| Cloudinary | Image and frame storage (25GB free) |

---

---

## Prerequisites

Install these on every team member's machine:

### 1. Node.js
Download from https://nodejs.org — install the LTS version.
```bash
node -v   # should show v18 or higher
npm -v    # should show a version number
```

### 2. FFmpeg

**Windows:**
1. Download from https://github.com/BtbN/FFmpeg-Builds/releases
2. Download `ffmpeg-master-latest-win64-gpl.zip`
3. Extract to `C:\ffmpeg`
4. Add `C:\ffmpeg\bin` to your System PATH:
   - Search "Environment Variables" in Windows search
   - Click Environment Variables
   - Under System Variables find Path
   - Click Edit → New
   - Add `C:\ffmpeg\bin`
   - Click OK on everything
5. Restart terminal and verify:
```bash
ffmpeg -version
```

**Mac:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

### 3. Git
Download from https://git-scm.com

---

## Cloud Setup

### Supabase (Database + Auth)
1. Go to https://supabase.com and create a free account
2. Create a new project
3. Go to SQL Editor and run this to create the table:

```sql
CREATE TABLE annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('image', 'video')),
  source_video_name TEXT,
  frame_number INTEGER,
  label TEXT CHECK (label IN ('engaged', 'disengaged', 'neutral')),
  caption TEXT,
  labeled_by TEXT,
  labeled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can do everything"
ON annotations FOR ALL TO authenticated
USING (true) WITH CHECK (true);
```

4. Enable Google OAuth:
   - Go to Authentication → Providers → Google
   - Toggle Enable
   - Add your Google Client ID and Secret (see below)
   - Save

5. Get your credentials:
   - Go to Settings → API Keys → Legacy anon, service_role API keys
   - Copy Project URL and anon public key

### Google OAuth
1. Go to https://console.cloud.google.com
2. Create a new project named AnnotateLab
3. Go to APIs & Services → OAuth consent screen → External → Create
4. Fill in app name and email → Save
5. Go to APIs & Services → Credentials → Create Credentials → OAuth Client ID
6. Application type: Web application
7. Add Authorized redirect URI:
https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback
8. Copy Client ID and Client Secret → paste into Supabase Google provider settings
9. Add all 4 team members as Test Users under Audience

### Cloudinary (Image Storage)
1. Go to https://cloudinary.com and create a free account
2. From the dashboard copy:
   - Cloud Name
   - API Key
   - API Secret

---

## Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/annotatelab.git
cd annotatelab
```

### Backend Setup
```bash
cd annotatelab-backend
npm install
cp .env.example .env
# Fill in your Cloudinary credentials in .env
```

### Frontend Setup
```bash
cd annotatelab-frontend
npm install
cp .env.example .env
# Fill in your Supabase credentials in .env
```

---

## Environment Variables

### Backend `.env`
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
PORT=3001
```

### Frontend `.env`
```env
VITE_SUPABASE_URL=https://your_project_id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## Running the App

You need **3 terminal windows** open:

### Terminal 1 — Backend
```bash
cd annotatelab-backend
npm start
```
You should see:

AnnotateLab Backend running on port 3001
Cloudinary Cloud: your_cloud_name

### Terminal 2 — ngrok (only needed for uploads)
```bash
ngrok http 3001
```
Copy the forwarding URL e.g. `https://abc123.ngrok-free.app`

Create a `vite.config.js` file in the frontend folder:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://abc123.ngrok-free.app',
        changeOrigin: true,
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      }
    }
  }
})
```

### Terminal 3 — Frontend
```bash
cd annotatelab-frontend
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Pages

### Login
- Single "Continue with Google" button
- Redirects to Google OAuth via Supabase
- Only team members added as test users can log in

### Dashboard
- Welcome message with your name
- Stats: Total images, Pending, Completed
- Progress bar
- Label distribution chart (Engaged / Disengaged / Neutral)
- Last 6 completed annotations

### Upload
Two modes:

**Images mode:**
- Drag and drop multiple images
- Preview thumbnails before uploading
- Uploads in batches of 20
- Each image compressed to ≤200KB

**Video mode:**
- Drag and drop a single video file
- Choose FPS: 1, 2, 5, 10, 15, 24, 30
- Frames extracted: FPS × duration in seconds
- Frames uploaded without compression
- Real-time progress bar

### Annotate
- Images appear one by one
- Select label: Engaged (green) / Disengaged (red) / Neutral (amber)
- Optional caption text
- Navigation: Previous ← and Next → buttons
- Keyboard shortcuts:
  - `1` → Engaged
  - `2` → Disengaged
  - `3` → Neutral
  - `Enter` → Save and Next
  - `Ctrl+S` → Skip
  - `← →` → Navigate between images

### Data View
- Full paginated table of all records (50 per page)
- Filter by: filename, status, label, source type
- Delete individual records (removes from both Cloudinary and Supabase)
- Export filtered data as CSV

---

## How Video Frame Extraction Works
User selects video + FPS
↓
Frontend sends to POST /api/upload/video
↓
Backend creates job in memory, responds with jobId immediately
↓
Background: FFmpeg extracts frames at chosen FPS
↓
Each frame uploaded to Cloudinary
↓
Frontend polls GET /api/job/:jobId every 1.5 seconds
↓
When complete → frontend saves all frames to Supabase

Frame count formula:
Frames = FPS selected × Video duration in seconds

Example:
- 5 minute video at 5 FPS = 1,500 frames

---

## Image Compression

Every uploaded image goes through Sharp compression:

| Pass | Max Width | JPEG Quality | Condition |
|---|---|---|---|
| 1 | 1280px | 85% | Always |
| 2 | unchanged | 70% | If still >200KB |
| 3 | 1024px | 70% | If still >200KB |

Video frames skip compression — FFmpeg already outputs compressed JPEGs averaging 20-80KB.

---

## Storage Estimates

| Scenario | Avg size | 200K files | Total |
|---|---|---|---|
| Compressed images | ~50KB | 200K | ~10GB |
| Video frames (FFmpeg JPEG) | ~30KB | 200K | ~6GB |
| Mixed | ~40KB | 200K | ~8GB |

Cloudinary free tier: **25GB** — enough for ~200K files. ✅

---

## Networking

The backend runs locally on your machine. For teammates on different networks:

1. Install ngrok: https://ngrok.com
2. Run `ngrok http 3001`
3. Share the forwarding URL with teammates
4. Each teammate creates their own `vite.config.js` with that URL
5. URL changes every ngrok restart on free plan — reshare when needed

**Important:** Only the person running the backend needs ngrok. All other operations (annotating, viewing data, exporting) work without the backend since they talk directly to Supabase.

---

## Common Issues

### npm not recognized on Windows
Switch from PowerShell to Command Prompt, or run:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

### ffmpeg not recognized
Make sure `C:\ffmpeg\bin` is in your PATH and restart the terminal.

### Upload fails with 502 error
- Make sure backend is running: `npm start`
- Make sure ngrok is running: `ngrok http 3001`
- Update `vite.config.js` with the current ngrok URL
- Restart the frontend after updating the config

### Google login not working
- Make sure your Gmail is added as a Test User in Google Cloud Console
- Make sure the callback URL in Google matches your Supabase project URL

### Images not showing after upload
- Check Cloudinary dashboard for uploaded files
- Check Supabase table for new rows
- Check backend terminal for error messages

### Video stuck on extracting
- Make sure FFmpeg is installed correctly
- Check backend terminal for FFmpeg error messages
- Try a smaller video file first

---

## Important Security Notes

- Never commit `.env` files
- Never share your Cloudinary API Secret publicly
- Never share your Supabase service_role key — only the anon key goes to the frontend
- Never share your ngrok auth token publicly
- Keep the GitHub repository private

---

## Team Workflow

### When uploading:
1. Person running backend must have `npm start` running
2. Person running backend must have `ngrok http 3001` running
3. Share ngrok URL with the uploader if they are on a different machine

### When annotating:
- Backend does NOT need to be running
- Just open the frontend and go to Annotate page

### When exporting:
- Backend does NOT need to be running
- Open Data View, apply filters, click Export CSV

---

## Built With

- React 18
- Vite 5
- Supabase JS v2
- Express 4
- FFmpeg
- Sharp
- Cloudinary Node SDK
- ngrok
