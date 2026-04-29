export const INVENTORY_CATEGORIES = [
  "Beverages",
  "Juices",
  "Cereal",
  "Breakfast",
  "Meat",
  "Fish",
  "Poultry",
  "Frozen",
  "Vegetables",
  "Fruits",
  "Nuts",
  "Soup",
  "Grains",
  "Pasta",
  "Snacks",
  "Spices",
  "Sauces",
  "Condiments",
  "Misc Products",
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export const CATEGORY_GROUPS: Array<{ title: string; categories: InventoryCategory[] }> = [
  { title: "Drinks & Breakfast", categories: ["Beverages", "Juices", "Cereal", "Breakfast"] },
  { title: "Proteins", categories: ["Meat", "Fish", "Poultry", "Frozen"] },
  { title: "Produce & Soup", categories: ["Vegetables", "Fruits", "Nuts", "Soup"] },
  { title: "Dry Goods", categories: ["Grains", "Pasta", "Snacks"] },
  { title: "Flavor & Other", categories: ["Spices", "Sauces", "Condiments", "Misc Products"] },
];
