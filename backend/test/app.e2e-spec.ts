import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../prisma/prisma.service';
import { AppModule } from '../src/app.module';
import { WorkflowExecutor } from '../src/modules/execution/engine/workflow.executor';

describe('FlowForge API (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let editorToken: string;
  let viewerToken: string;

  const workflowDefinition = {
    name: 'Webhook sync',
    timeout_ms: 30_000,
    nodes: [
      {
        id: 'fetch',
        name: 'Fetch',
        type: 'http',
        config: { url: 'https://example.test' },
      },
    ],
    edges: [],
  };

  const passwordHashPromise = bcrypt.hash('password123', 10);

  const createPrismaMock = async () => {
    const passwordHash = await passwordHashPromise;
    const users = {
      'admin@tenant1.local': {
        id: 'admin-1',
        tenantId: 'tenant-1',
        name: 'Admin',
        email: 'admin@tenant1.local',
        passwordHash,
        role: 'ADMIN',
        isActive: true,
        tenant: { id: 'tenant-1', name: 'Tenant One', slug: 'tenant1' },
      },
      'editor@tenant1.local': {
        id: 'editor-1',
        tenantId: 'tenant-1',
        name: 'Editor',
        email: 'editor@tenant1.local',
        passwordHash,
        role: 'EDITOR',
        isActive: true,
        tenant: { id: 'tenant-1', name: 'Tenant One', slug: 'tenant1' },
      },
      'viewer@tenant1.local': {
        id: 'viewer-1',
        tenantId: 'tenant-1',
        name: 'Viewer',
        email: 'viewer@tenant1.local',
        passwordHash,
        role: 'VIEWER',
        isActive: true,
        tenant: { id: 'tenant-1', name: 'Tenant One', slug: 'tenant1' },
      },
    };

    const workflow = {
      id: 'workflow-1',
      tenantId: 'tenant-1',
      name: 'Webhook sync',
      description: 'Sync incoming webhooks',
      status: WorkflowStatus.ACTIVE,
      currentVersionNo: 1,
      versions: [
        {
          id: 'version-1',
          workflowId: 'workflow-1',
          tenantId: 'tenant-1',
          versionNo: 1,
          definitionJson: workflowDefinition,
        },
      ],
    };

    const tx = {
      workflow: {
        create: jest.fn().mockResolvedValue(workflow),
        update: jest
          .fn()
          .mockResolvedValue({ ...workflow, currentVersionNo: 2 }),
      },
      workflowVersion: {
        create: jest.fn().mockResolvedValue(workflow.versions[0]),
      },
    };

    return {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $transaction: jest.fn((callback) => callback(tx)),
      user: {
        findUnique: jest.fn(({ where }) => users[where.email]),
      },
      workflow: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([workflow]),
        findFirst: jest.fn().mockResolvedValue(workflow),
        update: jest
          .fn()
          .mockResolvedValue({ ...workflow, currentVersionNo: 2 }),
        delete: jest.fn().mockResolvedValue(workflow),
      },
      workflowVersion: {
        findMany: jest.fn().mockResolvedValue(workflow.versions),
        findFirst: jest.fn().mockResolvedValue(workflow.versions[0]),
        create: jest.fn().mockResolvedValue(workflow.versions[0]),
      },
      workflowRun: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _avg: { durationMs: 0 } }),
      },
    };
  };

  beforeAll(async () => {
    const prismaMock = await createPrismaMock();
    const workflowExecutorMock = {
      executeWorkflow: jest.fn().mockResolvedValue({
        id: 'run-1',
        status: 'SUCCEEDED',
        triggerType: 'MANUAL',
      }),
      executeWebhookWorkflow: jest.fn().mockResolvedValue({
        id: 'run-2',
        status: 'SUCCEEDED',
        triggerType: 'WEBHOOK',
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(WorkflowExecutor)
      .useValue(workflowExecutorMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    adminToken = await login('admin@tenant1.local');
    editorToken = await login('editor@tenant1.local');
    viewerToken = await login('viewer@tenant1.local');
  });

  afterAll(async () => {
    await app.close();
  });

  const login = async (email: string) => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);

    return response.body.access_token;
  };

  it('protects local API docs with admin-only JWT access', async () => {
    await request(app.getHttpServer()).get('/docs/openapi.json').expect(401);

    await request(app.getHttpServer())
      .get('/docs/openapi.json')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);

    const response = await request(app.getHttpServer())
      .get('/docs/openapi.json')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.info.title).toBe('FlowForge API');
    expect(response.body.paths['/workflows']).toBeDefined();
  });

  it('allows editors to create valid workflows and rejects malformed DAGs', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        name: 'Webhook sync',
        status: 'ACTIVE',
        definition: workflowDefinition,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/workflows')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        name: 'Broken workflow',
        definition: {
          ...workflowDefinition,
          edges: [{ from: 'fetch', to: 'missing' }],
        },
      })
      .expect(400);
  });

  it('enforces viewer read-only access for workflow mutations', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        name: 'Denied workflow',
        definition: workflowDefinition,
      })
      .expect(403);

    const response = await request(app.getHttpServer())
      .get('/workflows?page=1&limit=10&status=ACTIVE&search=Webhook')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].tenantId).toBe('tenant-1');
  });

  it('supports version rollback and admin-only delete', async () => {
    await request(app.getHttpServer())
      .get('/workflows/workflow-1/versions')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/workflows/workflow-1/rollback/1')
      .set('Authorization', `Bearer ${editorToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .delete('/workflows/workflow-1')
      .set('Authorization', `Bearer ${editorToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete('/workflows/workflow-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('supports protected manual triggers and public webhook triggers', async () => {
    await request(app.getHttpServer())
      .post('/execution/trigger/workflow-1')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/execution/trigger/workflow-1')
      .set('Authorization', `Bearer ${editorToken}`)
      .expect(201);

    const webhookResponse = await request(app.getHttpServer())
      .post('/execution/webhook/tenant1/workflow-1')
      .send({ event: 'created' })
      .expect(201);

    expect(webhookResponse.body.triggerType).toBe('WEBHOOK');
  });
});
