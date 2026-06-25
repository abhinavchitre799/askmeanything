"use client";

import React from "react";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  variant?: ButtonVariant;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary:
      "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    ghost: "bg-transparent text-indigo-600 hover:bg-indigo-50",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

const fieldBase =
  "block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", ...props }, ref) {
  return <input ref={ref} className={`${fieldBase} ${className}`} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...props }, ref) {
  return (
    <textarea ref={ref} className={`${fieldBase} ${className}`} {...props} />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className = "", children, ...props }, ref) {
  return (
    <select ref={ref} className={`${fieldBase} ${className}`} {...props}>
      {children}
    </select>
  );
});

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

export function Badge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  let color = "bg-gray-100 text-gray-700 ring-gray-200";
  if (["ready", "completed", "indexed", "success", "done"].includes(s)) {
    color = "bg-green-100 text-green-800 ring-green-200";
  } else if (["pending", "queued", "idle"].includes(s)) {
    color = "bg-gray-100 text-gray-700 ring-gray-200";
  } else if (["crawling", "running", "processing", "syncing"].includes(s)) {
    color = "bg-blue-100 text-blue-800 ring-blue-200";
  } else if (["error", "failed"].includes(s)) {
    color = "bg-red-100 text-red-800 ring-red-200";
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${color}`}
    >
      {status || "unknown"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* StatusMessage                                                       */
/* ------------------------------------------------------------------ */

export function StatusMessage({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles: Record<"error" | "success" | "info", string> = {
    error: "bg-red-50 text-red-800 border-red-200",
    success: "bg-green-50 text-green-800 border-green-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
  };
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${styles[kind]}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* api helper                                                          */
/* ------------------------------------------------------------------ */

async function parse(res: Response) {
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw new Error((json && json.error) || "Request failed");
  }
  return json;
}

export const api = {
  async get(url: string) {
    const res = await fetch(url, { cache: "no-store" });
    return parse(res);
  },
  async post(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    return parse(res);
  },
  async postForm(url: string, formData: FormData) {
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });
    return parse(res);
  },
};
