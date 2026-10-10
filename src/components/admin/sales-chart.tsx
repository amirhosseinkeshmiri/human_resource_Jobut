import type { SalesBucket } from "@/admin/sales-policy";
import { formatToman } from "@/admin/sales-policy";

interface SalesChartProps {
  buckets: SalesBucket[];
}

const width = 720;
const height = 240;
const inset = 24;

export function SalesChart({ buckets }: SalesChartProps) {
  const maximum = Math.max(0, ...buckets.map((bucket) => bucket.amount));
  const usableWidth = width - inset * 2;
  const usableHeight = height - inset * 2;
  const points = buckets.map((bucket, index) => {
    const x = buckets.length === 1 ? width / 2 : inset + (index / (buckets.length - 1)) * usableWidth;
    const y = inset + usableHeight - (maximum === 0 ? 0 : bucket.amount / maximum * usableHeight);
    return { ...bucket, x, y };
  });
  const pointString = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const selectedLabels = points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.max(1, Math.floor(points.length / 4)) === 0);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-labelledby="sales-chart-title sales-chart-description"
      >
        <title id="sales-chart-title">نمودار مبلغ خریدهای پرداخت‌شده</title>
        <desc id="sales-chart-description">بیشترین مبلغ در یک بازه {formatToman(maximum)} است. جزئیات عددی پس از نمودار آمده است.</desc>
        {[0, 0.5, 1].map((position) => (
          <line key={position} x1={inset} x2={width - inset} y1={inset + usableHeight * position} y2={inset + usableHeight * position} className="stroke-ui-border" strokeWidth="1" />
        ))}
        {points.length > 1 ? <polyline points={pointString} fill="none" className="stroke-action" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {points.map((point) => <circle key={point.key} cx={point.x} cy={point.y} r={points.length > 35 ? 2 : 3.5} className="fill-action"><title>{point.label}: {formatToman(point.amount)}</title></circle>)}
      </svg>
      <div className="mt-2 flex justify-between gap-2 text-xs text-text-muted" aria-hidden="true">
        {selectedLabels.map((point) => <span key={point.key}>{point.label}</span>)}
      </div>
      <details className="mt-4 rounded-md border border-ui-border p-3">
        <summary className="cursor-pointer text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus">مشاهده داده‌های عددی نمودار</summary>
        <ul className="mt-3 grid max-h-60 gap-2 overflow-y-auto text-sm sm:grid-cols-2 lg:grid-cols-3">
          {buckets.map((bucket) => <li key={bucket.key} className="flex justify-between gap-3"><span className="text-text-secondary">{bucket.label}</span><span className="font-semibold">{formatToman(bucket.amount)}</span></li>)}
        </ul>
      </details>
    </div>
  );
}
