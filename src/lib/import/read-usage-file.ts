"use client";

import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";

import { ByteDanceImportError, parseByteDanceMatrix } from "@/lib/import/bytedance";
import type { UsageImportResult } from "@/lib/usage/types";

const SUPPORTED_EXTENSIONS = new Set(["csv", "xlsx"]);

export async function readByteDanceUsageFile(
  file: File,
): Promise<UsageImportResult> {
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (!extension || !SUPPORTED_EXTENSIONS.has(extension)) {
    throw new ByteDanceImportError("仅支持 CSV 或 XLSX 文件。");
  }

  const matrix =
    extension === "csv" ? await readCsv(file) : await readSheet(file);
  return parseByteDanceMatrix(matrix);
}

async function readCsv(file: File): Promise<unknown[][]> {
  const text = await file.text();
  const parsed = Papa.parse<unknown[]>(text, {
    skipEmptyLines: false,
  });

  if (parsed.errors.length > 0) {
    throw new ByteDanceImportError(
      `CSV 解析失败：${parsed.errors[0]?.message ?? "格式错误"}`,
    );
  }

  return parsed.data;
}
