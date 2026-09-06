const path = require("path");
const { SetService } = require("../lib/set-service");
const { VisualService } = require("../lib/visual-service");

async function main() {
  const dataDir = path.resolve(readArgument("--data-dir=") || process.env.DATA_DIR || path.join(__dirname, "..", "data"));
  const teacherId = readArgument("--teacher=") || "julius";
  const selectedIds = new Set(readArguments("--set-id=").map((value) => value.toLowerCase()));
  const selectedTitles = new Set(readArguments("--set-title=").map((value) => value.toLocaleLowerCase("de")));
  const apply = process.argv.includes("--apply");

  if (selectedIds.size === 0 && selectedTitles.size === 0) {
    throw new Error("Mindestens --set-id=<id> oder --set-title=<Titel> ist erforderlich.");
  }

  const setService = new SetService({ dataDir });
  const visualService = new VisualService({ dataDir, setService, apiKey: "" });
  const ownedSets = await setService.listOwnedSets(teacherId);
  const selectedSets = ownedSets.filter((setEntry) => (
    selectedIds.has(setEntry.id.toLowerCase())
    || selectedTitles.has(setEntry.title.toLocaleLowerCase("de"))
  ));
  if (selectedSets.length === 0) {
    throw new Error("Keines der ausgewählten Sets wurde für diese Lehrkraft gefunden.");
  }

  const results = [];
  for (const setEntry of selectedSets) {
    results.push(await visualService.normalizeActiveSheetAssets(
      teacherId,
      setEntry.id,
      { apply },
    ));
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    dataDir,
    teacherId,
    results,
  }, null, 2));
}

function readArgument(prefix) {
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) || "";
}

function readArguments(prefix) {
  return process.argv
    .filter((argument) => argument.startsWith(prefix))
    .map((argument) => argument.slice(prefix.length))
    .filter(Boolean);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
