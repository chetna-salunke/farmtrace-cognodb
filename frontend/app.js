// app.js — FarmTrace frontend. Plain JS, no build step: fetches JSON from
// the Express API (same origin) and renders it into the panels defined in
// index.html.

const API = "/api";
const ALLERGENS = ["Peanuts", "Tree Nuts", "Dairy", "Shellfish", "Gluten", "Egg"];

// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

let toastTimer = null;
function showToast(message) {
  const t = $("#toast");
  t.textContent = message;
  t.classList.add("is-visible");
  t.setAttribute("aria-hidden", "false");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("is-visible");
    t.setAttribute("aria-hidden", "true");
  }, 4500);
}

async function api(path) {
  let res;
  try {
    res = await fetch(`${API}${path}`);
  } catch (networkErr) {
    throw new Error("Can't reach the FarmTrace server. Is the backend running?");
  }
  if (res.status === 503) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Database unavailable.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------

function initTabs() {
  $all(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $all(".tab").forEach((t) => { t.classList.remove("is-active"); t.setAttribute("aria-selected", "false"); });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      $all(".panel").forEach((p) => p.classList.remove("is-active"));
      $(`#panel-${tab.dataset.tab}`).classList.add("is-active");
    });
  });
}

// ---------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------

async function pollHealth() {
  const badge = $("#db-status");
  try {
    const { status } = await api("/health");
    if (status === "ok") {
      badge.textContent = "● CognoDB connected";
      badge.dataset.state = "ok";
    } else {
      badge.textContent = "● CognoDB unreachable";
      badge.dataset.state = "down";
    }
  } catch {
    badge.textContent = "● Server unreachable";
    badge.dataset.state = "down";
  }
}

// ---------------------------------------------------------------------
// Dishes
// ---------------------------------------------------------------------

let allDishes = [];
let selectedDishId = null;

async function loadDishes() {
  const list = $("#dish-list");
  try {
    allDishes = await api("/dishes");
    renderDishList(allDishes);
  } catch (err) {
    list.innerHTML = "";
    list.appendChild(el("li", { class: "list-error" }, `Couldn't load dishes: ${err.message}`));
  }
}

function renderDishList(dishes) {
  const list = $("#dish-list");
  list.innerHTML = "";
  if (!dishes.length) {
    list.appendChild(el("li", { class: "list-empty" }, "No dishes match that search."));
    return;
  }
  dishes.forEach((d) => {
    const btn = el("button", {
      class: "entity-row" + (d.id === selectedDishId ? " is-selected" : ""),
      onclick: () => selectDish(d.id),
    }, [
      el("span", { class: "name" }, d.name),
      el("span", { class: "meta" }, `$${d.price}`),
    ]);
    list.appendChild(el("li", {}, btn));
  });
}

$("#dish-search").addEventListener("input", (e) => {
  const term = e.target.value.trim().toLowerCase();
  const filtered = term ? allDishes.filter((d) => d.name.toLowerCase().includes(term)) : allDishes;
  renderDishList(filtered);
});

async function selectDish(id) {
  selectedDishId = id;
  renderDishList($("#dish-search").value.trim()
    ? allDishes.filter((d) => d.name.toLowerCase().includes($("#dish-search").value.trim().toLowerCase()))
    : allDishes);

  const detail = $("#dish-detail");
  detail.innerHTML = "";
  detail.appendChild(el("div", { class: "empty-state" }, [
    el("div", { class: "empty-glyph" }, "…"),
    el("h3", {}, "Tracing dish…"),
    el("p", {}, "Walking Farm → Ingredient → Dish → Restaurant."),
  ]));

  try {
    const data = await api(`/dishes/${id}/trace`);
    renderDishDetail(data);
  } catch (err) {
    detail.innerHTML = "";
    detail.appendChild(el("div", { class: "empty-state" }, [
      el("div", { class: "empty-glyph" }, "⚠"),
      el("h3", {}, "Couldn't load this dish"),
      el("p", {}, err.message),
    ]));
  }
}

