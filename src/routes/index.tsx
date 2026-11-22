import { Landing } from "@/components/landing/Landing";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Landing });
