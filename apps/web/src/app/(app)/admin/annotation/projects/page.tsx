import type { Metadata } from "next";
import { AdminProjects } from "@/features/annotation/admin-projects";

export const metadata: Metadata = { title: "Annotation projects" };
export default function Page() { return <AdminProjects />; }
