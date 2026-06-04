const fs = require('fs');
const args = process.argv.slice(2);

// hermesc is called with: -emit-binary -out <output> <input> [flags]
let inputFile = null;
let outputFile = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-out' || args[i] === '-output-source-map') {
    if (args[i] === '-out') outputFile = args[i + 1];
    i++;
  } else if (!args[i].startsWith('-')) {
    inputFile = args[i];
  }
}

if (inputFile && outputFile) {
  fs.copyFileSync(inputFile, outputFile);
} else {
  // fallback: just exit cleanly
  process.exit(0);
}