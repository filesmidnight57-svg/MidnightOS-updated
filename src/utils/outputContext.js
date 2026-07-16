const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..");
const outputDirectory = path.join(projectRoot, "output");

function ensureOutputDir() {
  fs.mkdirSync(outputDirectory, {
    recursive: true,
  });

  return outputDirectory;
}

module.exports = {
  ensureOutputDir,
};