function renderDishDetail(data) {
  const { dish, restaurant, ingredients } = data;
  const detail = $("#dish-detail");
  detail.innerHTML = "";

  detail.appendChild(el("div", { class: "detail-head" }, [
    el("h2", {}, dish.name),
    el("span", { class: "detail-price" }, `$${dish.price}`),
  ]));
  detail.appendChild(el("p", { class: "detail-desc" }, dish.description));
  detail.appendChild(el("p", { class: "detail-sub" }, `Served at ${restaurant?.name ?? "—"}${restaurant?.city ? ", " + restaurant.city : ""}`));

  detail.appendChild(el("h3", { class: "section-title" }, "Farm-to-plate trace"));
  detail.appendChild(buildTraceSvg(dish, restaurant, ingredients));

  detail.appendChild(el("h3", { class: "section-title" }, "Ingredients"));
  const table = el("table", { class: "ing-table" }, [
    el("thead", {}, el("tr", {}, [
      el("th", {}, "Ingredient"), el("th", {}, "Qty"), el("th", {}, "Farm"), el("th", {}, "Allergens"),
    ])),
  ]);
  const tbody = el("tbody");
  ingredients.filter((i) => i.ingredient).forEach((i) => {
    tbody.appendChild(el("tr", {}, [
      el("td", {}, i.ingredient.name),
      el("td", { class: "qty" }, `${i.quantity ?? ""} ${i.unit ?? ""}`.trim()),
      el("td", { class: "farm-tag" }, i.farms?.map((f) => f.name).join(", ") || "—"),
      el("td", {}, i.allergens?.length ? i.allergens.join(", ") : "—"),
    ]));
  });
  table.appendChild(tbody);
  detail.appendChild(table);

  detail.appendChild(el("h3", { class: "section-title" }, "Allergen-safe substitute finder"));
  detail.appendChild(buildAllergenFinder(dish.id));
}

function buildTraceSvg(dish, restaurant, ingredients) {
  const rows = ingredients.filter((i) => i.ingredient);
  const rowH = 46;
  const height = Math.max(rowH * rows.length + 60, 160);
  const width = 620;
  const colX = { farm: 70, ingredient: 260, dish: 450, restaurant: 580 };

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", height);
  svg.classList.add("trace-svg");

  const ns = "http://www.w3.org/2000/svg";
  const make = (tag, attrs) => {
    const n = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  };

  ["farm", "ingredient"].forEach((key) => {
    const label = make("text", { class: "trace-col-label", x: colX[key], y: 16, "text-anchor": "middle" });
    label.textContent = key === "farm" ? "Farm" : "Ingredient";
    svg.appendChild(label);
  });
  svg.appendChild(Object.assign(make("text", { class: "trace-col-label", x: colX.dish, y: 16, "text-anchor": "middle" }), { textContent: "Dish" }));
  svg.appendChild(Object.assign(make("text", { class: "trace-col-label", x: colX.restaurant, y: 16, "text-anchor": "middle" }), { textContent: "Restaurant" }));

  const dishY = height / 2;
  const restY = height / 2;

  rows.forEach((row, idx) => {
    const y = 40 + idx * rowH + rowH / 2;
    const hasAllergen = row.allergens?.length > 0;

    // Farm(s) -> ingredient. If multiple farms, fan them in.
    (row.farms?.length ? row.farms : [{ name: "Unlisted source" }]).forEach((farm, fi) => {
      const fy = row.farms?.length > 1 ? y - 8 + fi * 16 : y;
      const path = make("path", {
        class: "trace-path",
        d: `M ${colX.farm + 34} ${fy} C ${(colX.farm + colX.ingredient) / 2} ${fy}, ${(colX.farm + colX.ingredient) / 2} ${y}, ${colX.ingredient - 34} ${y}`,
      });
      svg.appendChild(path);
      const node = make("g", { class: "trace-node farm" });
      node.appendChild(make("circle", { cx: colX.farm, cy: fy, r: 5 }));
      const t = make("text", { class: "trace-node-label", x: colX.farm, y: fy - 10, "text-anchor": "middle" });
      t.textContent = farm.name.length > 20 ? farm.name.slice(0, 18) + "…" : farm.name;
      svg.appendChild(node); svg.appendChild(t);
    });

    // Ingredient node
    const ingNode = make("g", { class: "trace-node ingredient" });
    ingNode.appendChild(make("circle", { cx: colX.ingredient, cy: y, r: 5 }));
    svg.appendChild(ingNode);
    const ingLabel = make("text", { class: "trace-node-label", x: colX.ingredient, y: y - 10, "text-anchor": "middle" });
    ingLabel.textContent = row.ingredient.name;
    svg.appendChild(ingLabel);
    if (hasAllergen) {
      const sub = make("text", { class: "trace-node-sub", x: colX.ingredient, y: y + 16, "text-anchor": "middle" });
      sub.textContent = row.allergens.join(", ");
      sub.setAttribute("fill", "var(--alert)");
      svg.appendChild(sub);
    }

    // Ingredient -> dish
    svg.appendChild(make("path", {
      class: "trace-path" + (hasAllergen ? " allergen" : ""),
      d: `M ${colX.ingredient + 34} ${y} C ${(colX.ingredient + colX.dish) / 2} ${y}, ${(colX.ingredient + colX.dish) / 2} ${dishY}, ${colX.dish - 20} ${dishY}`,
    }));
  });

  // Dish node
  const dishNode = make("g", { class: "trace-node dish" });
  dishNode.appendChild(make("circle", { cx: colX.dish, cy: dishY, r: 7 }));
  svg.appendChild(dishNode);
  const dishLabel = make("text", { class: "trace-node-label", x: colX.dish, y: dishY - 14, "text-anchor": "middle" });
  dishLabel.textContent = dish.name.length > 22 ? dish.name.slice(0, 20) + "…" : dish.name;
  svg.appendChild(dishLabel);

  // Dish -> restaurant
  svg.appendChild(make("path", {
    class: "trace-path",
    d: `M ${colX.dish + 20} ${dishY} C ${(colX.dish + colX.restaurant) / 2} ${dishY}, ${(colX.dish + colX.restaurant) / 2} ${restY}, ${colX.restaurant - 20} ${restY}`,
  }));

  const restNode = make("g", { class: "trace-node restaurant" });
  restNode.appendChild(make("circle", { cx: colX.restaurant, cy: restY, r: 7 }));
  svg.appendChild(restNode);
  const restLabel = make("text", { class: "trace-node-label", x: colX.restaurant, y: restY - 14, "text-anchor": "middle" });
  restLabel.textContent = restaurant?.name ?? "—";
  svg.appendChild(restLabel);

  return el("div", { class: "trace-wrap" }, svg);
}

