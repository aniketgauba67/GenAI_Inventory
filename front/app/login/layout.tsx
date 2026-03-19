import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logging in...",
  description: "Volunteer login",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}