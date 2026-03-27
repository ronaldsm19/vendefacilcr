import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: "pink" | "orange" | "yellow" | "green";
  sub?: string;
}

const colorMap = {
  pink:   "bg-brand-pink/10 text-brand-pink",
  orange: "bg-brand-orange/10 text-brand-orange",
  yellow: "bg-brand-yellow/20 text-amber-600",
  green:  "bg-emerald-50 text-emerald-600",
};

export default function StatsCard({
  label, value, icon: Icon, color = "pink", sub,
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 card-shadow border border-brand-muted">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-brand-dark/50 font-medium">{label}</p>
          <p className="text-2xl font-bold text-brand-dark mt-1">{value}</p>
          {sub && <p className="text-xs text-brand-dark/40 mt-0.5">{sub}</p>}
        </div>
        <span className={`p-2.5 rounded-xl ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </span>
      </div>
    </div>
  );
}
