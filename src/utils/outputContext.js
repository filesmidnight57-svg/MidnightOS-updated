const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..");
const outputDirectory = path.join(projectRoot, "output");
const CASE_DIRECTORY_PATTERN = /^CASE-\d{6}$/;

function ensureOutputDir() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  return outputDirectory;
}

function formatCaseId(caseNumber) {
  const digits = String(caseNumber || "").match(/\d+/)?.[0];
  if (!digits) throw new Error(`Invalid case number: ${caseNumber}`);
  return `CASE-${digits.padStart(6, "0")}`;
}

function createCaseOutputDir(caseNumber) {
  const caseId = formatCaseId(caseNumber);
  const caseOutputDir = path.join(ensureOutputDir(), caseId);
  fs.mkdirSync(caseOutputDir, { recursive: true });
  return caseOutputDir;
}

function listCaseOutputDirs() {
  if (!fs.existsSync(outputDirectory)) return [];

  return fs.readdirSync(outputDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && CASE_DIRECTORY_PATTERN.test(entry.name))
    .map((entry) => path.join(outputDirectory, entry.name));
}

function getLatestCaseOutputDir() {
  return listCaseOutputDirs()
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] || null;
}

module.exports = {
  ensureOutputDir,
  formatCaseId,
  createCaseOutputDir,
  listCaseOutputDirs,
  getLatestCaseOutputDir,
};
