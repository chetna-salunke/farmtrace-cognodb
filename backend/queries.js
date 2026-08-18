// queries.js — every Cypher statement the app runs, in one place, so they're
// easy to review and defend. All queries are parameterised ($param); nothing
// is ever string-concatenated into the Cypher text.

module.exports = {
  // ---------------------------------------------------------------------
  // Simple lookups (single hop or none) — the app's "browse" surface.
  // ---------------------------------------------------------------------

  listFarms: `
    MATCH (f:Farm)
    OPTIONAL MATCH (f)-[:GROWS]->(i:Ingredient)
    WITH f, count(i) AS ingredientCount
    RETURN f { .*, ingredientCount: ingredientCount } AS farm
    ORDER BY f.name
  `,

  listRestaurants: `
    MATCH (r:Restaurant)
    OPTIONAL MATCH (r)-[:SERVES]->(d:Dish)
    WITH r, count(d) AS dishCount
    RETURN r { .*, dishCount: dishCount } AS restaurant
    ORDER BY r.name
  `,

  listDishes: `
    MATCH (d:Dish)
    RETURN d { .* } AS d
    ORDER BY d.name
  `,

  // ---------------------------------------------------------------------
  // 1) MULTI-HOP TRAVERSAL (4 hops): recall blast-radius.
  //
  // Starting from a RecallEvent, walk RecallEvent -> Farm -> Ingredient ->
  // Dish -> Restaurant to find every menu item and restaurant touched by a
  // single recall. This is the app's core "why a graph" query: the number
  // of hops is fixed by the domain, not by how the schema happens to be
  // normalised, and it reads as one shape instead of four joined tables.
  // ---------------------------------------------------------------------
  recallImpact: `
    MATCH (rc:RecallEvent {id: $recallId})-[:ORIGINATES_AT]->(f:Farm)
          -[:GROWS]->(i:Ingredient)<-[:REQUIRES]-(d:Dish)
          <-[:SERVES]-(r:Restaurant)
    RETURN DISTINCT
      f { .id, .name } AS farm,
      i { .id, .name } AS ingredient,
      d { .id, .name } AS dish,
      r { .id, .name, .city } AS restaurant
    ORDER BY r.name, d.name
  `,

  recallSummary: `
    MATCH (rc:RecallEvent {id: $recallId})-[:ORIGINATES_AT]->(f:Farm)
    OPTIONAL MATCH (f)-[:GROWS]->(i:Ingredient)<-[:REQUIRES]-(d:Dish)<-[:SERVES]-(r:Restaurant)
    WITH rc, f, count(DISTINCT d) AS dishesAffected, count(DISTINCT r) AS restaurantsAffected
    RETURN rc { .* } AS recall,
           f { .id, .name } AS farm,
           dishesAffected,
           restaurantsAffected
  `,

  listRecalls: `
    MATCH (rc:RecallEvent)-[:ORIGINATES_AT]->(f:Farm)
    RETURN rc { .* } AS recall, f { .id, .name } AS farm
    ORDER BY rc.date DESC
  `,

  // ---------------------------------------------------------------------
  // 2) VARIABLE-LENGTH PATH — a query a relational database finds awkward.
  //
  // Find allergen-safe substitute ingredients for a dish: walk from each
  // flagged ingredient across 1-3 SUBSTITUTE_FOR hops until we land on an
  // ingredient that does NOT carry the allergen. In SQL this needs a
  // recursive CTE per allergen per ingredient; here it's one bounded
  // variable-length relationship.
  // ---------------------------------------------------------------------
  allergenSafeSubstitutes: `
    MATCH (d:Dish {id: $dishId})-[:REQUIRES]->(bad:Ingredient)-[:CONTAINS]->(a:AllergenTag {name: $allergen})
    OPTIONAL MATCH path = (bad)-[:SUBSTITUTE_FOR*1..3]-(safe:Ingredient)
      WHERE NOT (safe)-[:CONTAINS]->(:AllergenTag {name: $allergen})
    RETURN bad { .id, .name } AS flaggedIngredient,
           collect(DISTINCT safe { .id, .name })[0..5] AS suggestedSubstitutes
  `,

  // ---------------------------------------------------------------------
  // 3) Cross-restaurant exposure for a single ingredient — fan-out query
  // used by the "trace an ingredient" search box.
  // ---------------------------------------------------------------------
  ingredientExposure: `
    MATCH (i:Ingredient {id: $ingredientId})<-[:REQUIRES]-(d:Dish)<-[:SERVES]-(r:Restaurant)
    OPTIONAL MATCH (i)<-[:GROWS]-(f:Farm)
    RETURN i { .id, .name } AS ingredient,
           collect(DISTINCT f { .id, .name }) AS farms,
           collect(DISTINCT { dish: d { .id, .name }, restaurant: r { .id, .name, .city } }) AS uses
  `,

  // ---------------------------------------------------------------------
  // 4) Full farm-to-plate trace for one dish — powers the "trace path"
  // visual in the UI (Farm -> Ingredient -> Dish -> Restaurant).
  // ---------------------------------------------------------------------
  dishTrace: `
    MATCH (r:Restaurant)-[:SERVES]->(d:Dish {id: $dishId})
    OPTIONAL MATCH (d)-[req:REQUIRES]->(i:Ingredient)
    OPTIONAL MATCH (f:Farm)-[:GROWS]->(i)
    OPTIONAL MATCH (i)-[:CONTAINS]->(a:AllergenTag)
    RETURN d { .* } AS dish,
           r { .id, .name, .city } AS restaurant,
           collect(DISTINCT {
             ingredient: i { .id, .name },
             quantity: req.quantity,
             unit: req.unit,
             farms: [(f)-[:GROWS]->(i) | f { .id, .name, .region }],
             allergens: [(i)-[:CONTAINS]->(a) | a.name]
           }) AS ingredients
  `,

  // ---------------------------------------------------------------------
  // 5) Shared supply-chain risk between restaurants — a 6-hop self-join
  // relational SQL would struggle to express cleanly, but reads naturally
  // as a symmetric graph pattern: two different restaurants whose dishes
  // both draw on the same farm.
  // ---------------------------------------------------------------------
  sharedSupplyRisk: `
    MATCH (r1:Restaurant {id: $restaurantId})-[:SERVES]->(:Dish)-[:REQUIRES]->(:Ingredient)<-[:GROWS]-(f:Farm)
    MATCH (f)-[:GROWS]->(:Ingredient)<-[:REQUIRES]-(:Dish)<-[:SERVES]-(r2:Restaurant)
    WHERE r2.id <> $restaurantId
    RETURN r2 { .id, .name, .city } AS restaurant,
           collect(DISTINCT f { .id, .name }) AS sharedFarms
    ORDER BY size(sharedFarms) DESC
  `,

  // ---------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------
  searchDishes: `
    MATCH (d:Dish)
    WHERE toLower(d.name) CONTAINS toLower($term)
    RETURN d { .* } AS d
    ORDER BY d.name
    LIMIT 10
  `,

  searchIngredients: `
    MATCH (i:Ingredient)
    WHERE toLower(i.name) CONTAINS toLower($term)
    RETURN i { .* } AS i
    ORDER BY i.name
    LIMIT 10
  `,
};