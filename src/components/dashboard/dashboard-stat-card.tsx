import { Card } from "@/components/ui";

interface DashboardStatCardProps {
  label: string;
  value: string;
  description: string;
}

export function DashboardStatCard({ label, value, description }: DashboardStatCardProps) {
  return (
    <Card className="h-full shadow-none">
      <p className="text-label">{label}</p>
      <p className="mt-4 text-3xl font-bold text-text-primary">{value}</p>
      <p className="text-helper mt-3">{description}</p>
    </Card>
  );
}
