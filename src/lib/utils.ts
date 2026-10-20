import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(val: number): string {
  return `${Math.round(val * 100)}%`;
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "N/A";
  return (score > 0 ? "+" : "") + score.toFixed(2);
}
