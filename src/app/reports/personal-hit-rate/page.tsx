import type { Metadata } from "next";
import { PersonalHitRateReportClient } from "./PersonalHitRateReportClient";

export const metadata: Metadata = {
  title: "個人的中率",
  description: "期間を指定して個人的中率を集計し、PDF で保存できます",
};

export default function PersonalHitRateReportPage() {
  return <PersonalHitRateReportClient />;
}
