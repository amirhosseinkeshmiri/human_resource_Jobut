export type CityComboboxKeyAction =
  | { type: "navigate"; activeIndex: number }
  | { type: "select"; activeIndex: number }
  | { type: "close" };

export function getCityComboboxKeyAction(
  key: string,
  activeIndex: number,
  resultCount: number,
  open: boolean,
): CityComboboxKeyAction | null {
  if (key === "Escape") return { type: "close" };
  if (resultCount < 1) return null;
  if (key === "ArrowDown") return { type: "navigate", activeIndex: Math.min(activeIndex + 1, resultCount - 1) };
  if (key === "ArrowUp") return { type: "navigate", activeIndex: Math.max(activeIndex - 1, 0) };
  if (key === "Enter" && open) return { type: "select", activeIndex };
  return null;
}
