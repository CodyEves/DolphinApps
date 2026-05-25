import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);

const env = {
  JWT_PRIVATE_KEY: privateKey.trimEnd().replace(/\n/g, " "),
  JWKS: JSON.stringify({ keys: [{ use: "sig", ...publicKey }] }),
  SITE_URL: process.env.SITE_URL ?? "http://localhost:5173",
};

const lines = Object.entries(env).map(([name, value]) => {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `${name}="${escaped}"`;
});

const dir = mkdtempSync(join(tmpdir(), "convex-auth-env-"));
const envFile = join(dir, ".env");
writeFileSync(envFile, `${lines.join("\n")}\n`);

const localConfigPath = join(projectRoot, ".convex/local/default/config.json");
const localConfig = JSON.parse(readFileSync(localConfigPath, "utf8"));
const deploymentUrl = `http://127.0.0.1:${localConfig.ports.cloud}`;

try {
  execFileSync(
    "node",
    [
      "node_modules/convex/bin/main.js",
      "env",
      "set",
      "--url",
      deploymentUrl,
      "--admin-key",
      localConfig.adminKey,
      "--from-file",
      envFile,
    ],
    { stdio: "inherit", cwd: projectRoot },
  );
  console.log(
    `Set JWT_PRIVATE_KEY, JWKS, and SITE_URL on ${deploymentUrl}. Restart \`convex dev\` if sign-in still fails.`,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
