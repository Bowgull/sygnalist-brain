"use client";

import { useState, useRef, useCallback } from "react";

interface FileDropzoneProps {
  accept: string[];
  maxSize?: number;
  onFile: (file: File) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export default function FileDropzone({
  accept,
  maxSize = 5 * 1024 * 1024,
  onFile,
  disabled = false,
  children,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptStr = accept.join(",");

  function validate(file: File): string | null {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!accept.includes(ext)) {
      return `Unsupported file type (${ext}). Accepted: ${accept.join(", ")}`;
    }
    if (file.size > maxSize) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: ${(maxSize / 1024 / 1024).toFixed(0)}MB`;
    }
    return null;
  }

  function handleFile(file: File) {
    const err = validate(file);
    if (err) {
      setError(err);
      setTimeout(() => setError(null), 4000);
      return;
    }
    setError(null);
    onFile(file);
  }

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    [],
  );

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [disabled, accept, maxSize, onFile],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!disabled) inputRef.current?.click();
        }
      }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors ${
        disabled
          ? "pointer-events-none opacity-50 border-[#2A3544]"
          : isDragging
            ? "border-[#6AD7A3] bg-[#6AD7A3]/10"
            : "border-[#2A3544] hover:border-[#6AD7A3]/40 hover:bg-[#6AD7A3]/5"
      } bg-[#0C1016]/50 p-6 text-center`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptStr}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {isDragging ? (
        <p className="text-sm font-medium text-[#6AD7A3]">Drop file here</p>
      ) : (
        children
      )}
      {error && (
        <p className="mt-2 text-[12px] text-[#DC2626]">{error}</p>
      )}
    </div>
  );
}
