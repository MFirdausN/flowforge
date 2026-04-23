import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkflowDefinition, WorkflowNode } from './dag.types';

@Injectable()
export class TopologicalSort {
  sort(definition: WorkflowDefinition): WorkflowNode[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    const nodeMap = new Map<string, WorkflowNode>();

    for (const node of definition.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
      nodeMap.set(node.id, node);
    }

    for (const edge of definition.edges) {
      adjacency.get(edge.from)?.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    const queue: string[] = [];

    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const sorted: WorkflowNode[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(nodeMap.get(current)!);

      for (const neighbor of adjacency.get(current) || []) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);

        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (sorted.length !== definition.nodes.length) {
      throw new BadRequestException(
        'Topological sort failed due to invalid DAG',
      );
    }

    return sorted;
  }
}
