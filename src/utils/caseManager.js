const path = require('path');
const { readJsonState, atomicWriteJson } = require('./store');

const casesFilePath = path.resolve(__dirname, '..', '..', 'data', 'cases.json');

function initialCaseDatabase() {
  return { lastCaseNumber: 0 };
}

function readCaseDatabase() {
  const data = readJsonState(casesFilePath, initialCaseDatabase);
  if (!Number.isInteger(data.lastCaseNumber) || data.lastCaseNumber < 0) {
    const reset = initialCaseDatabase();
    atomicWriteJson(casesFilePath, reset);
    return reset;
  }
  return data;
}

function saveCaseDatabase(data) {
  atomicWriteJson(casesFilePath, data);
}

function getNextCaseNumber() {
  const database = readCaseDatabase();
  database.lastCaseNumber += 1;
  saveCaseDatabase(database);
  return `CASE-${String(database.lastCaseNumber).padStart(6, '0')}`;
}

module.exports = getNextCaseNumber;
module.exports.readCaseDatabase = readCaseDatabase;
module.exports.saveCaseDatabase = saveCaseDatabase;
module.exports.casesFilePath = casesFilePath;
