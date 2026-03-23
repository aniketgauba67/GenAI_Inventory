import Input from "../ui/Input";

const CATEGORY_GROUPS: Array<{ title: string; categories: string[] }> = [
  { title: "Drinks & Breakfast", categories: ["Beverages", "Juices", "Cereal", "Breakfast"] },
  { title: "Proteins", categories: ["Meat", "Fish", "Poultry", "Frozen"] },
  { title: "Produce & Soup", categories: ["Vegetables", "Fruits", "Nuts", "Soup"] },
  { title: "Dry Goods", categories: ["Grains", "Pasta", "Snacks"] },
  { title: "Flavor & Other", categories: ["Spices", "Sauces", "Condiments", "Misc Products"] },
];

type CategoryGroupEditorProps = {
  values: Record<string, number>;
  onChange: (category: string, value: string) => void;
  inputPrefix?: string;
};

export default function CategoryGroupEditor({ values, onChange, inputPrefix = "cat" }: CategoryGroupEditorProps) {
  return (
    <div className="space-y-4">
      {CATEGORY_GROUPS.map((group) => (
        <section key={group.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{group.title}</h3>
          <ul className="mt-3 space-y-2">
            {group.categories.map((category) => (
              <li key={category} className="flex items-center justify-between gap-3">
                <label htmlFor={`${inputPrefix}-${category}`} className="text-sm text-slate-700 dark:text-slate-200">
                  {category}
                </label>
                <Input
                  id={`${inputPrefix}-${category}`}
                  type="number"
                  min={0}
                  value={Number(values[category] ?? 0)}
                  onChange={(e) => onChange(category, e.target.value)}
                  className="w-28"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