function buildAllergenFinder(dishId) {
  const wrap = el("div", {});
  const select = el("select", { "aria-label": "Choose an allergen" },
    ALLERGENS.map((a) => el("option", { value: a }, a)));
  const button = el("button", {}, "Find safe substitutes");
  const resultsBox = el("div", { class: "sub-results", style: "margin-top:14px;" });

  button.addEventListener("click", async () => {
    resultsBox.innerHTML = "";
    resultsBox.appendChild(el("p", { style: "color:var(--text-lo);font-size:13px;" }, "Searching…"));
    try {
      const rows = await api(`/dishes/${dishId}/allergen-substitutes?allergen=${encodeURIComponent(select.value)}`);
      resultsBox.innerHTML = "";
      if (!rows.length) {
        resultsBox.appendChild(el("p", { class: "sub-result" }, `This dish has no ingredients flagged for ${select.value}.`));
        return;
      }
      rows.forEach((r) => {
        const safe = (r.suggestedSubstitutes || []).filter(Boolean);
        resultsBox.appendChild(el("div", { class: "sub-result" }, [
          el("span", { class: "flagged" }, r.flaggedIngredient?.name ?? "Unknown"),
          el("span", { class: "arrow" }, "→"),
          safe.length
            ? el("div", { class: "safe-list" }, safe.map((s) => el("span", { class: "safe-chip" }, s.name)))
            : el("div", { class: "no-safe" }, "No substitute found within 3 hops."),
        ]));
      });
    } catch (err) {
      resultsBox.innerHTML = "";
      resultsBox.appendChild(el("p", { class: "list-error" }, err.message));
    }
  });

  wrap.appendChild(el("div", { class: "allergen-form" }, [select, button]));
  wrap.appendChild(resultsBox);
  return wrap;
}

// ---------------------------------------------------------------------
// Recalls
// ---------------------------------------------------------------------

async function loadRecalls() {
  const list = $("#recall-list");
  try {
    const rows = await api("/recalls");
    list.innerHTML = "";
    if (!rows.length) {
      list.appendChild(el("li", { class: "list-empty" }, "No recall events recorded."));
      return;
    }
    rows.forEach(({ recall, farm }) => {
      const btn = el("button", { class: "entity-row", onclick: () => selectRecall(recall.id) }, [
        el("span", { class: "name" }, farm?.name ?? "Unknown farm"),
        el("span", { class: "meta" }, recall.date),
        el("span", { class: "sev-badge", "data-sev": recall.severity }, recall.severity),
      ]);
      list.appendChild(el("li", {}, btn));
    });
  } catch (err) {
    list.innerHTML = "";
    list.appendChild(el("li", { class: "list-error" }, `Couldn't load recalls: ${err.message}`));
  }
}

async function selectRecall(id) {
  $all("#recall-list .entity-row").forEach((r) => r.classList.remove("is-selected"));

  const detail = $("#recall-detail");
  detail.innerHTML = "";
  detail.appendChild(el("div", { class: "empty-state" }, [
    el("div", { class: "empty-glyph" }, "…"),
    el("h3", {}, "Calculating blast radius…"),
  ]));

  try {
    const data = await api(`/recalls/${id}/impact`);
    renderRecallDetail(data);
  } catch (err) {
    detail.innerHTML = "";
    detail.appendChild(el("div", { class: "empty-state" }, [
      el("div", { class: "empty-glyph" }, "⚠"),
      el("h3", {}, "Couldn't load this recall"),
      el("p", {}, err.message),
    ]));
  }
}

