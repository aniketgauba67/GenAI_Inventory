import Badge from "../ui/Badge";

type FlowStepperProps = {
  steps: string[];
  currentStep: number;
};

export default function FlowStepper({ steps, currentStep }: FlowStepperProps) {
  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
      {steps.map((step, index) => {
        const state = index < currentStep ? "done" : index === currentStep ? "current" : "upcoming";
        return (
          <li key={step} className="flex items-center gap-2">
            <Badge
              tone={state === "done" || state === "current" ? "success" : "neutral"}
              className={state === "current" ? "ring-2 ring-emerald-200 dark:ring-emerald-800" : ""}
            >
              {index + 1}
            </Badge>
            <span className={`text-xs ${state === "current" ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}`}>
              {step}
            </span>
            {index < steps.length - 1 && (
              <span
                className={`ml-1 hidden h-px w-8 sm:block ${
                  index < currentStep ? "bg-emerald-400" : "bg-slate-300 dark:bg-slate-600"
                }`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
