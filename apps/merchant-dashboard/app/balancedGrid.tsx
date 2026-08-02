import { Children, type ReactNode } from "react";

/**
 * Grilla de 6 columnas en md+ que reparte N cards sin dejar
 * un ítem solo ni una celda vacía (1 / 2 / 3 / 2×2 / 3+2 / 3×2).
 */
export function balancedItemClass(count: number, index: number): string {
  if (count <= 1) return "md:col-span-6";
  if (count === 2) return "md:col-span-3";
  if (count === 3) return "md:col-span-2";
  if (count === 4) return "md:col-span-3";
  if (count === 5) return index < 3 ? "md:col-span-2" : "md:col-span-3";
  if (count === 6) return "md:col-span-2";
  const rem = count % 3;
  if (rem === 1 && index >= count - 4) return "md:col-span-3";
  return "md:col-span-2";
}

export function BalancedGrid({
  count,
  gapClassName = "gap-3",
  children,
}: {
  count: number;
  gapClassName?: string;
  children: ReactNode;
}) {
  const items = Children.toArray(children);
  return (
    <div
      className={`grid w-full grid-cols-1 ${gapClassName} md:grid-cols-6 md:auto-rows-fr`}
    >
      {items.map((child, i) => (
        <div
          key={
            child && typeof child === "object" && "key" in child && child.key != null
              ? String(child.key)
              : i
          }
          className={`min-w-0 ${balancedItemClass(count, i)} [&>*]:h-full [&>*]:w-full`}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
