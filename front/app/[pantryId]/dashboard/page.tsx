/******************************** page.tsx ***************************************
 *
 *  Module: Frontend App Route
 *
 *  This module renders a Next.js route for the GenAI Inventory user
 *  interface.
 *
 *  The module provides:
 *
 *  - route-level layout or page rendering.
 *  - connections to shared frontend components and helpers.
 *
 *  Key Structures Used:
 *
 *  - Next.js App Router files, React components, and route params.
 *
 *  This module ensures:
 *
 *  - the screen follows the shared application workflow.
 *  - route code remains close to its user-facing page.
 *
 *  Editors: Aniket, Dipanker, Liam, Jin, and Philip.
 *
 *****************************************************************************/
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

type DashboardPageProps = {
	params: Promise<{ pantryId: string }>;
};

const dashboardLinks = [
	{ label: "Home", href: "/", description: "Back to role selector" },
	{
		label: "Volunteer Upload",
		href: "/director/upload",
		description: "Run shelf photo detection for a selected pantry",
	},
	{
		label: "Form Upload",
		href: "/manager",
		description: "Upload warehouse form and update baseline",
	},
];

export default async function DashboardPage({ params }: DashboardPageProps) {
	const { pantryId } = await params;

	if (pantryId !== "director") {
		redirect("/");
	}

	const resolvedLinks = dashboardLinks.map((link) =>
		link.href === "/director/upload" ? { ...link, href: `/${pantryId}/upload` } : link
	);

	return (
		<DashboardClient
			pantryId={pantryId}
			links={resolvedLinks}
		/>
	);
}
