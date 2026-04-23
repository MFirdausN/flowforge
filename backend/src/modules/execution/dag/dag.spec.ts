import { BadRequestException } from '@nestjs/common';
import { CycleDetector } from './cycle-detector';
import { DagValidator } from './dag.validator';
import { WorkflowDefinition } from './dag.types';
import { TopologicalSort } from './topological-sort';

describe('DAG utilities', () => {
  const validDefinition: WorkflowDefinition = {
    name: 'Valid workflow',
    timeout_ms: 30_000,
    nodes: [
      { id: 'start', name: 'Start', type: 'delay', config: { ms: 1 } },
      { id: 'branch-a', name: 'Branch A', type: 'delay', config: { ms: 1 } },
      { id: 'branch-b', name: 'Branch B', type: 'delay', config: { ms: 1 } },
      { id: 'join', name: 'Join', type: 'delay', config: { ms: 1 } },
    ],
    edges: [
      { from: 'start', to: 'branch-a' },
      { from: 'start', to: 'branch-b' },
      { from: 'branch-a', to: 'join' },
      { from: 'branch-b', to: 'join' },
    ],
  };

  it('validates a well-formed DAG definition', () => {
    expect(() => new DagValidator().validate(validDefinition)).not.toThrow();
  });

  it('rejects duplicate node ids and missing edge targets', () => {
    const duplicateNode: WorkflowDefinition = {
      ...validDefinition,
      nodes: [
        ...validDefinition.nodes,
        { id: 'start', name: 'Duplicate', type: 'delay', config: {} },
      ],
    };

    expect(() => new DagValidator().validate(duplicateNode)).toThrow(
      BadRequestException,
    );

    const danglingEdge: WorkflowDefinition = {
      ...validDefinition,
      edges: [{ from: 'start', to: 'missing' }],
    };

    expect(() => new DagValidator().validate(danglingEdge)).toThrow(
      BadRequestException,
    );
  });

  it('detects cycles before execution', () => {
    const cyclicDefinition: WorkflowDefinition = {
      ...validDefinition,
      edges: [
        { from: 'start', to: 'branch-a' },
        { from: 'branch-a', to: 'join' },
        { from: 'join', to: 'start' },
      ],
    };

    expect(() => new CycleDetector().detect(cyclicDefinition)).toThrow(
      BadRequestException,
    );
  });

  it('sorts dependencies before dependents', () => {
    const sorted = new TopologicalSort().sort(validDefinition);
    const indexById = new Map(sorted.map((node, index) => [node.id, index]));

    for (const edge of validDefinition.edges) {
      expect(indexById.get(edge.from)).toBeLessThan(indexById.get(edge.to)!);
    }
  });
});
