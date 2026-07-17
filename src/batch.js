const { generateCase } = require("./app");
const { publishYouTubeShorts } = require("./youtubePublisher");

function parseBatchOptions(argv = process.argv.slice(2)) {
  const options = { count: 1, publish: true };
  for (const arg of argv) {
    if (arg.startsWith("--count=")) options.count = Number.parseInt(arg.split("=")[1], 10);
    if (arg.startsWith("--publish=")) options.publish = arg.split("=")[1].toLowerCase() !== "false";
  }
  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new Error("--count must be a positive integer.");
  }
  return options;
}

async function generateBatch(options = parseBatchOptions()) {
  const generatedCases = [];
  for (let index = 0; index < options.count; index += 1) {
    const generatedCase = await generateCase();
    generatedCases.push(generatedCase);
    if (options.publish) await publishYouTubeShorts({ outputDir: generatedCase.outputDir });
  }
  return generatedCases;
}

if (require.main === module) {
  generateBatch().catch((error) => {
    console.error(`❌ Batch generation failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { generateBatch, parseBatchOptions };
