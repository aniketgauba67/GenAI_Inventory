import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

type DashboardPageProps = {
	params: Promise<{ pantryId: string }>;
};

const mockPantryCredentials = [
	{ pantryId: "pantry101", password: "grainbox8" },
	{ pantryId: "pantry202", password: "freshstock3" },
	{ pantryId: "pantry303", password: "shelfcheck4" },
	{ pantryId: "pantry404", password: "producehub6" },
	{ pantryId: "pantry505", password: "mealflow9" },
	{ pantryId: "pantry606", password: "dockteam2" },
	{ pantryId: "pantry707", password: "cannedset5" },
	{ pantryId: "pantry808", password: "drygoods7" },
];

const dashboardLinks = [
	{ label: "Home", href: "/", description: "Back to role selector" },
	{
		label: "Inventory Upload",
		href: "/director/upload",
		description: "Open pantry image upload",
	},
	{
		label: "Form Upload",
		href: "/manager",
		description: "Upload order forms to database",
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
			initialCredentials={mockPantryCredentials}
		/>
	);
}
