const fs = require('fs');
const path = require('path');

const baseDir = 'c:/Users/anton/Downloads/windsurf-main (2)/windsurf-main/fessekapete';

function walk(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

const fileTypes = ['.json', '.js', '.jsx', '.html'];
const blacklist = ['node_modules', '.git', '.firebase', 'dist', 'scratch'];

walk(baseDir, (err, files) => {
  if (err) throw err;
  files.forEach(file => {
    if (blacklist.some(b => file.includes(b))) return;
    if (!fileTypes.includes(path.extname(file))) return;
    
    try {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('50%') || content.includes('50 %')) {
        console.log(`Found "50%" in: ${file}`);
        // print matching lines
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('50%') || line.includes('50 %')) {
            console.log(`  Line ${index + 1}: ${line.trim()}`);
          }
        });
      }
    } catch (e) {
      // ignore
    }
  });
});
