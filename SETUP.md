# Setup Instructions for WorkyFinder

## Local Development Setup

### 1. Create `.env.local` file
Copy `.env.example` to `.env.local` and add your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Google OAuth credentials:
```
VITE_GOOGLE_CLIENT_ID=your_client_id_here
VITE_GOOGLE_API_KEY=your_api_key_here
```

### 2. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable the Google Calendar API
4. Create an OAuth 2.0 Client ID (Web application)
5. Add authorized JavaScript origins: `http://localhost:8000` (or your local server)
6. Copy the **Client ID** and **API Key** into `.env.local`

### 3. Run Locally

Option A: Simple HTTP Server
```bash
# Using Python
python -m http.server 8000

# Or using Node.js (http-server)
npx http-server -p 8000
```

Then visit: `http://localhost:8000`

---

## Production Deployment (GitHub Pages)

### 1. Get Production Credentials

1. In Google Cloud Console, update your OAuth app with:
   - **Authorized JavaScript origins:** `https://yourusername.github.io`
   - **Authorized redirect URIs:** `https://yourusername.github.io/`
   
   Replace `yourusername` with your actual GitHub username

2. Copy the new **Client ID** and **API Key**

### 2. Store Secrets in GitHub

1. Go to your repository → Settings → Secrets and variables → Actions
2. Add two secrets:
   - `GOOGLE_CLIENT_ID` = your Client ID
   - `GOOGLE_API_KEY` = your API Key

### 3. Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Replace credentials in HTML
        run: |
          sed -i "s|window.__CONFIG__ = {|window.__CONFIG__ = {\n            CLIENT_ID: '${{ secrets.GOOGLE_CLIENT_ID }}',\n            API_KEY: '${{ secrets.GOOGLE_API_KEY }}',|" index.html
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

### 4. Push to GitHub

```bash
git add .
git commit -m "Setup environment variables and GitHub Actions"
git push origin main
```

Your site will be available at: `https://yourusername.github.io`

---

## Important Security Notes

⚠️ **NEVER commit `.env.local` to Git**
- It's already in `.gitignore`
- The credentials in this file are for development only

✅ **For production:**
- Store credentials in GitHub Secrets (not in code)
- Use GitHub Actions to inject them during deployment
- Regularly rotate your API keys

---

## Troubleshooting

### "Error 400: redirect_uri_mismatch"
- Make sure the origin in your OAuth app matches where you're running the app
- Local: `http://localhost:8000`
- GitHub Pages: `https://yourusername.github.io`

### "API credentials invalid"
- Check that you copied the right credentials into `.env.local`
- Make sure you created the credentials in Google Cloud Console
- Verify the API Key and Client ID are not swapped
