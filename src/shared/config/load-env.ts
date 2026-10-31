import { loadEnvConfig } from "@next/env";
import fs from "node:fs";
import path from "node:path";

const silentLog = {
  info: () => undefined,
  error: () => undefined,
};

export function loadProjectEnv(projectDir = process.cwd()): void {
  const dir = path.resolve(projectDir);
  const dev = process.env.NODE_ENV !== "production";
  assertUtf8EnvFiles(dir, dev);
  loadEnvConfig(dir, dev, silentLog, true);
}

function assertUtf8EnvFiles(dir: string, dev: boolean): void {
  const names = dev
    ? [".env", ".env.local", ".env.development", ".env.development.local"]
    : [".env", ".env.local", ".env.production", ".env.production.local"];

  for (const name of names) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    const fd = fs.openSync(file, "r");
    try {
      const header = Buffer.alloc(2);
      const read = fs.readSync(fd, header, 0, 2, 0);
      const utf16 =
        read >= 2 &&
        ((header[0] === 0xff && header[1] === 0xfe) || (header[0] === 0xfe && header[1] === 0xff));
      if (utf16) {
        throw new Error(`${name} is UTF-16. Save it as UTF-8. The file contents were not loaded.`);
      }
    } finally {
      fs.closeSync(fd);
    }
  }
}
