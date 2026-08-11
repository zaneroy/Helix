"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface Props {
  data: number[];
  color: string;
}

export default function KpiSparkline({
  data,
  color,
}: Props) {
  const chartData = data.map((value, index) => ({
    index,
    value,
  }));

  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={3}
            fill={color}
            fillOpacity={0.08}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}