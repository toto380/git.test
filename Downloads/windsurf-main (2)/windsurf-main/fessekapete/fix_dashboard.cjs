const fs = require('fs');
const path = require('path');

const dashPath = path.join(__dirname, 'stratads', 'stratads-dashboard', 'src', 'pages', 'Dashboard.jsx');
let content = fs.readFileSync(dashPath, 'utf8');

// 1. Replace the usagePercent definition
const oldUsagePercent = `const usagePercent = stats ? stats.current_requests / stats.max_requests * 100 : 0;`;

const newUsagePercent = `
  const totalChart30d = filteredData && filteredData.length > 0 ? filteredData.reduce((sum, item) => sum + item.total_hits, 0) : 0;
  const displayRequests = (period === '30d' && totalChart30d > 0) ? totalChart30d : (stats?.current_requests || 0);
  const usagePercent = stats ? displayRequests / (stats.max_requests || 1) * 100 : 0;
`;

if (content.includes(oldUsagePercent)) {
  content = content.replace(oldUsagePercent, newUsagePercent);
} else {
  console.log("oldUsagePercent not found!");
}

// 2. Replace the HTML where stats?.current_requests is displayed for the Quota box
// It looks like: <div className="text-3xl font-bold mb-1">{formatNumber(stats?.current_requests)}</div>
const oldDisplay = `<div className="text-3xl font-bold mb-1">{formatNumber(stats?.current_requests)}</div>`;
const newDisplay = `<div className="text-3xl font-bold mb-1">{formatNumber(displayRequests)}</div>`;

if (content.includes(oldDisplay)) {
  content = content.replace(oldDisplay, newDisplay);
  fs.writeFileSync(dashPath, content, 'utf8');
  console.log("Successfully patched Dashboard.jsx quota display.");
} else {
  console.log("oldDisplay not found!");
}
