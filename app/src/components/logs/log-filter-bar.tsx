"use client";

import { allDomains } from "./log-utils";

type LogType = "activity" | "errors" | "fetches" | "tickets";

type Filters = {
  domain?: string;
  severity?: string;
  success?: string;
  resolved?: string;
  search?: string;
};

type Props = {
  logType: LogType;
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
};

const selectBase = "rounded-lg border border-[#2A3544] bg-[#151C24] px-2.5 py-1.5 text-[0.6875rem] text-white outline-none focus:border-[#6AD7A3] appearance-none cursor-pointer";

export default function LogFilterBar({ logType, filters, onFilterChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <input
        type="text"
        value={filters.search ?? ""}
        onChange={(e) => onFilterChange({ ...filters, search: e.target.value || undefined })}
        placeholder="Search..."
        className={`${selectBase} w-full md:w-44`}
      />

      {/* Domain filter (activity only) */}
      {logType === "activity" && (
        <select
          value={filters.domain ?? ""}
          onChange={(e) => onFilterChange({ ...filters, domain: e.target.value || undefined })}
          className={selectBase}
        >
          <option value="">All domains</option>
          {allDomains.map((d) => (
            <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
          ))}
        </select>
      )}

      {/* Success/Failed filter (events + fetches) */}
      {(logType === "activity" || logType === "fetches") && (
        <select
          value={filters.success ?? ""}
          onChange={(e) => onFilterChange({ ...filters, success: e.target.value || undefined })}
          className={selectBase}
        >
          <option value="">All results</option>
          <option value="true">Success</option>
          <option value="false">Failed</option>
        </select>
      )}

      {/* Severity filter (errors only) */}
      {logType === "errors" && (
        <select
          value={filters.severity ?? ""}
          onChange={(e) => onFilterChange({ ...filters, severity: e.target.value || undefined })}
          className={selectBase}
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      )}

      {/* Resolved filter (errors only) */}
      {logType === "errors" && (
        <select
          value={filters.resolved ?? ""}
          onChange={(e) => onFilterChange({ ...filters, resolved: e.target.value || undefined })}
          className={selectBase}
        >
          <option value="">All status</option>
          <option value="false">Open</option>
          <option value="true">Resolved</option>
        </select>
      )}

      {/* Clear filters */}
      {Object.values(filters).some(Boolean) && (
        <button
          type="button"
          onClick={() => onFilterChange({})}
          className="text-[0.6875rem] text-[#9CA3AF] hover:text-white"
        >
          Clear
        </button>
      )}
    </div>
  );
}
