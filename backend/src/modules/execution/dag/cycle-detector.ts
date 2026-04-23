import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkflowDefinition } from './dag.types';

@Injectable()
export class CycleDetector {
  detect(definition: WorkflowDefinition): void {
    const adjacency = new Map<string, string[]>();

    for (const node of definition.nodes) {
      adjacency.set(node.id, []);
    }

    for (const edge of definition.edges) {
      adjacency.get(edge.from)?.push(edge.to);
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();

    const dfs = (nodeId: string) => {
      if (visiting.has(nodeId)) {
        throw new BadRequestException(
          `Cycle detected involving node: ${nodeId}`,
        );
      }

      if (visited.has(nodeId)) {
        return;
      }

      visiting.add(nodeId);

      for (const neighbor of adjacency.get(nodeId) || []) {
        dfs(neighbor);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
    };

    for (const node of definition.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }
  }
}
