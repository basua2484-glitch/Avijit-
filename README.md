# Hostel Mess & Shift Manager (Android & Web App)

A modern, responsive, zero-food-wastage hostel mess management, overtime shift tracking, multi-role RBAC, and auto-accounting billing system.

---

## 🌐 Web App (HTML, CSS, JavaScript)

A complete standalone Web App version is available in the `/webapp` directory:
- **`webapp/index.html`**: Semantic, responsive HTML structure covering Resident Portal, Kitchen Live Counter, Manager Ops, Admin Master Control, and Itemized Billing.
- **`webapp/style.css`**: Clean Utility minimal styling, responsive layouts, Material 3 design tokens, tonal badges, and mobile-first navigation.
- **`webapp/app.js`**: Full client-side state engine with LocalStorage persistence, multi-role authentication switching, 3-step transparent billing formulas, and cut-off/OT logic.

### Running the Web App
Simply open `webapp/index.html` in any modern web browser or deploy it directly to **GitHub Pages**, **Vercel**, or **Netlify**.

---

## 📱 Android App (Jetpack Compose & Kotlin)

Built using Kotlin, Jetpack Compose, Material Design 3, Room persistence, and MVVM Clean Architecture.

---

## 🚀 How to Push this Project to GitHub

You can export or push the entire project directly from **Google AI Studio**:

1. **Direct GitHub Push via UI**:
   - Click on the **Settings / Project Menu** (top right in Google AI Studio).
   - Select **"Export to GitHub"** or **"Push to GitHub"**.
   - Authenticate your GitHub account and choose your repository name.
   - AI Studio will automatically push all source files (including Android codebase and the `/webapp` HTML/CSS/JS application).

2. **Manual Git Push via Terminal / ZIP Export**:
   - Download the project ZIP from the top menu.
   - Extract the folder on your local machine.
   - Initialize git and push:
   ```bash
   git init
   git add .
   git commit -m "Hostel Mess & Shift Manager complete Android and Web App"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

3. **Deploying the Web App to GitHub Pages (Free Hosting)**:
   - Go to your repository on GitHub.
   - Navigate to **Settings** > **Pages**.
   - Under **Build and deployment**, select `Deploy from a branch`.
   - Set the folder path to `/webapp` or root branch `/main`.
   - Your Web App will go live immediately on `https://<your-username>.github.io/<repo-name>/webapp/`.
