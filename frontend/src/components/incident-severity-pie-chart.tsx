"use client"

import * as React from "react"
import { Pie, PieChart } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"

interface ChartData {
    name: string;
    value: number;
    fill: string;
}

interface IncidentSeverityPieChartProps {
    data: ChartData[];
}

export function IncidentSeverityPieChart({ data }: IncidentSeverityPieChartProps) {
  const chartConfig = data.reduce((acc, item) => {
    acc[item.name] = { label: item.name, color: item.fill };
    return acc;
  }, {} as ChartConfig);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Incidents by Severity</CardTitle>
        <CardDescription>Distribution of incident severity levels.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="value" hideLabel />}
            />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} />
             <ChartLegend
                content={<ChartLegendContent nameKey="name" />}
                className="[&_.recharts-legend-item]:w-1/2 [&_.recharts-legend-item]:justify-start"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
