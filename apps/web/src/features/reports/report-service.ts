import { apiClient } from "@/services/api-client";
import type { ReportsDashboard, ReportsDetail } from "@/types/api";

export const reportService = {
  getDashboard(token: string): Promise<ReportsDashboard> {
    return apiClient.get<ReportsDashboard>("/reports/dashboard", {
      token,
    });
  },

  getDetail(
    startDate: string,
    endDate: string,
    token: string,
  ): Promise<ReportsDetail> {
    const query = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    return apiClient.get<ReportsDetail>(`/reports/detail?${query.toString()}`, {
      token,
    });
  },
};
