// data.js — seed dataset for FarmTrace.
// Small but realistic: enough nodes/relationships to demonstrate multi-hop
// traversal, recall blast-radius, and allergen substitution meaningfully,
// while staying well inside the CognoDB free-tier limits.

const farms = [
  { id: "farm-01", name: "Willow Creek Farm", region: "Sonoma County, CA", certification: "USDA Organic" },
  { id: "farm-02", name: "Blue Ridge Growers", region: "Asheville, NC", certification: "Certified Naturally Grown" },
  { id: "farm-03", name: "Prairie Fold Dairy", region: "Madison, WI", certification: "USDA Organic" },
  { id: "farm-04", name: "Gulfstream Shrimp Co.", region: "Biloxi, MS", certification: "BAP Certified" },
  { id: "farm-05", name: "Redwood Mushroom House", region: "Eugene, OR", certification: "None" },
  { id: "farm-06", name: "Sunfield Grain Mill", region: "Salina, KS", certification: "Non-GMO Verified" },
  { id: "farm-07", name: "Coastal Almond Grove", region: "Fresno, CA", certification: "USDA Organic" },
  { id: "farm-08", name: "Heritage Hen Farm", region: "Lancaster, PA", certification: "Certified Humane" },
];

const allergens = [
  { id: "allergen-peanut", name: "Peanuts" },
  { id: "allergen-treenut", name: "Tree Nuts" },
  { id: "allergen-dairy", name: "Dairy" },
  { id: "allergen-shellfish", name: "Shellfish" },
  { id: "allergen-gluten", name: "Gluten" },
  { id: "allergen-egg", name: "Egg" },
];

const ingredients = [
  { id: "ing-tomato", name: "Heirloom Tomato", category: "Produce", grownBy: ["farm-01"] },
  { id: "ing-basil", name: "Genovese Basil", category: "Produce", grownBy: ["farm-01"] },
  { id: "ing-kale", name: "Lacinato Kale", category: "Produce", grownBy: ["farm-02"] },
  { id: "ing-milk", name: "Whole Milk", category: "Dairy", grownBy: ["farm-03"], allergens: ["allergen-dairy"] },
  { id: "ing-cheddar", name: "Aged Cheddar", category: "Dairy", grownBy: ["farm-03"], allergens: ["allergen-dairy"] },
  { id: "ing-mozzarella", name: "Fresh Mozzarella", category: "Dairy", grownBy: ["farm-03"], allergens: ["allergen-dairy"] },
  { id: "ing-shrimp", name: "Gulf White Shrimp", category: "Seafood", grownBy: ["farm-04"], allergens: ["allergen-shellfish"] },
  { id: "ing-shiitake", name: "Shiitake Mushroom", category: "Produce", grownBy: ["farm-05"] },
  { id: "ing-oyster-mushroom", name: "Oyster Mushroom", category: "Produce", grownBy: ["farm-05"] },
  { id: "ing-wheat-flour", name: "Hard Red Wheat Flour", category: "Grain", grownBy: ["farm-06"], allergens: ["allergen-gluten"] },
  { id: "ing-cornmeal", name: "Stone-Ground Cornmeal", category: "Grain", grownBy: ["farm-06"] },
  { id: "ing-almond", name: "Marcona Almonds", category: "Nuts", grownBy: ["farm-07"], allergens: ["allergen-treenut"] },
  { id: "ing-almond-flour", name: "Almond Flour", category: "Nuts", grownBy: ["farm-07"], allergens: ["allergen-treenut"] },
  { id: "ing-egg", name: "Free-Range Eggs", category: "Poultry", grownBy: ["farm-08"], allergens: ["allergen-egg"] },
  { id: "ing-chicken", name: "Pasture-Raised Chicken", category: "Poultry", grownBy: ["farm-08"] },
  { id: "ing-peanut", name: "Roasted Peanuts", category: "Nuts", grownBy: [], allergens: ["allergen-peanut"] },
  { id: "ing-cashew", name: "Cashews", category: "Nuts", grownBy: [], allergens: ["allergen-treenut"] },
  { id: "ing-oat-flour", name: "Oat Flour", category: "Grain", grownBy: ["farm-06"] },
  { id: "ing-chickpea", name: "Chickpeas", category: "Legume", grownBy: ["farm-02"] },
  { id: "ing-coconut-milk", name: "Coconut Milk", category: "Dairy Alternative", grownBy: [] },
];

