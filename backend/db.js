// db.js — single shared Neo4j/CognoDB driver instance.
//
// CognoDB speaks openCypher over Bolt, so the official neo4j-driver package
// works against it unmodified. Connection details are read from environment
// variables only — never hardcode credentials here.

const neo4j = require("neo4j-driver");

const {
  COGNODB_URI,
  COGNODB_USER = "cognodb",
  COGNODB_PASSWORD,
} = process.env;

if (!COGNODB_URI || !COGNODB_PASSWORD) {
  console.error(
    "[db] Missing COGNODB_URI or COGNODB_PASSWORD. Copy .env.example to .env and fill in your CognoDB Cloud connection details."
  );
}

let driver = null;

function getDriver() {
  if (driver) return driver;

  driver = neo4j.driver(
    COGNODB_URI,
    neo4j.auth.basic(COGNODB_USER, COGNODB_PASSWORD),
    {
      maxConnectionPoolSize: 20,
      connectionAcquisitionTimeout: 10_000,
      connectionTimeout: 10_000,
    }
  );

  return driver;
}

// Verifies connectivity once at boot so the server fails fast (and loudly)
// instead of returning cryptic errors on the first real request.
async function verifyConnectivity() {
  const d = getDriver();
  await d.verifyConnectivity();
}

// Runs a single Cypher statement in an auto-committed session and returns
// plain JS records. Always use parameters ($param) — never string-concatenate
// user input into the query text.
async function runQuery(cypher, params = {}) {
  const session = getDriver().session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => record.toObject());
  } finally {
    await session.close();
  }
}

async function runWrite(cypher, params = {}) {
  const session = getDriver().session();
  try {
    return await session.executeWrite((tx) => tx.run(cypher, params));
  } finally {
    await session.close();
  }
}

async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

module.exports = { getDriver, verifyConnectivity, runQuery, runWrite, closeDriver };
