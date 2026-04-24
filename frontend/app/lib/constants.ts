import type { ViewKey } from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

export const sampleDefinition = JSON.stringify(
  {
    name: "Sample HTTP workflow",
    timeout_ms: 30000,
    nodes: [
      {
        id: "fetch",
        name: "Fetch Users",
        type: "http",
        config: {
          method: "GET",
          url: "https://jsonplaceholder.typicode.com/users",
        },
        retry: { max_attempts: 3, backoff_ms: 1000 },
      },
      {
        id: "wait",
        name: "Wait",
        type: "delay",
        config: { ms: 500 },
      },
      {
        id: "check",
        name: "Check Condition",
        type: "condition",
        config: { value: true },
      },
      {
        id: "calculate",
        name: "Calculate",
        type: "script",
        config: {
          code: "result = input.count * 2;",
          input: { count: 21 },
          timeout_ms: 1000,
        },
      },
    ],
    edges: [
      { from: "fetch", to: "wait" },
      { from: "wait", to: "check" },
      { from: "check", to: "calculate", condition: true },
    ],
  },
  null,
  2,
);

export const baseNavItems: Array<{ key: ViewKey; label: string; hint: string }> = [
  { key: "home", label: "Overview", hint: "Editorial pulse" },
  { key: "posts", label: "Posts", hint: "Write and manage" },
  { key: "review", label: "Review", hint: "Moderate submissions" },
  { key: "users", label: "Users", hint: "Role control" },
  { key: "tools", label: "Tools", hint: "Legacy workflow admin" },
];
