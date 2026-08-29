const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

class RuntimeJsonStore {
  constructor(filePath, {
    defaultValue,
    seedPath = "",
    normalize = (value) => value,
  }) {
    this.filePath = filePath;
    this.defaultValue = defaultValue;
    this.seedPath = seedPath;
    this.normalize = normalize;
    this.mutationTail = Promise.resolve();
  }

  async read() {
    await this.mutationTail;
    return cloneJson(await this.readFromDisk());
  }

  async mutate(mutator) {
    const mutation = this.mutationTail.then(async () => {
      const store = await this.readFromDisk();
      const result = await mutator(store);
      await this.writeToDisk(store);
      return result;
    });

    this.mutationTail = mutation.then(
      () => undefined,
      () => undefined,
    );

    return mutation;
  }

  async readFromDisk() {
    let parsed;

    try {
      parsed = JSON.parse(await fs.readFile(this.filePath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }

      parsed = await this.readSeed();
      const normalizedSeed = this.normalize(cloneJson(parsed));
      await this.writeToDisk(normalizedSeed);
      return normalizedSeed;
    }

    return this.normalize(parsed);
  }

  async readSeed() {
    if (this.seedPath) {
      try {
        return JSON.parse(await fs.readFile(this.seedPath, "utf8"));
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
    }

    return cloneJson(this.defaultValue);
  }

  async writeToDisk(value) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await fs.rename(tempPath, this.filePath);
  }
}

module.exports = {
  RuntimeJsonStore,
};
