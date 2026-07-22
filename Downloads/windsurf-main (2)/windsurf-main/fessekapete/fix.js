const fs = require('fs');
const path = require('path');
const indexPath = path.join(__dirname, 'stratads/functions/index.js');
let content = fs.readFileSync(indexPath, 'utf8');

const regex = /const defaultTranslations = \{[\s\S]*?buttons: \{ accept: "Accept all", decline: "Continue without accepting" \}\s*\}\s*\};/g;

const replacement = `        const defaultTranslations = {
            fr: {
                cookie: {
                    bannerTitle: "Gestion des cookies",
                    bannerText: "Nous et nos partenaires utilisons des traceurs (cookies) pour assurer le bon fonctionnement du site, analyser notre trafic et vous proposer des expériences personnalisées. Vous pouvez accepter, refuser ou paramétrer vos choix. Vous pouvez modifier vos préférences à tout moment.",
                    privacyLink: "Pour en savoir plus, consultez notre <a href='\\x24{privacyUrl}' style='text-decoration: underline; font-weight: 500;'>Politique de confidentialité</a>.",
                    customize: "Choisir mes cookies",
                    accept: "J'accepte",
                    decline: "Continuer sans accepter",
                    preferencesTitle: "Vos préférences",
                    preferencesDesc: "Personnalisez vos choix ci-dessous. Les cookies strictement nécessaires au fonctionnement du site ne peuvent pas être désactivés.",
                    necessaryTitle: "Strictement nécessaires",
                    necessaryDesc: "Requis pour le fonctionnement du site (sécurité, session).",
                    analyticsTitle: "Statistiques",
                    analyticsDesc: "Nous aident à mesurer l'audience et améliorer nos services.",
                    marketingTitle: "Marketing",
                    marketingDesc: "Permettent d'afficher des publicités ciblées.",
                    savePreferences: "Enregistrer mes choix",
                    acceptAll: "Tout accepter",
                    poweredBy: "Propulsé par"
                },
                buttons: { accept: "Tout accepter", decline: "Continuer sans accepter" }
            },
            en: {
                cookie: {
                    bannerTitle: "Manage your cookies",
                    bannerText: "We and our partners use trackers (cookies) to ensure the site works properly, analyze our traffic, and offer personalized experiences. You can accept, reject, or customize your choices. You can modify your preferences at any time.",
                    privacyLink: "To learn more, check our <a href='\\x24{privacyUrl}' style='text-decoration: underline; font-weight: 500;'>Privacy Policy</a>.",
                    customize: "Manage cookies",
                    accept: "I Accept",
                    decline: "Continue without accepting",
                    preferencesTitle: "Your preferences",
                    preferencesDesc: "Customize your choices below. Strictly necessary cookies cannot be disabled.",
                    necessaryTitle: "Strictly necessary",
                    necessaryDesc: "Required for site operation (security, session).",
                    analyticsTitle: "Analytics",
                    analyticsDesc: "Help us measure audience and improve our services.",
                    marketingTitle: "Marketing",
                    marketingDesc: "Allow the display of targeted advertisements.",
                    savePreferences: "Save my choices",
                    acceptAll: "Accept all",
                    poweredBy: "Powered by"
                },
                buttons: { accept: "Accept all", decline: "Continue without accepting" }
            }
        };`;

const matches = content.match(regex);
if (matches && matches.length === 1) {
    content = content.replace(regex, replacement.trim());
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log('Success with regex!');
} else {
    console.error('Regex failed. Found matches:', matches ? matches.length : 0);
}
