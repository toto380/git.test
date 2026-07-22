const fs = require('fs');
const path = require('path');

// 1. Fix Dashboard.jsx
const dashPath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'pages', 'Dashboard.jsx');
let dashContent = fs.readFileSync(dashPath, 'utf8');

dashContent = dashContent.replace(/import \{ getFunctions, httpsCallable \} from "firebase\/functions";/, 'import { httpsCallable } from "firebase/functions";\nimport { functions } from "../firebase";');
dashContent = dashContent.replace(/const functions = getFunctions\(\);\s*/g, '');

fs.writeFileSync(dashPath, dashContent, 'utf8');
console.log('Fixed Dashboard.jsx');

// 2. Fix CookieMonitoring.jsx
const cookiePath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'pages', 'CookieMonitoring.jsx');
let cookieContent = fs.readFileSync(cookiePath, 'utf8');

cookieContent = cookieContent.replace(/const functions = getFunctions\(\);\s*/g, '');

// 3. Move explanations in CookieMonitoring.jsx
// We need to extract the "Explications / À savoir" content which the user wants at the bottom.
// In the current CookieMonitoring.jsx, there are multiple explanation cards mixed with the content.
// We'll just ask the user or move specific blocks? Wait, let's look at the structure first.
fs.writeFileSync(cookiePath, cookieContent, 'utf8');
console.log('Fixed CookieMonitoring.jsx functions');
