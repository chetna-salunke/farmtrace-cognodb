// seed.js — loads the FarmTrace dataset into CognoDB.
//
// Usage:
//   cd backend && npm install
//   cd ../seed && node seed.js
// (or: npm run seed --prefix backend)
//
// Idempotent: every write uses MERGE, so running this twice does not create
// duplicates. Connection details come from environment variables — see
// .env.example.

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const neo4j = require("neo4j-driver");
const { farms, allergens, ingredients, substitutes, restaurants, dishes, recalls } = require("./data");

const { COGNODB_URI, COGNODB_USER = "cognodb", COGNODB_PASSWORD } = process.env;

if (!COGNODB_URI || !COGNODB_PASSWORD) {
  console.error("Missing COGNODB_URI or COGNODB_PASSWORD. Copy .env.example to .env and fill it in first.");
  process.exit(1);
}

const driver = neo4j.driver(COGNODB_URI, neo4j.auth.basic(COGNODB_USER, COGNODB_PASSWORD));

async function run(session, cypher, params = {}) {
  return session.executeWrite((tx) => tx.run(cypher, params));
}

async function main() {
  const session = driver.session();
  try {
    console.log("Verifying connectivity...");
    await driver.verifyConnectivity();
    console.log("Connected. Applying constraints...");

    // Uniqueness constraints double as lookup indexes for every id we MATCH on.
    const constraints = [
      "CREATE CONSTRAINT farm_id IF NOT EXISTS FOR (f:Farm) REQUIRE f.id IS UNIQUE",
      "CREATE CONSTRAINT ingredient_id IF NOT EXISTS FOR (i:Ingredient) REQUIRE i.id IS UNIQUE",
      "CREATE CONSTRAINT allergen_id IF NOT EXISTS FOR (a:AllergenTag) REQUIRE a.id IS UNIQUE",
      "CREATE CONSTRAINT dish_id IF NOT EXISTS FOR (d:Dish) REQUIRE d.id IS UNIQUE",
      "CREATE CONSTRAINT restaurant_id IF NOT EXISTS FOR (r:Restaurant) REQUIRE r.id IS UNIQUE",
      "CREATE CONSTRAINT recall_id IF NOT EXISTS FOR (rc:RecallEvent) REQUIRE rc.id IS UNIQUE",
    ];
    for (const c of constraints) {
      await run(session, c);
    }

    console.log(`Loading ${farms.length} farms...`);
    await run(
      session,
      `UNWIND $rows AS row
       MERGE (f:Farm {id: row.id})
       SET f.name = row.name, f.region = row.region, f.certification = row.certification`,
      { rows: farms }
    );

    console.log(`Loading ${allergens.length} allergen tags...`);
    await run(
      session,
      `UNWIND $rows AS row
       MERGE (a:AllergenTag {id: row.id})
       SET a.name = row.name`,
      { rows: allergens }
    );

    console.log(`Loading ${ingredients.length} ingredients...`);
    await run(
      session,
      `UNWIND $rows AS row
       MERGE (i:Ingredient {id: row.id})
       SET i.name = row.name, i.category = row.category`,
      { rows: ingredients }
    );

    console.log("Linking ingredients to the farms that grow them...");
    for (const ing of ingredients) {
      if (!ing.grownBy?.length) continue;
      await run(
        session,
        `UNWIND $farmIds AS farmId
         MATCH (f:Farm {id: farmId}), (i:Ingredient {id: $ingredientId})
         MERGE (f)-[:GROWS]->(i)`,
        { farmIds: ing.grownBy, ingredientId: ing.id }
      );
    }

    console.log("Linking ingredients to allergen tags...");
    for (const ing of ingredients) {
      if (!ing.allergens?.length) continue;
      await run(
        session,
        `UNWIND $allergenIds AS allergenId
         MATCH (i:Ingredient {id: $ingredientId}), (a:AllergenTag {id: allergenId})
         MERGE (i)-[:CONTAINS]->(a)`,
        { allergenIds: ing.allergens, ingredientId: ing.id }
      );
    }

    console.log(`Linking ${substitutes.length} substitute relationships...`);
    await run(
      session,
      `UNWIND $rows AS row
       MATCH (a:Ingredient {id: row.from}), (b:Ingredient {id: row.to})
       MERGE (a)-[s:SUBSTITUTE_FOR]->(b)
       SET s.similarity = row.similarity`,
      { rows: substitutes }
    );

    console.log(`Loading ${restaurants.length} restaurants...`);
    await run(
      session,
      `UNWIND $rows AS row
       MERGE (r:Restaurant {id: row.id})
       SET r.name = row.name, r.city = row.city, r.cuisine = row.cuisine`,
      { rows: restaurants }
    );

    console.log(`Loading ${dishes.length} dishes...`);
    await run(
      session,
      `UNWIND $rows AS row
       MERGE (d:Dish {id: row.id})
       SET d.name = row.name, d.description = row.description, d.price = row.price`,
      { rows: dishes.map(({ id, name, description, price }) => ({ id, name, description, price })) }
    );

    console.log("Linking dishes to restaurants...");
    for (const dish of dishes) {
      await run(
        session,
        `UNWIND $restaurantIds AS restaurantId
         MATCH (r:Restaurant {id: restaurantId}), (d:Dish {id: $dishId})
         MERGE (r)-[:SERVES]->(d)`,
        { restaurantIds: dish.servedAt, dishId: dish.id }
      );
    }

    console.log("Linking dishes to required ingredients...");
    for (const dish of dishes) {
      await run(
        session,
        `UNWIND $rows AS row
         MATCH (d:Dish {id: $dishId}), (i:Ingredient {id: row.ingredient})
         MERGE (d)-[req:REQUIRES]->(i)
         SET req.quantity = row.quantity, req.unit = row.unit`,
        { dishId: dish.id, rows: dish.requires }
      );
    }

    console.log(`Loading ${recalls.length} recall events...`);
    await run(
      session,
      `UNWIND $rows AS row
       MERGE (rc:RecallEvent {id: row.id})
       SET rc.reason = row.reason, rc.date = row.date, rc.severity = row.severity
       WITH rc, row
       MATCH (f:Farm {id: row.farm})
       MERGE (rc)-[:ORIGINATES_AT]->(f)`,
      { rows: recalls }
    );

    const counts = await session.run(`
      MATCH (n) RETURN labels(n)[0] AS label, count(n) AS n ORDER BY label
    `);
    console.log("\nSeed complete. Node counts:");
    counts.records.forEach((r) => console.log(`  ${r.get("label")}: ${r.get("n")}`));
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
