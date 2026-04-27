export const CATEGORY_GROUPS: Array<{ title: string; categories: string[] }> = [
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
        <section key={group.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {group.title}
          </h3>
          <ul className="space-y-3">
            {group.categories.map((category) => {
              const count = values[category] ?? 0;
              const inputId = `${inputPrefix}-${category}`;
              return (
                <li key={category} className="flex items-center justify-between gap-4">
                  <label
                    htmlFor={inputId}
                    className="text-base font-medium text-slate-700 dark:text-slate-200"
                  >
                    {category}
                  </label>
                  <div
                    role="group"
                    aria-label={`${category} quantity controls`}
                    className="flex items-center rounded-xl border border-slate-300/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-800"
                  >
                    <button
                      type="button"
                      aria-label={`Decrease ${category}`}
                      onClick={() => onChange(category, String(Math.max(0, count - 1)))}
                      className="flex h-11 w-11 items-center justify-center rounded-l-xl text-xl font-semibold text-slate-600 transition active:scale-90 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
                      disabled={count <= 0}
                    >
                      −
                    </button>
                    <input
                      id={inputId}
                      type="number"
                      min="0"
                      value={count}
                      onChange={(e) => onChange(category, e.target.value)}
                      className="h-11 w-16 border-x border-slate-200 bg-transparent text-center text-base font-semibold tabular-nums text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      aria-label={`Increase ${category}`}
                      onClick={() => onChange(category, String(count + 1))}
                      className="flex h-11 w-11 items-center justify-center rounded-r-xl text-xl font-semibold text-slate-600 transition active:scale-90 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
