import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import prisma from "./db.server";

const globalForTenant = global;
if (!globalForTenant.tenantPrismaClients) {
  globalForTenant.tenantPrismaClients = new Map();
}
const tenantPrismaClients = globalForTenant.tenantPrismaClients;

export async function ensureTenantDatabase(shop) {
  if (!shop) {
    throw new Error("ensureTenantDatabase requires shop");
  }

  const existing = await prisma.tenantDatabase.findUnique({
    where: { shop },
  });

  if (existing?.databaseUrl) {
    return existing.databaseUrl;
  }

  const dbName = toTenantDbName(shop);
  const databaseUrl = buildTenantDatabaseUrl(dbName);

  await createNeonDatabase(dbName);
  await maybeRunMigrations(databaseUrl);

  const record = await prisma.tenantDatabase.upsert({
    where: { shop },
    update: { databaseUrl },
    create: { shop, databaseUrl },
  });

  return record.databaseUrl;
}

export async function getTenantPrisma(shop) {
  const databaseUrl = await ensureTenantDatabase(shop);

  if (!tenantPrismaClients.has(shop)) {
    tenantPrismaClients.set(
      shop,
      new PrismaClient({
        datasources: {
          db: { url: databaseUrl },
        },
      }),
    );
  }

  return tenantPrismaClients.get(shop);
}

function toTenantDbName(shop) {
  const prefix = process.env.TENANT_DB_PREFIX || "tenant";
  const base = String(shop || "shop")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safeBase = base || "shop";
  const hash = crypto.createHash("sha256").update(shop).digest("hex").slice(0, 8);
  const maxBaseLength = 63 - hash.length - 1;
  const trimmed = `${prefix}_${safeBase}`.slice(0, maxBaseLength);
  return `${trimmed}_${hash}`;
}

function buildTenantDatabaseUrl(dbName) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to build tenant DB urls");
  }

  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function createNeonDatabase(dbName) {
  const apiKey = requireEnv("NEON_API_KEY");
  const projectId = requireEnv("NEON_PROJECT_ID");
  const branchId = requireEnv("NEON_BRANCH_ID");
  const ownerName = getNeonOwnerName();

  const response = await fetch(
    `https://console.neon.tech/api/v2/projects/${projectId}/branches/${branchId}/databases`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        database: { name: dbName, owner_name: ownerName },
      }),
    },
  );

  if (response.ok) {
    return;
  }

  const text = await response.text();
  if (response.status === 409 || text.toLowerCase().includes("already exists")) {
    return;
  }

  throw new Error(
    `Neon database creation failed (${response.status}): ${text || "unknown error"}`,
  );
}

function getNeonOwnerName() {
  if (process.env.NEON_DB_OWNER) {
    return process.env.NEON_DB_OWNER;
  }

  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    if (url.username) {
      return url.username;
    }
  }

  throw new Error("NEON_DB_OWNER is required for Neon database creation");
}

async function maybeRunMigrations(databaseUrl) {
  if (process.env.AUTO_MIGRATE_TENANT_DB !== "true") {
    return;
  }

  const { spawn } = await import("node:child_process");
  const command = process.platform === "win32" ? "npx.cmd" : "npx";

  await new Promise((resolve, reject) => {
    const child = spawn(command, ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Tenant migrate failed with exit code ${code}`));
      }
    });
  });
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Neon tenant provisioning`);
  }
  return value;
}
