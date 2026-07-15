const fs = require("fs");
const path = require("path");

const CHARACTER_DATABASE_PATH = path.join(__dirname, "../data/characters.json");

function readCharacterDatabase() {
  const rawDatabase = fs.readFileSync(CHARACTER_DATABASE_PATH, "utf8");
  const database = JSON.parse(rawDatabase);

  if (!database || !Array.isArray(database.characters)) {
    throw new Error("Character database must include a characters array.");
  }

  return database;
}

function buildConsistencyPrompt(character) {
  return [
    `${character.name}, a ${character.age}-year-old ${character.nationality} ${character.gender} ${character.role}`,
    `with ${character.faceDescription}`,
    `${character.hair}`,
    `${character.facialHair}`,
    `${character.bodyBuild}`,
    `wearing ${character.clothing}`,
    `with ${character.accessories}`,
  ].join(", ") + ". Keep the exact same name, age, face, hairstyle, moustache, body type, clothing, and accessories in every scene.";
}

function normalizeCharacter(character) {
  if (!character || typeof character !== "object") {
    throw new Error("Character profile must be an object.");
  }

  const requiredFields = [
    "id",
    "name",
    "age",
    "gender",
    "nationality",
    "role",
    "faceDescription",
    "hair",
    "facialHair",
    "bodyBuild",
    "clothing",
    "accessories",
  ];

  requiredFields.forEach((field) => {
    if (character[field] === undefined || character[field] === null || character[field] === "") {
      throw new Error(`Character profile is missing required field: ${field}`);
    }
  });

  return {
    id: character.id,
    name: character.name,
    age: character.age,
    gender: character.gender,
    nationality: character.nationality,
    role: character.role,
    faceDescription: character.faceDescription,
    hair: character.hair,
    facialHair: character.facialHair,
    bodyBuild: character.bodyBuild,
    clothing: character.clothing,
    accessories: character.accessories,
    consistencyPrompt: character.consistencyPrompt || buildConsistencyPrompt(character),
  };
}

function getCharacterById(characterId) {
  const database = readCharacterDatabase();
  const character = database.characters.find((item) => item.id === characterId);

  if (!character) {
    throw new Error(`Character not found in database: ${characterId}`);
  }

  return normalizeCharacter(character);
}

function getMainCharacter() {
  const database = readCharacterDatabase();
  const mainCharacterId = database.mainCharacterId;

  if (!mainCharacterId) {
    throw new Error("Character database must define mainCharacterId.");
  }

  const character = database.characters.find((item) => item.id === mainCharacterId);

  if (!character) {
    throw new Error(`Main character not found in database: ${mainCharacterId}`);
  }

  return normalizeCharacter(character);
}

function applyPermanentCharacterToDirectorPlan(plan, character = getMainCharacter()) {
  if (!plan || typeof plan !== "object") {
    throw new Error("Director plan must be an object before applying character consistency.");
  }

  plan.mainCharacter = {
    name: character.name,
    age: character.age,
    gender: character.gender,
    nationality: character.nationality,
    role: character.role,
    faceDescription: character.faceDescription,
    hair: character.hair,
    facialHair: character.facialHair,
    bodyBuild: character.bodyBuild,
    clothing: character.clothing,
    accessories: character.accessories,
    consistencyPrompt: character.consistencyPrompt,
  };

  if (Array.isArray(plan.scenes)) {
    plan.scenes.forEach((scene) => {
      if (!scene || typeof scene !== "object") {
        return;
      }

      const prompt = typeof scene.imagePrompt === "string" ? scene.imagePrompt.trim() : "";
      scene.imagePrompt = prompt.startsWith(character.consistencyPrompt)
        ? prompt
        : `${character.consistencyPrompt} ${prompt}`.trim();
    });
  }

  return plan;
}

module.exports = {
  CHARACTER_DATABASE_PATH,
  readCharacterDatabase,
  buildConsistencyPrompt,
  getCharacterById,
  getMainCharacter,
  applyPermanentCharacterToDirectorPlan,
};
