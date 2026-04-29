/******************************** FlowStepper.tsx ***************************************
 *
 *  Module: FlowStepper Component
 *
 *  This module supports the upload and inventory review workflow.
 *
 *  The module provides:
 *
 *  - workflow-specific UI controls.
 *  - callbacks for upload or review state changes.
 *
 *  Key Structures Used:
 *
 *  - React props, selected files, category data, and action state.
 *
 *  This module ensures:
 *
 *  - volunteer and manager workflows use consistent controls.
 *  - review actions remain visible and predictable.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
import Badge from "../ui/Badge";

type FlowStepperProps = {
  steps: string[];
  currentStep: number;
  /** When set, shows a spinner on the current step badge to indicate activity */
  status?: "uploading" | "processing";
};

export default function FlowStepper({ steps, currentStep, status }: FlowStepperProps) {
  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
      {steps.map((step, index) => {
        const state = index < currentStep ? "done" : index === currentStep ? "current" : "upcoming";
        const showSpinner = state === "current" && status != null;
        return (
          <li key={step} className="flex items-center gap-2">
            <Badge
              tone={state === "done" || state === "current" ? "success" : "neutral"}
              className={state === "current" ? "ring-2 ring-emerald-200 dark:ring-emerald-800" : ""}
            >
              {showSpinner ? (
                <svg
                  className="animate-spin h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </Badge>
            <span
              className={`text-xs ${state === "current" ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}`}
            >
              {step}
            </span>
            {index < steps.length - 1 && (
              <span
                className={`ml-1 hidden h-px w-8 sm:block ${
                  index < currentStep ? "bg-emerald-400" : "bg-slate-300 dark:bg-slate-600"
                }`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
