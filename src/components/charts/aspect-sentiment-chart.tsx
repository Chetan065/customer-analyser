"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface AspectSentimentProps {
  aspects: Array<{
    aspect: string;
    positive: number;
    neutral: number;
    negative: number;
    total: number;
  }>;
}

export function AspectSentimentChart({ aspects }: AspectSentimentProps) {
  const formattedData = aspects.map((a) => ({
    aspect: a.aspect
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    Positive: a.positive,
    Neutral: a.neutral,
    Negative: a.negative,
    total: a.total,
  }));

  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">Aspect Sentiment Breakdown</CardTitle>
        <CardDescription className="text-xs">
          Granular customer sentiment segmented by key product dimensions and functional areas.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {formattedData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
            No aspect breakdown available yet. Run the pipeline to extract aspect sentiments.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={formattedData}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis
                  dataKey="aspect"
                  tick={{ fontSize: 11 }}
                  stroke="#888888"
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 11 }} stroke="#888888" />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover border text-popover-foreground text-xs p-2.5 rounded-lg shadow-md space-y-1">
                          <div className="font-bold border-b pb-1">{label}</div>
                          {payload.map((entry: any) => (
                            <div
                              key={entry.name}
                              className="flex items-center justify-between gap-4"
                              style={{ color: entry.fill }}
                            >
                              <span>{entry.name}:</span>
                              <span className="font-semibold">{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                  iconSize={8}
                />
                <Bar dataKey="Positive" fill="#10b981" radius={[3, 3, 0, 0]} stackId="a" />
                <Bar dataKey="Neutral" fill="#f59e0b" radius={[0, 0, 0, 0]} stackId="a" />
                <Bar dataKey="Negative" fill="#ef4444" radius={[3, 3, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
