# 生产工艺卡系统

轻量型内部生产工艺卡管理系统，当前已覆盖：

- 工艺卡列表查询
- 新建 / 编辑 / 审批
- 工序动态启用
- 热处理多条明细
- 打印预览与 PDF 导出
- 工作台统计、账号管理、操作日志

## 本地运行

```bash
npm install
npm run dev
```

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

## 环境变量

项目已支持通过 `.env` 管理运行配置，请先复制模板：

```bash
cp .env.example .env
```

常用配置项：

- `DB_CLIENT`
- `HOST`
- `PORT`
- `CORS_ORIGIN`
- `SQLITE_FILE_PATH`
 - `POSTGRES_URL`
- `SESSION_TTL_HOURS`
- `SEED_DEFAULT_USERS`
- `SEED_DEMO_CARD`
- `VITE_API_BASE`

## 生产构建

```bash
npm run build
npm run start
```

切换到 PostgreSQL 运行时示例：

```env
DB_CLIENT=postgres
POSTGRES_URL=postgres://postgres:password@127.0.0.1:5432/process_card
```

## PostgreSQL 迁移

项目已补充 PostgreSQL 迁移资产：

```bash
npm run db:migrate:postgres
```

相关文档：

- [PostgreSQL 迁移手册](d:\code\steel-process-card\docs\postgresql-migration.md)
- [PostgreSQL 建表脚本](d:\code\steel-process-card\server\db\schema.postgres.sql)

## 技术栈

- 前端：React 19 + TypeScript + Vite + React Router
- 后端：Fastify + TypeScript
- 图表：Chart.js + react-chartjs-2
- 数据存储：SQLite 文件模型 + `sql.js`
- 打印：HTML 打印模板 + 浏览器打印 / PDF

## 主要文档

- [系统设计方案](d:\code\steel-process-card\docs\system-design.md)
- [企业级技术与部署说明](d:\code\steel-process-card\docs\enterprise-deployment-and-integration.md)
- [接口手册](d:\code\steel-process-card\docs\api-handbook.md)
- [部署与运维手册](d:\code\steel-process-card\docs\deployment-runbook.md)
- [PostgreSQL 迁移手册](d:\code\steel-process-card\docs\postgresql-migration.md)

## 部署模板

- [Nginx 模板](d:\code\steel-process-card\deploy\nginx.conf)
- [systemd 服务模板](d:\code\steel-process-card\deploy\steel-process-card.service)
- [Docker Compose 模板](d:\code\steel-process-card\deploy\docker-compose.yml)
- [Docker 重发版脚本](d:\code\steel-process-card\deploy\redeploy-app.sh)
- [Windows 一键部署脚本](d:\code\steel-process-card\scripts\deploy-to-ubuntu-docker.ps1)
- [Linux 备份脚本](d:\code\steel-process-card\scripts\backup-db.sh)
- [Windows 备份脚本](d:\code\steel-process-card\scripts\backup-db.ps1)