// SUBSTITUTE_FOR is an undirected-in-spirit "can stand in for" edge with a
// similarity score — used by the allergen-safe-substitute traversal.
const substitutes = [
  { from: "ing-peanut", to: "ing-cashew", similarity: 0.6 },
  { from: "ing-cashew", to: "ing-almond", similarity: 0.7 },
  { from: "ing-almond", to: "ing-coconut-milk", similarity: 0.3 },
  { from: "ing-wheat-flour", to: "ing-oat-flour", similarity: 0.65 },
  { from: "ing-oat-flour", to: "ing-almond-flour", similarity: 0.5 },
  { from: "ing-wheat-flour", to: "ing-cornmeal", similarity: 0.55 },
  { from: "ing-milk", to: "ing-coconut-milk", similarity: 0.5 },
  { from: "ing-shiitake", to: "ing-oyster-mushroom", similarity: 0.8 },
];

const restaurants = [
  { id: "rest-01", name: "Terra Bene", city: "San Francisco, CA", cuisine: "Farm-to-Table Italian" },
  { id: "rest-02", name: "The Gilded Fork", city: "Asheville, NC", cuisine: "Modern Southern" },
  { id: "rest-03", name: "Pier Nine Kitchen", city: "New Orleans, LA", cuisine: "Gulf Coast Seafood" },
  { id: "rest-04", name: "Field & Ferment", city: "Portland, OR", cuisine: "Pacific Northwest" },
  { id: "rest-05", name: "Golden Hen Bistro", city: "Philadelphia, PA", cuisine: "American Comfort" },
];

