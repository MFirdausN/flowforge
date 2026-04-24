import type { WorkflowDefinition } from "../lib/types";
import { EmptyState } from "./ui";

export function DagVisual({
  definition,
  compact = false,
}: {
  definition: WorkflowDefinition | undefined;
  compact?: boolean;
}) {
  if (!definition) {
    return <EmptyState text="Belum ada workflow definition untuk divisualkan." />;
  }

  const width = 760;
  const height = Math.max(compact ? 220 : 260, definition.nodes.length * 92);
  const positions = new Map(
    definition.nodes.map((node, index) => [
      node.id,
      { x: 90 + (index % 2) * 330, y: 60 + index * 82 },
    ]),
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`${compact ? "h-[430px]" : "h-[560px]"} w-full`}
      >
        <defs>
          <marker
            id="arrow"
            markerHeight="8"
            markerWidth="8"
            orient="auto"
            refX="8"
            refY="4"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#14b8a6" />
          </marker>
        </defs>
        {definition.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;

          return (
            <line
              key={`${edge.from}-${edge.to}`}
              markerEnd="url(#arrow)"
              stroke="#14b8a6"
              strokeWidth="3"
              x1={from.x + 210}
              x2={to.x}
              y1={from.y + 34}
              y2={to.y + 34}
            />
          );
        })}
        {definition.nodes.map((node) => {
          const position = positions.get(node.id)!;

          return (
            <g key={node.id}>
              <rect
                fill="#f8fafc"
                height="68"
                rx="18"
                width="230"
                x={position.x}
                y={position.y}
              />
              <text
                fill="#0f172a"
                fontSize="16"
                fontWeight="900"
                x={position.x + 18}
                y={position.y + 30}
              >
                {node.name.slice(0, 20)}
              </text>
              <text
                fill="#0f766e"
                fontSize="13"
                fontWeight="800"
                x={position.x + 18}
                y={position.y + 52}
              >
                {node.id} / {node.type}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
