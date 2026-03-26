# Hype Detector

Cut through marketing noise. Paste any product page, job listing, or App Store description and get an AI-powered breakdown of what's real vs what's hype.

---

## Project structure

```
hype-detector/
├── backend/
│   ├── server.js       ← Node.js proxy (holds your Gemini key)
│   └── package.json
├── frontend/
│   └── index.html      ← Static site (deployed separately)
└── README.md
```

---

## Step 1 — Push to GitHub

1. Create a new GitHub repo called `hype-detector`
2. Push this entire folder to it:

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/hype-detector.git
git push -u origin main
```

---

## Step 2 — Deploy the backend on Render

1. Go to [render.com](https://render.com) and sign up (free)
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Fill in these settings:

| Field | Value |
|---|---|
| Name | `hype-detector-backend` |
| Root directory | `backend` |
| Runtime | `Node` |
| Build command | `npm install` |
| Start command | `npm start` |
| Instance type | `Free` |

5. Under **Environment Variables**, click **Add Environment Variable**:
   - Key: `GEMINI_API_KEY`
   - Value: `your_actual_gemini_key_here`

6. Click **Create Web Service**

7. Wait ~2 minutes for it to deploy. Copy the URL — it will look like:
   `https://hype-detector-backend.onrender.com`

---

## Step 3 — Update the frontend with your backend URL

Open `frontend/index.html` and find this line near the bottom:

```js
const BACKEND_URL = "https://your-backend.onrender.com";
```

Replace it with your actual backend URL from Step 2:

```js
const BACKEND_URL = "https://hype-detector-backend.onrender.com";
```

Save the file and commit + push to GitHub.

---

## Step 4 — Deploy the frontend on Render

1. Go to Render → **New → Static Site**
2. Connect the same GitHub repo
3. Fill in these settings:

| Field | Value |
|---|---|
| Name | `hype-detector` |
| Root directory | `frontend` |
| Build command | *(leave empty)* |
| Publish directory | `.` |

4. Click **Create Static Site**

Your site will be live at something like:
`https://hype-detector.onrender.com`

---

## Important notes

- **Backend sleep**: The free Render web service sleeps after 15 minutes of inactivity. The first request after sleep takes ~5 seconds. The frontend shows a "warming up" message automatically.
- **Rate limit**: 5 analyses per IP per day (in-memory, resets on server restart).
- **Gemini key**: Never commit your API key to GitHub. It lives only in Render's environment variables.
- **Free tier**: Both services are on Render's free tier — no credit card needed, no time limit.

---

## Local development

```bash
# Backend
cd backend
npm install
GEMINI_API_KEY=your_key_here node server.js

# Frontend — just open in browser
open frontend/index.html
# Update BACKEND_URL to http://localhost:3000 for local testing
```
