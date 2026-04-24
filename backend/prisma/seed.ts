import 'dotenv/config';
import {
    PostStatus,
    PrismaClient,
    UserRole,
    WorkflowStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
    adapter,
});

async function main() {
    const password = 'password123';
    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.upsert({
        where: { slug: 'tenant1' },
        update: {},
        create: {
            name: 'Tenant One',
            slug: 'tenant1',
        },
    });

    const users = [
        {
            name: 'Admin Tenant One',
            email: 'admin@tenant1.local',
            role: UserRole.ADMIN,
        },
        {
            name: 'Editor Tenant One',
            email: 'editor@tenant1.local',
            role: UserRole.EDITOR,
        },
        {
            name: 'Writer Tenant One',
            email: 'user@tenant1.local',
            role: UserRole.USER,
        },
    ];

    for (const user of users) {
        await prisma.user.upsert({
            where: { email: user.email },
            update: {
                name: user.name,
                role: user.role,
                tenantId: tenant.id,
                passwordHash,
                isActive: true,
            },
            create: {
                name: user.name,
                email: user.email,
                role: user.role,
                tenantId: tenant.id,
                passwordHash,
                isActive: true,
            },
        });
    }

    const admin = await prisma.user.findUnique({
        where: { email: 'admin@tenant1.local' },
    });

    if (admin) {
        const editor = await prisma.user.findUnique({
            where: { email: 'editor@tenant1.local' },
        });

        const existingWorkflow = await prisma.workflow.findFirst({
            where: {
                tenantId: tenant.id,
                name: 'Sample Workflow',
            },
        });

        if (!existingWorkflow) {
            const workflow = await prisma.workflow.create({
                data: {
                    tenantId: tenant.id,
                    name: 'Sample Workflow',
                    description: 'Seeded sample workflow',
                    status: WorkflowStatus.DRAFT,
                    currentVersionNo: 1,
                    createdById: admin.id,
                    updatedById: admin.id,
                },
            });

            await prisma.workflowVersion.create({
                data: {
                    workflowId: workflow.id,
                    tenantId: tenant.id,
                    versionNo: 1,
                    createdById: admin.id,
                    definitionJson: {
                        name: 'Sample Workflow',
                        timeout_ms: 300000,
                        nodes: [
                            {
                                id: 'step1',
                                name: 'Fetch Users',
                                type: 'http',
                                config: {
                                    method: 'GET',
                                    url: 'https://jsonplaceholder.typicode.com/users',
                                },
                                retry: {
                                    max_attempts: 3,
                                    backoff_ms: 1000,
                                },
                            },
                            {
                                id: 'step2',
                                name: 'Wait',
                                type: 'delay',
                                config: {
                                    ms: 2000,
                                },
                            },
                        ],
                        edges: [{ from: 'step1', to: 'step2' }],
                    },
                },
            });
        }

        const blogSeed = [
            {
                title: 'FlowForge Blogger is Live',
                slug: 'flowforge-blogger-is-live',
                excerpt: 'Landing page baru, role moderation, dan publishing workflow editorial.',
                content:
                    'FlowForge sekarang punya mode blogger dengan landing page publik, register user, dan editorial review sebelum posting terbit. Admin mengatur role, editor menangani publikasi, dan user tetap bisa menulis dari dashboard mereka.',
                status: PostStatus.PUBLISHED,
                authorId: admin.id,
                reviewerId: admin.id,
                publishedAt: new Date(),
                reviewedAt: new Date(),
            },
            editor
                ? {
                      title: 'Editorial Desk Checklist',
                      slug: 'editorial-desk-checklist',
                      excerpt: 'Template moderasi untuk editor sebelum menerbitkan tulisan user.',
                      content:
                          'Editor bisa meninjau draft yang masuk, memastikan slug rapi, merapikan excerpt, lalu menerbitkan konten tanpa menunggu admin. Ini menjaga kualitas blog tetap konsisten sambil mempercepat publishing.',
                      status: PostStatus.PUBLISHED,
                      authorId: editor.id,
                      reviewerId: editor.id,
                      publishedAt: new Date(),
                      reviewedAt: new Date(),
                  }
                : null,
        ].filter(Boolean) as Array<{
            title: string;
            slug: string;
            excerpt: string;
            content: string;
            status: PostStatus;
            authorId: string;
            reviewerId: string;
            publishedAt: Date;
            reviewedAt: Date;
        }>;

        for (const post of blogSeed) {
            await prisma.post.upsert({
                where: {
                    tenantId_slug: {
                        tenantId: tenant.id,
                        slug: post.slug,
                    },
                },
                update: {
                    ...post,
                },
                create: {
                    tenantId: tenant.id,
                    ...post,
                },
            });
        }
    }

    console.log('Seed completed.');
    console.log('Demo users:');
    console.log('admin@tenant1.local / password123');
    console.log('editor@tenant1.local / password123');
    console.log('user@tenant1.local / password123');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
