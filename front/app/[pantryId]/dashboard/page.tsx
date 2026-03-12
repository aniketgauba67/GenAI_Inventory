import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

type DashboardPageProps = {
	params: Promise<{ pantryId: string }>;
};

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
		/>
	);
}
