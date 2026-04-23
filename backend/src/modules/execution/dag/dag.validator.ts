import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkflowDefinition, WorkflowNode } from './dag.types';

@Injectable()
export class DagValidator {
  validate(definition: WorkflowDefinition): void {
    if (!definition) {
      throw new BadRequestException('Workflow definition is required');
    }

    if (!Array.isArray(definition.nodes) || definition.nodes.length === 0) {
      throw new BadRequestException('Workflow must have at least one node');
    }

    if (!Array.isArray(definition.edges)) {
      throw new BadRequestException('Workflow edges must be an array');
    }

    const nodeIds = new Set<string>();
    const nodesById = new Map<string, WorkflowNode>();

    for (const node of definition.nodes) {
      if (!node.id || !node.name || !node.type) {
        throw new BadRequestException('Each node must have id, name, and type');
      }

      if (nodeIds.has(node.id)) {
        throw new BadRequestException(`Duplicate node id found: ${node.id}`);
      }

      nodeIds.add(node.id);
      nodesById.set(node.id, node);
    }

    for (const edge of definition.edges) {
      if (!edge.from || !edge.to) {
        throw new BadRequestException('Each edge must have from and to');
      }

      if (!nodeIds.has(edge.from)) {
        throw new BadRequestException(
          `Edge source node not found: ${edge.from}`,
        );
      }

      if (!nodeIds.has(edge.to)) {
        throw new BadRequestException(`Edge target node not found: ${edge.to}`);
      }

      if (edge.from === edge.to) {
        throw new BadRequestException(`Self-loop is not allowed: ${edge.from}`);
      }

      if (
        edge.condition !== undefined &&
        nodesById.get(edge.from)?.type !== 'condition'
      ) {
        throw new BadRequestException(
          `Conditional edge must start from a condition node: ${edge.from}`,
        );
      }
    }
  }
}
