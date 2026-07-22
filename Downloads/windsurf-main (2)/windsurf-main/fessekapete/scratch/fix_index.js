const fs = require('fs');

let code = fs.readFileSync('functions/index.js', 'utf8');

const target1 = `const isClientOfServer = (sData.client_email === userEmail);
                        
                        if (!isOwner && !isClientOfServer && !isAdmin) {`;
const target2 = `const isClientOfServer = (sData.client_email === userEmail);\r\n                        \r\n                        if (!isOwner && !isClientOfServer && !isAdmin) {`;

const repl = `const isClientOfServer = (sData.client_email === userEmail);
                        const isPartner = (sData.managed_by_partner_id === userId);
                        
                        if (!isOwner && !isClientOfServer && !isAdmin && !isPartner) {`;

if (code.includes(target1)) {
    code = code.replace(target1, repl);
} else if (code.includes(target2)) {
    code = code.replace(target2, repl);
} else {
    console.log("Could not find the target string!");
}

fs.writeFileSync('functions/index.js', code);
console.log("Done");
