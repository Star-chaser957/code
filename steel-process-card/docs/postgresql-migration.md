# SQLite 迁移到 PostgreSQL 手册

## 1. 目标

本文档用于把当前本地 `SQLite` 数据迁移到 `PostgreSQL`，为后续企业级部署和更高并发场景做准备。

当前项目已提供：
- PostgreSQL 建表脚本
- SQLite 到 PostgreSQL 的迁移脚本

相关文件：
- [schema.postgres.sql](d:\code\steel-process-card\server\db\schema.postgres.sql)
- [migrate-sqlite-to-postgres.ts](d:\code\steel-process-card\scripts\migrate-sqlite-to-postgres.ts)

## 2. 前置条件

需要准备：
- 可访问的 PostgreSQL 实例
- 一个空库，或允许脚本覆盖当前目标表
- 当前系统的 SQLite 数据文件

推荐 PostgreSQL 版本：
- `PostgreSQL 15+`

## 3. 环境变量

至少需要以下变量：

```env
SQLITE_FILE_PATH=server/data/process-cards.sqlite
POSTGRES_URL=postgres://username:password@127.0.0.1:5432/process_card
```

## 4. 安装依赖

```bash
npm install
```

## 5. 执行迁移

```bash
npm run db:migrate:postgres
```

脚本会执行这些动作：
1. 读取当前 SQLite 文件
2. 在 PostgreSQL 中执行 [schema.postgres.sql](d:\code\steel-process-card\server\db\schema.postgres.sql)
3. 清空目标表
4. 按表顺序导入历史数据

## 6. 迁移后建议检查

建议至少核对以下数据：
- `users`
- `process_cards`
- `card_operations`
- `operation_details`
- `process_card_approval_logs`
- `audit_logs`

建议 SQL：

```sql
SELECT COUNT(*) FROM process_cards;
SELECT COUNT(*) FROM card_operations;
SELECT COUNT(*) FROM operation_details;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM audit_logs;
```

## 7. 当前边界

本轮已完成：
- PostgreSQL schema
- SQLite 到 PostgreSQL 数据迁移脚本

本轮尚未完成：
- 服务运行时仓储层完全切换到 PostgreSQL

原因是当前仓储层仍大量依赖：
- SQLite 同步事务
- `GROUP_CONCAT`
- `INSERT OR REPLACE`
- `PRAGMA table_info`

因此更稳的升级路线是：
1. 先迁移数据到 PostgreSQL
2. 再逐步重构仓储层运行时
3. 完成后再正式切生产运行库
