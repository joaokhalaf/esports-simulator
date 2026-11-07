import { createFileRoute } from "@tanstack/react-router";
import { WorldsSimulator } from "@/components/worlds-simulator";

export const Route = createFileRoute("/")({ component: WorldsSimulator });
