const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'pages', 'CookieMonitoring.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const explRegex = /(\s*\{\/\*\s*EXPLICATION DUREE DE VIE COOKIES\s*\*\/\}[\s\S]*?<div className="bg-blue-500\/10 border border-blue-500\/20 rounded-lg p-4 text-sm text-blue-300 mt-4">[\s\S]*?<\/div>\s*<\/div>\n)/;

const match = content.match(explRegex);
if (match) {
  const explBlock = match[0];
  // Remove it from its original place
  content = content.replace(explRegex, '\n');

  // Add the "À savoir" title and wrap it
  const newSection = `
      {/* SECTION A SAVOIR */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <BookOpen className="text-accent" size={24} />
          À savoir
        </h2>
        ${explBlock.trim()}
      </div>
`;

  // Find the exact place to insert it (before the `</div>` that closes PageContent)
  // PageContent ends with:
  //       )}
  //     </div>
  //   );
  const endPattern = `      )}
    </div>
  );`;
  
  if (content.includes(endPattern)) {
    content = content.replace(endPattern, `      )}\n${newSection}\n    </div>\n  );`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully moved the explanation to the bottom and added 'À savoir' title.");
  } else {
    console.log("Could not find the end pattern to insert.");
  }
} else {
  console.log("Could not find the explanation block regex.");
}
