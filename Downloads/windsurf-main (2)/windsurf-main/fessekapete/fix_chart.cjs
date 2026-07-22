const fs = require('fs');
const path = require('path');

const dashPath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'pages', 'Dashboard.jsx');
let content = fs.readFileSync(dashPath, 'utf8');

// Replace imports
content = content.replace(
  /import {([^}]*)AreaChart,([^}]*)Area,([^}]*)} from "recharts";/g,
  'import {$1LineChart,$2Line,$3} from "recharts";'
);

// Replace <AreaChart ... > with <LineChart ... >
content = content.replace(/<AreaChart([\s\S]*?)>/g, '<LineChart$1>');
// Replace </AreaChart> with </LineChart>
content = content.replace(/<\/AreaChart>/g, '</LineChart>');

// Replace <Area ... /> with <Line ... dot={false} activeDot={{ r: 4 }} />
content = content.replace(/<Area([^>]+)fill="url\([^)]+\)"([^>]*)>/g, '<Line$1dot={false} activeDot={{ r: 4 }}$2>');
content = content.replace(/<Area([^>]+)>/g, '<Line$1dot={false} activeDot={{ r: 4 }}>');
content = content.replace(/<\/Area>/g, '</Line>');

// Remove <defs>...</defs> block which contains the gradients
content = content.replace(/<defs>[\s\S]*?<\/defs>/g, '');

fs.writeFileSync(dashPath, content, 'utf8');
console.log("Successfully replaced Area with Line via regex.");