function renderRecallDetail({ recall, farm, dishesAffected, restaurantsAffected, rows }) {
  const detail = $("#recall-detail");
  detail.innerHTML = "";

  detail.appendChild(el("div", { class: "detail-head" }, [
    el("h2", {}, farm?.name ?? "Unknown farm"),
    el("span", { class: "sev-badge", "data-sev": recall.severity }, recall.severity),
  ]));
  detail.appendChild(el("p", { class: "detail-desc" }, `${recall.reason} — reported ${recall.date}`));

  detail.appendChild(el("div", { class: "recall-stats" }, [
    el("div", { class: "stat-card is-alert" }, [el("div", { class: "num" }, String(dishesAffected)), el("div", { class: "label" }, "Dishes affected")]),
    el("div", { class: "stat-card is-alert" }, [el("div", { class: "num" }, String(restaurantsAffected)), el("div", { class: "label" }, "Restaurants affected")]),
    el("div", { class: "stat-card" }, [el("div", { class: "num" }, String(rows.length)), el("div", { class: "label" }, "Trace rows (4-hop)")]),
  ]));

  detail.appendChild(el("h3", { class: "section-title" }, "Affected menu items"));

  if (!rows.length) {
    detail.appendChild(el("p", { style: "color:var(--text-lo);font-size:13.5px;" }, "No downstream dishes use ingredients from this farm — no menu impact detected."));
    return;
  }

  const table = el("table", { class: "impact-table" }, [
    el("thead", {}, el("tr", {}, [
      el("th", {}, "Ingredient"), el("th", {}, "Dish"), el("th", {}, "Restaurant"), el("th", {}, "City"),
    ])),
  ]);
  const tbody = el("tbody");
  rows.forEach((r) => {
    tbody.appendChild(el("tr", {}, [
      el("td", {}, r.ingredient?.name ?? "—"),
      el("td", {}, r.dish?.name ?? "—"),
      el("td", {}, r.restaurant?.name ?? "—"),
      el("td", {}, r.restaurant?.city ?? "—"),
    ]));
  });
  table.appendChild(tbody);
  detail.appendChild(table);

  showToast(`${recall.severity} severity recall reaches ${restaurantsAffected} restaurant${restaurantsAffected === 1 ? "" : "s"}.`);
}

// ---------------------------------------------------------------------
// Restaurants
// ---------------------------------------------------------------------

async function loadRestaurants() {
  const list = $("#restaurant-list");
  try {
    const rows = await api("/restaurants");
    list.innerHTML = "";
    if (!rows.length) {
      list.appendChild(el("li", { class: "list-empty" }, "No restaurants found."));
      return;
    }
    rows.forEach((r) => {
      const btn = el("button", { class: "entity-row", onclick: () => selectRestaurant(r.id) }, [
        el("span", { class: "name" }, r.name),
        el("span", { class: "meta" }, `${r.city} · ${r.cuisine}`),
      ]);
      list.appendChild(el("li", {}, btn));
    });
  } catch (err) {
    list.innerHTML = "";
    list.appendChild(el("li", { class: "list-error" }, `Couldn't load restaurants: ${err.message}`));
  }
}

async function selectRestaurant(id) {
  $all("#restaurant-list .entity-row").forEach((r) => r.classList.remove("is-selected"));
  const detail = $("#restaurant-detail");
  detail.innerHTML = "";
  detail.appendChild(el("div", { class: "empty-state" }, [
    el("div", { class: "empty-glyph" }, "…"),
    el("h3", {}, "Checking shared supply risk…"),
  ]));

  try {
    const rows = await api(`/restaurants/${id}/shared-risk`);
    detail.innerHTML = "";
    detail.appendChild(el("h3", { class: "section-title" }, "Restaurants sharing at least one farm"));
    if (!rows.length) {
      detail.appendChild(el("p", { style: "color:var(--text-lo);font-size:13.5px;" }, "No other restaurant in the graph shares a farm with this one."));
      return;
    }
    rows.forEach((r) => {
      detail.appendChild(el("div", { class: "risk-row" }, [
        el("div", {}, [
          el("div", { class: "rname" }, r.restaurant.name),
          el("div", { class: "rcity" }, r.restaurant.city),
        ]),
        el("div", { class: "risk-count" }, `${r.sharedFarms.length} shared farm${r.sharedFarms.length === 1 ? "" : "s"}: ${r.sharedFarms.map((f) => f.name).join(", ")}`),
      ]));
    });
  } catch (err) {
    detail.innerHTML = "";
    detail.appendChild(el("div", { class: "empty-state" }, [
      el("div", { class: "empty-glyph" }, "⚠"),
      el("h3", {}, "Couldn't load shared risk"),
      el("p", {}, err.message),
    ]));
  }
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

initTabs();
pollHealth();
setInterval(pollHealth, 15000);
loadDishes();
loadRecalls();
loadRestaurants();
