"use client";

import {
  Activity,
  ChartNoAxesCombined,
  Code2,
  Database,
  Download,
  FileSpreadsheet,
  Gauge,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ActivityMatrix } from "@/components/dashboard/activity-matrix";
import {
  UsageChart,
  type UsageChartMode,
} from "@/components/dashboard/usage-chart";
import {
  formatDateRange,
  formatDateTime,
  formatDuration,
  formatRmb,
  formatTokenCount,
} from "@/lib/format";
import { readByteDanceUsageFile } from "@/lib/import/read-usage-file";
import type { CodexUsageSnapshot } from "@/lib/codex/types";
import type {
  DailyUsagePoint,
  UsageDataset,
} from "@/lib/usage/types";

type SourceId = "codex" | "bytedance";
type LoadingState = "idle" | "loading" | "ready" | "error" | "auth-required";

const STORAGE_KEY = "agent-meter:bytedance:v1";

export function AgentMeterDashboard() {
  const [source, setSource] = useState<SourceId>("codex");
  const [chartMode, setChartMode] = useState<UsageChartMode>("daily");
  const [codex, setCodex] = useState<CodexUsageSnapshot | null>(null);
  const [codexState, setCodexState] = useState<LoadingState>("idle");
  const [codexError, setCodexError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<UsageDataset | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshCodex = useCallback(async () => {
    setCodexState("loading");
    setCodexError(null);

    try {
      const response = await fetch("/api/codex/usage", { cache: "no-store" });
      const payload = (await response.json()) as
        | CodexUsageSnapshot
        | { code?: string; message?: string };

      if (!response.ok) {
        const message =
          "message" in payload && payload.message
            ? payload.message
            : "Codex 用量读取失败。";
        setCodexError(message);
        setCodexState(
          "code" in payload && payload.code === "CODEX_AUTH_REQUIRED"
            ? "auth-required"
            : "error",
        );
        return;
      }

      setCodex(payload as CodexUsageSnapshot);
      setCodexState("ready");
    } catch {
      setCodexError("无法连接本地 AgentMeter 服务。");
      setCodexState("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshCodex();

      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          return;
        }
        const parsed = JSON.parse(stored) as UsageDataset;
        if (
          parsed.source === "bytedance" &&
          Array.isArray(parsed.records) &&
          Array.isArray(parsed.daily)
        ) {
          setWorkspace(parsed);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshCodex]);

  const importFile = useCallback(async (file: File) => {
    setIsImporting(true);
    setImportWarnings([]);

    try {
      const result = await readByteDanceUsageFile(file);
      setWorkspace(result.dataset);
      setImportWarnings(result.warnings);
      setSource("bytedance");

      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(result.dataset),
        );
      } catch {
        setImportWarnings((current) => [
          ...current,
          "数据已载入，但浏览器缓存空间不足。",
        ]);
      }
    } catch (error) {
      setImportWarnings([
        error instanceof Error ? error.message : "文件解析失败。",
      ]);
    } finally {
      setIsImporting(false);
    }
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      await importFile(file);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      await importFile(file);
    }
  };

  const loadSample = async () => {
    const response = await fetch("/examples/bytedance-token-sample.csv");
    const file = new File(
      [await response.blob()],
      "bytedance-token-sample.csv",
      { type: "text/csv" },
    );
    await importFile(file);
  };

  const clearWorkspace = () => {
    setWorkspace(null);
    setImportWarnings([]);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const daily = useMemo<DailyUsagePoint[]>(() => {
    if (source === "codex") {
      return codex?.daily ?? [];
    }
    return workspace?.daily ?? [];
  }, [codex, source, workspace]);

  const metrics = getMetrics(source, codex, workspace);
  const status = getSourceStatus(source, codexState, workspace);

  return (
    <div className="app-frame" data-source={source}>
      <aside className="sidebar">
        <a className="brand-lockup" href="#overview" aria-label="AgentMeter 总览">
          <span className="brand-mark">
            <Gauge aria-hidden="true" size={19} />
          </span>
          <span>AgentMeter</span>
        </a>

        <nav className="side-nav" aria-label="页面导航">
          <a className="side-link is-active" href="#overview">
            <ChartNoAxesCombined aria-hidden="true" size={18} />
            <span>总览</span>
          </a>
          <a className="side-link" href="#sources">
            <Database aria-hidden="true" size={18} />
            <span>数据源</span>
          </a>
          <a className="side-link" href="#privacy">
            <ShieldCheck aria-hidden="true" size={18} />
            <span>隐私</span>
          </a>
        </nav>

        <a
          className="repo-link"
          href="https://github.com/git-damboro/agent-meter"
          rel="noreferrer"
          target="_blank"
        >
          <Code2 aria-hidden="true" size={18} />
          <span>GitHub</span>
        </a>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">LOCAL USAGE LEDGER</p>
            <h1>个人用量</h1>
          </div>

          <div className="source-switcher" aria-label="数据源">
            <button
              aria-pressed={source === "codex"}
              className="source-tab"
              onClick={() => setSource("codex")}
              type="button"
            >
              Codex Plus
            </button>
            <button
              aria-pressed={source === "bytedance"}
              className="source-tab"
              onClick={() => setSource("bytedance")}
              type="button"
            >
              字节导入
            </button>
          </div>
        </header>

        <section className="overview" id="overview">
          <div className="identity-row">
            <div className="identity-mark" aria-hidden="true">
              AM
            </div>
            <div className="identity-copy">
              <div className="identity-title-row">
                <h2>{source === "codex" ? "Codex Plus" : "字节工作区"}</h2>
                <span className="status-dot" data-state={status.state} />
                <span className="status-text">{status.label}</span>
              </div>
              <p>{getSourceSubtitle(source, codex, workspace)}</p>
            </div>

            <div className="header-actions">
              {source === "codex" ? (
                <button
                  className="icon-button"
                  disabled={codexState === "loading"}
                  onClick={() => void refreshCodex()}
                  title="刷新 Codex 数据"
                  type="button"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={codexState === "loading" ? "is-spinning" : ""}
                    size={18}
                  />
                  <span className="sr-only">刷新 Codex 数据</span>
                </button>
              ) : (
                <>
                  <button
                    className="primary-action"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    {isImporting ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="is-spinning"
                        size={17}
                      />
                    ) : (
                      <Upload aria-hidden="true" size={17} />
                    )}
                    导入文件
                  </button>
                  {workspace ? (
                    <button
                      className="icon-button"
                      onClick={clearWorkspace}
                      title="清除导入数据"
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={17} />
                      <span className="sr-only">清除导入数据</span>
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="metric-strip">
            {metrics.map((metric) => (
              <div className="metric-item" key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        </section>

        {source === "codex" && codexState !== "ready" ? (
          <CodexConnectionState
            error={codexError}
            onRefresh={() => void refreshCodex()}
            state={codexState}
          />
        ) : null}

        {source === "bytedance" && !workspace ? (
          <section
            className="import-surface"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => void handleDrop(event)}
          >
            <FileSpreadsheet aria-hidden="true" size={28} />
            <h2>导入字节用量</h2>
            <p>CSV / XLSX · 日期、Token消耗、成本(RMB)</p>
            <div className="import-actions">
              <button
                className="primary-action"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <Upload aria-hidden="true" size={17} />
                选择文件
              </button>
              <button
                className="text-action"
                onClick={() => void loadSample()}
                type="button"
              >
                <Download aria-hidden="true" size={17} />
                加载示例
              </button>
            </div>
          </section>
        ) : null}

        {daily.length > 0 ? (
          <>
            <section className="analysis-section" aria-labelledby="usage-title">
              <div className="section-heading">
                <div>
                  <p className="section-index">01</p>
                  <h2 id="usage-title">Token 活动</h2>
                </div>
                <div className="mode-switcher" aria-label="统计周期">
                  {(["daily", "weekly", "cumulative"] as const).map((mode) => (
                    <button
                      aria-pressed={chartMode === mode}
                      key={mode}
                      onClick={() => setChartMode(mode)}
                      type="button"
                    >
                      {mode === "daily"
                        ? "每日"
                        : mode === "weekly"
                          ? "每周"
                          : "累计"}
                    </button>
                  ))}
                </div>
              </div>
              <UsageChart daily={daily} mode={chartMode} />
            </section>

            <section className="analysis-section activity-section">
              <div className="section-heading">
                <div>
                  <p className="section-index">02</p>
                  <h2>活动强度</h2>
                </div>
                <span className="section-meta">最近 {Math.min(daily.length, 93)} 个数据日</span>
              </div>
              <ActivityMatrix daily={daily} />
            </section>
          </>
        ) : null}

        <section className="source-section" id="sources">
          <div className="section-heading">
            <div>
              <p className="section-index">03</p>
              <h2>数据源</h2>
            </div>
          </div>

          <div className="source-details">
            <div className="source-detail">
              <div className="source-detail-heading">
                <Activity aria-hidden="true" size={18} />
                <strong>Codex Plus</strong>
              </div>
              <p>官方 app-server</p>
              <span>
                {codex
                  ? `最近同步 ${new Date(codex.fetchedAt).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "等待本机登录"}
              </span>
            </div>
            <div className="source-detail">
              <div className="source-detail-heading">
                <FileSpreadsheet aria-hidden="true" size={18} />
                <strong>字节工作区</strong>
              </div>
              <p>本地 CSV / XLSX</p>
              <span>
                {workspace
                  ? `${workspace.records.length} 条记录`
                  : "等待文件导入"}
              </span>
            </div>
          </div>
        </section>

        {source === "codex" && codex ? (
          <section className="quota-section">
            <div className="section-heading">
              <div>
                <p className="section-index">04</p>
                <h2>额度窗口</h2>
              </div>
              <span className="section-meta">
                {codex.quota.ordinaryUsageAllowed === false
                  ? "当前不可用"
                  : "当前可用"}
              </span>
            </div>
            <div className="quota-grid">
              <QuotaRow
                label={formatWindowLabel(codex.quota.primary?.windowDurationMins)}
                resetsAt={codex.quota.primary?.resetsAt}
                usedPercent={codex.quota.primary?.usedPercent}
              />
              <QuotaRow
                label={formatWindowLabel(codex.quota.secondary?.windowDurationMins)}
                resetsAt={codex.quota.secondary?.resetsAt}
                usedPercent={codex.quota.secondary?.usedPercent}
              />
            </div>
          </section>
        ) : null}

        <section className="privacy-section" id="privacy">
          <ShieldCheck aria-hidden="true" size={20} />
          <div>
            <h2>本地数据边界</h2>
            <p>
              Codex 登录由官方 CLI 管理；导入文件只在浏览器解析。AgentMeter
              不接收 OAuth Token，也不上传原始表格。
            </p>
          </div>
        </section>

        {importWarnings.length > 0 ? (
          <div className="warning-list" role="status">
            {importWarnings.slice(0, 3).map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </div>
        ) : null}

        <input
          accept=".csv,.xlsx"
          className="sr-only"
          onChange={(event) => void handleFileChange(event)}
          ref={fileInputRef}
          type="file"
        />
      </main>
    </div>
  );
}

interface Metric {
  label: string;
  value: string;
}

function getMetrics(
  source: SourceId,
  codex: CodexUsageSnapshot | null,
  workspace: UsageDataset | null,
): Metric[] {
  if (source === "bytedance") {
    return [
      {
        label: "累计 Token",
        value: formatTokenCount(workspace?.summary.totalTokens),
      },
      {
        label: "单日峰值",
        value: formatTokenCount(workspace?.summary.peakDailyTokens),
      },
      {
        label: "累计成本",
        value: formatRmb(workspace?.summary.totalCostRmb),
      },
      {
        label: "活跃天数",
        value:
          workspace?.summary.activeDays === undefined
            ? "—"
            : `${workspace.summary.activeDays} 天`,
      },
      {
        label: "数据范围",
        value: formatDateRange(
          workspace?.summary.rangeStart,
          workspace?.summary.rangeEnd,
        ),
      },
    ];
  }

  return [
    {
      label: "累计 Token",
      value: formatTokenCount(codex?.summary.lifetimeTokens),
    },
    {
      label: "单日峰值",
      value: formatTokenCount(codex?.summary.peakDailyTokens),
    },
    {
      label: "最长任务",
      value: formatDuration(codex?.summary.longestRunningTurnSec),
    },
    {
      label: "当前连续",
      value:
        codex?.summary.currentStreakDays === undefined
          ? "—"
          : `${codex.summary.currentStreakDays} 天`,
    },
    {
      label: "最长连续",
      value:
        codex?.summary.longestStreakDays === undefined
          ? "—"
          : `${codex.summary.longestStreakDays} 天`,
    },
  ];
}

function getSourceStatus(
  source: SourceId,
  codexState: LoadingState,
  workspace: UsageDataset | null,
) {
  if (source === "bytedance") {
    return workspace
      ? { state: "ready", label: "已导入" }
      : { state: "idle", label: "等待导入" };
  }

  if (codexState === "loading") {
    return { state: "loading", label: "同步中" };
  }
  if (codexState === "ready") {
    return { state: "ready", label: "已同步" };
  }
  if (codexState === "auth-required") {
    return { state: "error", label: "待登录" };
  }
  if (codexState === "error") {
    return { state: "error", label: "连接失败" };
  }
  return { state: "idle", label: "等待同步" };
}

function getSourceSubtitle(
  source: SourceId,
  codex: CodexUsageSnapshot | null,
  workspace: UsageDataset | null,
): string {
  if (source === "bytedance") {
    return workspace
      ? `CSV / XLSX · ${workspace.records.length} 条记录`
      : "CSV / XLSX · 本地解析";
  }
  return `${codex?.account.planType?.toUpperCase() ?? "CHATGPT"} · 官方本机登录态`;
}

function formatWindowLabel(minutes?: number): string {
  if (minutes === undefined) {
    return "额度窗口";
  }
  if (minutes === 300) {
    return "5 小时窗口";
  }
  if (minutes === 10_080) {
    return "每周窗口";
  }
  if (minutes % 1_440 === 0) {
    return `${minutes / 1_440} 天窗口`;
  }
  return `${minutes} 分钟窗口`;
}

function QuotaRow({
  label,
  resetsAt,
  usedPercent,
}: {
  label: string;
  resetsAt?: number;
  usedPercent?: number;
}) {
  const percent = Math.min(Math.max(usedPercent ?? 0, 0), 100);

  return (
    <div className="quota-row">
      <div className="quota-copy">
        <strong>{label}</strong>
        <span>重置于 {formatDateTime(resetsAt)}</span>
      </div>
      <div
        aria-label={`${label} 已使用 ${usedPercent ?? 0}%`}
        className="quota-track"
        role="progressbar"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={usedPercent ?? 0}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <strong className="quota-value">
        {usedPercent === undefined ? "—" : `${usedPercent}%`}
      </strong>
    </div>
  );
}

function CodexConnectionState({
  error,
  onRefresh,
  state,
}: {
  error: string | null;
  onRefresh: () => void;
  state: LoadingState;
}) {
  if (state === "loading" || state === "idle") {
    return (
      <section className="connection-state" aria-live="polite">
        <LoaderCircle aria-hidden="true" className="is-spinning" size={20} />
        <span>正在读取 Codex 用量</span>
      </section>
    );
  }

  return (
    <section className="connection-state is-error" aria-live="polite">
      <div>
        <strong>{state === "auth-required" ? "需要登录 Codex" : "同步失败"}</strong>
        <span>{error}</span>
        {state === "auth-required" ? (
          <code>npx codex login --device-auth</code>
        ) : null}
      </div>
      <button className="text-action" onClick={onRefresh} type="button">
        <RefreshCw aria-hidden="true" size={16} />
        重试
      </button>
    </section>
  );
}