const dishes = [
  {
    id: "dish-margherita",
    name: "Heirloom Margherita Flatbread",
    description: "Wood-fired flatbread with heirloom tomato, fresh mozzarella and Genovese basil.",
    price: 18,
    servedAt: ["rest-01"],
    requires: [
      { ingredient: "ing-wheat-flour", quantity: 220, unit: "g" },
      { ingredient: "ing-tomato", quantity: 150, unit: "g" },
      { ingredient: "ing-mozzarella", quantity: 120, unit: "g" },
      { ingredient: "ing-basil", quantity: 10, unit: "g" },
    ],
  },
  {
    id: "dish-kale-caesar",
    name: "Lacinato Kale Caesar",
    description: "Charred kale, cured egg yolk dressing, aged cheddar crisp.",
    price: 14,
    servedAt: ["rest-01", "rest-02"],
    requires: [
      { ingredient: "ing-kale", quantity: 180, unit: "g" },
      { ingredient: "ing-egg", quantity: 1, unit: "each" },
      { ingredient: "ing-cheddar", quantity: 40, unit: "g" },
    ],
  },
  {
    id: "dish-shrimp-grits",
    name: "Gulf Shrimp & Stone-Ground Grits",
    description: "Gulf white shrimp over cornmeal grits with a cheddar finish.",
    price: 26,
    servedAt: ["rest-02", "rest-03"],
    requires: [
      { ingredient: "ing-shrimp", quantity: 200, unit: "g" },
      { ingredient: "ing-cornmeal", quantity: 150, unit: "g" },
      { ingredient: "ing-cheddar", quantity: 30, unit: "g" },
      { ingredient: "ing-milk", quantity: 100, unit: "ml" },
    ],
  },
  {
    id: "dish-shiitake-toast",
    name: "Shiitake & Oyster Mushroom Toast",
    description: "Wild mushrooms over sourdough with whipped ricotta.",
    price: 16,
    servedAt: ["rest-04"],
    requires: [
      { ingredient: "ing-shiitake", quantity: 90, unit: "g" },
      { ingredient: "ing-oyster-mushroom", quantity: 60, unit: "g" },
      { ingredient: "ing-wheat-flour", quantity: 100, unit: "g" },
      { ingredient: "ing-milk", quantity: 50, unit: "ml" },
    ],
  },
  {
    id: "dish-almond-cake",
    name: "Marcona Almond Cake",
    description: "Flourless almond cake with almond flour and coconut milk cream.",
    price: 11,
    servedAt: ["rest-01", "rest-04"],
    requires: [
      { ingredient: "ing-almond", quantity: 120, unit: "g" },
      { ingredient: "ing-almond-flour", quantity: 100, unit: "g" },
      { ingredient: "ing-egg", quantity: 3, unit: "each" },
      { ingredient: "ing-coconut-milk", quantity: 60, unit: "ml" },
    ],
  },
  {
    id: "dish-pad-thai",
    name: "Peanut & Chickpea Pad Thai",
    description: "Rice noodles, roasted peanuts, chickpeas, coconut milk sauce.",
    price: 17,
    servedAt: ["rest-04"],
    requires: [
      { ingredient: "ing-peanut", quantity: 40, unit: "g" },
      { ingredient: "ing-chickpea", quantity: 100, unit: "g" },
      { ingredient: "ing-coconut-milk", quantity: 80, unit: "ml" },
    ],
  },
  {
    id: "dish-chicken-pot-pie",
    name: "Heritage Chicken Pot Pie",
    description: "Pasture-raised chicken, root vegetables, flaky wheat crust.",
    price: 22,
    servedAt: ["rest-05"],
    requires: [
      { ingredient: "ing-chicken", quantity: 200, unit: "g" },
      { ingredient: "ing-wheat-flour", quantity: 150, unit: "g" },
      { ingredient: "ing-milk", quantity: 120, unit: "ml" },
      { ingredient: "ing-egg", quantity: 1, unit: "each" },
    ],
  },
  {
    id: "dish-cobb-salad",
    name: "Golden Hen Cobb Salad",
    description: "Chicken, egg, cheddar and kale with a cashew-buttermilk dressing.",
    price: 19,
    servedAt: ["rest-05"],
    requires: [
      { ingredient: "ing-chicken", quantity: 150, unit: "g" },
      { ingredient: "ing-egg", quantity: 1, unit: "each" },
      { ingredient: "ing-cheddar", quantity: 30, unit: "g" },
      { ingredient: "ing-kale", quantity: 80, unit: "g" },
      { ingredient: "ing-cashew", quantity: 20, unit: "g" },
    ],
  },
  {
    id: "dish-shrimp-po-boy",
    name: "Cornmeal-Crusted Shrimp Po'Boy",
    description: "Gulf shrimp dredged in cornmeal and wheat flour, fried and served on a roll.",
    price: 20,
    servedAt: ["rest-03"],
    requires: [
      { ingredient: "ing-shrimp", quantity: 180, unit: "g" },
      { ingredient: "ing-cornmeal", quantity: 60, unit: "g" },
      { ingredient: "ing-wheat-flour", quantity: 60, unit: "g" },
      { ingredient: "ing-egg", quantity: 1, unit: "each" },
    ],
  },
  {
    id: "dish-mushroom-risotto",
    name: "Wild Mushroom Risotto",
    description: "Shiitake and oyster mushrooms, aged cheddar, finished with milk.",
    price: 21,
    servedAt: ["rest-02", "rest-04"],
    requires: [
      { ingredient: "ing-shiitake", quantity: 70, unit: "g" },
      { ingredient: "ing-oyster-mushroom", quantity: 50, unit: "g" },
      { ingredient: "ing-cheddar", quantity: 40, unit: "g" },
      { ingredient: "ing-milk", quantity: 80, unit: "ml" },
    ],
  },
];

// Recall events — the driver of the flagship multi-hop query.
const recalls = [
  {
    id: "recall-01",
    reason: "Possible Listeria contamination in dairy processing line",
    date: "2026-07-14",
    severity: "High",
    farm: "farm-03", // Prairie Fold Dairy
  },
  {
    id: "recall-02",
    reason: "Elevated cadmium levels detected in mushroom substrate soil",
    date: "2026-08-02",
    severity: "Medium",
    farm: "farm-05", // Redwood Mushroom House
  },
];

module.exports = { farms, allergens, ingredients, substitutes, restaurants, dishes, recalls };
