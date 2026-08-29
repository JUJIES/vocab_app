#!/usr/bin/env node
const path = require("path");
const { TeacherService } = require("../lib/teacher-service");

async function main() {
  const dataDirArgument = process.argv.find((argument) => argument.startsWith("--data-dir="));
  const dataDir = dataDirArgument
    ? path.resolve(dataDirArgument.slice("--data-dir=".length))
    : path.resolve(process.env.DATA_DIR || path.join(__dirname, "..", "data"));
  const resetPasswords = process.argv.includes("--reset-passwords");
  const resetTeacherArgument = process.argv.find((argument) => argument.startsWith("--reset-teacher="));
  const resetTeacherId = resetTeacherArgument?.slice("--reset-teacher=".length).trim().toLowerCase() || "";

  if (resetPasswords && resetTeacherId) {
    throw new Error("--reset-passwords und --reset-teacher können nicht gemeinsam verwendet werden.");
  }

  const teacherService = new TeacherService({
    dataDir,
    seedPath: path.join(__dirname, "..", "data", "teachers.seed.json"),
  });
  const generatedPasswords = resetTeacherId
    ? [await teacherService.resetPassword(resetTeacherId)]
    : await teacherService.provisionInitialPasswords({ resetPasswords });

  if (generatedPasswords.length === 0) {
    process.stdout.write("Keine Startpasswörter erzeugt. Bereits eingerichtete Accounts blieben unverändert.\n");
    return;
  }

  process.stdout.write("Einmalige Lerndeck-Startpasswörter:\n\n");
  for (const entry of generatedPasswords) {
    process.stdout.write(`${entry.displayName} (${entry.username}): ${entry.initialPassword}\n`);
  }
  process.stdout.write("\nStartpasswörter nur sicher weitergeben. Lehrkräfte ändern sie nach der ersten Anmeldung im Zahnrad-Menü.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
