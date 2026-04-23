import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

const apiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'FlowForge API',
    version: '1.0.0',
    description:
      'Admin-protected local API documentation for the FlowForge backend MVP.',
  },
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        summary: 'Login and receive a JWT access token',
        security: [],
      },
    },
    '/workflows': {
      get: {
        summary: 'List workflows with pagination and filtering',
        parameters: ['page', 'limit', 'status', 'search'],
      },
      post: {
        summary: 'Create workflow and initial version',
        roles: ['ADMIN', 'EDITOR'],
      },
    },
    '/workflows/{id}': {
      get: { summary: 'Get workflow with all versions' },
      put: {
        summary: 'Update workflow metadata or create a new definition version',
        roles: ['ADMIN', 'EDITOR'],
      },
      delete: {
        summary: 'Delete workflow',
        roles: ['ADMIN'],
      },
    },
    '/workflows/{id}/versions': {
      get: { summary: 'List workflow version history' },
    },
    '/workflows/{id}/rollback/{versionNo}': {
      post: {
        summary: 'Create a new version from a previous definition',
        roles: ['ADMIN', 'EDITOR'],
      },
    },
    '/execution/trigger/{workflowId}': {
      post: {
        summary: 'Manually trigger workflow execution',
        roles: ['ADMIN', 'EDITOR'],
      },
    },
    '/execution/webhook/{tenantSlug}/{workflowId}': {
      post: {
        summary: 'Webhook-triggered workflow execution',
        security: [],
      },
    },
    '/execution/runs/{runId}/events': {
      get: {
        summary:
          'Server-Sent Events stream for run and step status changes. Requires JWT and is tenant-scoped.',
      },
    },
    '/runs': {
      get: {
        summary: 'List workflow runs with pagination and filtering',
        parameters: ['page', 'limit', 'status', 'workflowId'],
      },
    },
    '/runs/{id}': {
      get: { summary: 'Get run detail with steps and logs' },
    },
    '/health': {
      get: {
        summary: 'Public liveness check',
        security: [],
      },
    },
    '/health/overview': {
      get: { summary: 'Tenant-scoped 24-hour execution metrics' },
    },
    '/ai/runs/{runId}/failure-analysis': {
      get: {
        summary:
          'Analyze a failed run and return likely cause plus suggested fix. Uses optional LLM when OPENAI_API_KEY is set, otherwise heuristic fallback.',
      },
    },
    '/docs': {
      get: {
        summary: 'Admin-only local HTML documentation',
        roles: ['ADMIN'],
      },
    },
    '/docs/openapi.json': {
      get: {
        summary: 'Admin-only local OpenAPI-like JSON documentation',
        roles: ['ADMIN'],
      },
    },
  },
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@Controller('docs')
export class ApiDocsController {
  @Get()
  @Header('Content-Type', 'text/html')
  getHtml() {
    const rows = Object.entries(apiSpec.paths)
      .map(([path, methods]) => {
        const methodRows = Object.entries(methods)
          .map(([method, metadata]: [string, any]) => {
            const roles = metadata.roles
              ? ` Roles: ${metadata.roles.join(', ')}`
              : '';
            return `<li><strong>${method.toUpperCase()}</strong> ${metadata.summary}${roles}</li>`;
          })
          .join('');

        return `<section><h2>${path}</h2><ul>${methodRows}</ul></section>`;
      })
      .join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>FlowForge API Docs</title>
  <style>
    body { font-family: sans-serif; margin: 40px; color: #172033; }
    h1 { margin-bottom: 4px; }
    section { border-top: 1px solid #d9dee8; padding: 14px 0; }
    h2 { font-size: 16px; color: #0f5f6f; }
    li { margin: 6px 0; }
    code { background: #eef3f7; padding: 2px 5px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>FlowForge API Docs</h1>
  <p>Protected local docs. Use <code>Authorization: Bearer &lt;ADMIN_JWT&gt;</code>.</p>
  <p>JSON spec: <code>GET /docs/openapi.json</code></p>
  ${rows}
</body>
</html>`;
  }

  @Get('openapi.json')
  getJson() {
    return apiSpec;
  }
}
