"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface SentimentOverviewProps {
  distribution: Array<{ name: string; value: number; color: string }>;
  sentimentOverTime: Array<{
    date: string;
    positive: number;
    neutral: number;
    negative: number;
    avgScore: number;
    count: number;
  }>;
}

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="text-[11px] font-bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function SentimentOverview({
  distribution,
  sentimentOverTime,
}: SentimentOverviewProps) {
  const hasDistributionData = distribution.some((d) => d.value > 0);
  const hasTimeData = sentimentOverTime.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Donut Chart */}
      <Card className="lg:col-span-1 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Sentiment Distribution</CardTitle>
          <CardDescription className="text-xs">
            Overall sentiment share across all analyzed feedback items.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {!hasDistributionData ? (
            <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
              No sentiment data available. Run analysis first.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      labelLine={false}
                      label={renderCustomizedLabel}
                    >
                      {distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0];
                          return (
                            <div className="bg-popover border text-popover-foreground text-xs p-2 rounded-md shadow-md">
                              <span className="font-semibold">{data.name}: </span>
                              <span>{data.value} items</span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex justify-center items-center gap-4 text-xs">
                {distribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Sentiment Over Time Chart */}
      <Card className="lg:col-span-2 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Sentiment Over Time</CardTitle>
          <CardDescription className="text-xs">
            Tracking customer mood velocity and volume trends across date ranges.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {!hasTimeData ? (
            <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
              No date timestamps found on feedback items.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={sentimentOverTime}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="positiveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="negativeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="#888888"
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#888888" tickLine={false} />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover border text-popover-foreground text-xs p-2.5 rounded-lg shadow-md space-y-1">
                            <div className="font-bold border-b pb-1">{label}</div>
                            <div className="text-emerald-600 font-medium">
                              Positive: {payload.find((p) => p.dataKey === "positive")?.value || 0}
                            </div>
                            <div className="text-amber-500 font-medium">
                              Neutral: {payload.find((p) => p.dataKey === "neutral")?.value || 0}
                            </div>
                            <div className="text-rose-600 font-medium">
                              Negative: {payload.find((p) => p.dataKey === "negative")?.value || 0}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="positive"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#positiveGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="negative"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#negativeGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
