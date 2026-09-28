import { describe, expect, it } from "vitest";

import {
  ByteDanceImportError,
  parseByteDanceMatrix,
} from "@/lib/import/bytedance";

describe("parseByteDanceMatrix", () => {
  it("parses and aggregates the exported workspace report", () => {
    const result = parseByteDanceMatrix(
      [
        [
          "日期",
          "曲线",
          "部门",
          "模型大类",
          "模型",
          "Token消耗",
          "成本(RMB)",
          "数据状态",
        ],
        ["2026-09-01", "全部", "", "", "", 12_500, 4.2, "有数据"],
        ["2026-09-01", "全部", "", "", "", "2万", "1.8", "有数据"],
        ["2026-09-02", "全部", "", "", "", 0, 0, "有数据"],
      ],
      new Date("2026-09-28T00:00:00.000Z"),
    );

    expect(result.warnings).toEqual([]);
    expect(result.dataset.records).toHaveLength(3);
    expect(result.dataset.daily).toEqual([
      { date: "2026-09-01", tokens: 32_500, costRmb: 6 },
      { date: "2026-09-02", tokens: 0, costRmb: 0 },
    ]);
    expect(result.dataset.summary).toEqual({
      totalTokens: 32_500,
      totalCostRmb: 6,
      peakDailyTokens: 32_500,
      activeDays: 1,
      rangeStart: "2026-09-01",
      rangeEnd: "2026-09-02",
    });
  });

  it("skips malformed rows and reports their sheet row", () => {
    const result = parseByteDanceMatrix([
      ["日期", "Token 消耗", "数据状态"],
      ["not-a-date", 20, "有数据"],
      ["2026/09/02", "unknown", "有数据"],
      ["2026/09/03", 30, "无数据"],
      ["2026/09/04", 40, "有数据"],
    ]);

    expect(result.dataset.records).toHaveLength(1);
    expect(result.dataset.records[0]?.date).toBe("2026-09-04");
    expect(result.warnings).toEqual([
      "第 2 行日期无法识别，已跳过。",
      "第 3 行 Token 消耗无法识别，已跳过。",
    ]);
  });

  it("rejects files without the required headers", () => {
    expect(() => parseByteDanceMatrix([["day", "amount"]])).toThrow(
      ByteDanceImportError,
    );
  });
});
