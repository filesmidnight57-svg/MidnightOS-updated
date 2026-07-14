const fs = require("fs");
const path = require("path");

const dataFolderPath = path.resolve(
  __dirname,
  "..",
  "..",
  "data"
);

const casesFilePath = path.join(
  dataFolderPath,
  "cases.json"
);

function ensureCaseDatabase() {
  if (!fs.existsSync(dataFolderPath)) {
    fs.mkdirSync(dataFolderPath, {
      recursive: true,
    });
  }

  if (!fs.existsSync(casesFilePath)) {
    fs.writeFileSync(
      casesFilePath,
      JSON.stringify(
        {
          lastCaseNumber: 0,
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function readCaseDatabase() {
  ensureCaseDatabase();

  try {
    const rawData = fs.readFileSync(
      casesFilePath,
      "utf8"
    );

    const parsedData = JSON.parse(rawData);

    if (
      typeof parsedData.lastCaseNumber !== "number" ||
      parsedData.lastCaseNumber < 0
    ) {
      throw new Error(
        "lastCaseNumber valid number nahi hai."
      );
    }

    return parsedData;
  } catch (error) {
    throw new Error(
      `cases.json read nahi hui: ${error.message}`
    );
  }
}

function saveCaseDatabase(data) {
  try {
    fs.writeFileSync(
      casesFilePath,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (error) {
    throw new Error(
      `cases.json save nahi hui: ${error.message}`
    );
  }
}

function getNextCaseNumber() {
  const database = readCaseDatabase();

  database.lastCaseNumber += 1;

  saveCaseDatabase(database);

  return `CASE #${String(
    database.lastCaseNumber
  ).padStart(6, "0")}`;
}

module.exports = getNextCaseNumber;