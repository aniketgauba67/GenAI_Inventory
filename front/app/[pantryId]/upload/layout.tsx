import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upload Inventory",
  description: "Upload inventory data",
};

export default function UploadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}