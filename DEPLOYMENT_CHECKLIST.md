# Project Sentinal v2 — Catalyst Deployment Checklist

## Pre-deployment (local)
- [x] Frontend builds successfully
- [x] Backend starts with no errors
- [x] All 22+ endpoints return 200 OK
- [x] All 14 pages render correctly
- [x] sentinal.db optimized with VACUUM
- [x] Dockerfile tested locally
- [x] requirements.txt has all dependencies pinned

## Catalyst Setup Steps

### Step A — Create AppSail Service (Backend)
1. Go to Catalyst Console → AppSail
2. Create new service named: sentinal-backend
3. Select Docker container deployment
4. Connect your GitHub repo
5. Set root directory: backend/
6. Set port: 8000
7. Add environment variables:
   - CATALYST_QUICKML_KEY = [your Catalyst QuickML key]
   - CATALYST_LLM_MODEL = GLM-4.7-Flash
   - CATALYST_VISION_MODEL = VL-Qwen3.6-35B-A3B
   - HF_TOKEN = [optional, embedding fallback only]
8. Deploy and wait for health check to pass
9. Copy the AppSail URL (format: xxx.catalystappsail.in)

### Step B — Update Frontend API URL
1. Open frontend/.env.production
2. Replace REPLACE_WITH_YOUR_APPSAIL_URL with your AppSail URL
3. Rebuild frontend: npm run build

### Step C — Deploy Frontend to Slate
1. Go to Catalyst Console → Web Client Hosting (Slate)
2. Create new client named: sentinal-frontend
3. Upload the frontend/dist/ folder
4. Set index document: index.html
5. Set error document: index.html (for React Router)
6. Deploy and get the Slate URL

### Step D — Verify Deployment
Run these checks against your live URLs:
- GET https://[your-appsail-url]/health → should return {"status":"ok"}
- GET https://[your-slate-url]/dashboard → should load the dashboard
- Open browser console → should have no CORS errors

## Environment Variables for AppSail
Set these in Catalyst Console → AppSail → Environment Variables:
```
CATALYST_PROJECT_ID = 50170000000065001
CATALYST_QUICKML_KEY = your_key
CATALYST_LLM_MODEL = GLM-4.7-Flash
CATALYST_VISION_MODEL = VL-Qwen3.6-35B-A3B
CATALYST_NLP_TRANSLATION_URL = https://api.catalyst.zoho.in/quickml/v1/project/50170000000065001/nlp/text-translation
CATALYST_NLP_TTS_URL = https://api.catalyst.zoho.in/quickml/v1/project/50170000000065001/nlp/text-to-audio
CATALYST_NLP_STT_URL = https://api.catalyst.zoho.in/quickml/v1/project/50170000000065001/nlp/audio-to-text
HF_TOKEN = your_token
```

## Common Issues
- CORS errors: Backend CORS is already configured for all origins
- 502 timeout: AppSail needs 60s startup time for ML model loading
- Missing data: sentinal.db must be included in the Docker build context
