# 生产工艺卡系统部署与运维手册

## 1. 适用范围

本文档用于指导系统在企业局域网或服务器环境中的部署、升级、备份和基本运维。

推荐部署目标：
- Ubuntu Server 22.04 / 24.04 LTS
- Node.js 22 LTS
- Nginx
- systemd

## 2. 目录建议

推荐部署目录：

```text
/home/xhs/apps/steel-process-card
```

推荐日志目录：

```text
/var/log/steel-process-card
```

## 3. 首次部署

### 3.1 安装依赖

```bash
sudo apt update
sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3.2 部署代码

```bash
cd /home/xhs/apps
git clone https://github.com/Star-chaser957/code.git steel-process-card
cd steel-process-card
npm install
npm run build
```

### 3.3 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

建议生产环境至少调整：
- `NODE_ENV=production`
- `CORS_ORIGIN` 为明确域名或内网地址
- `SEED_DEMO_CARD=false`
- 默认账号上线后尽快改密

### 3.4 启动服务

```bash
npm run start
```

## 4. systemd 配置

项目已提供模板：

- [deploy/steel-process-card.service](d:\code\steel-process-card\deploy\steel-process-card.service)

部署步骤：

```bash
sudo mkdir -p /var/log/steel-process-card
sudo cp deploy/steel-process-card.service /etc/systemd/system/steel-process-card.service
sudo systemctl daemon-reload
sudo systemctl enable steel-process-card
sudo systemctl start steel-process-card
```

常用命令：

```bash
sudo systemctl status steel-process-card
sudo systemctl restart steel-process-card
sudo journalctl -u steel-process-card -n 100 --no-pager
```

## 5. Nginx 配置

项目已提供模板：

- [deploy/nginx.conf](d:\code\steel-process-card\deploy\nginx.conf)

部署步骤：

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/steel-process-card
sudo ln -s /etc/nginx/sites-available/steel-process-card /etc/nginx/sites-enabled/steel-process-card
sudo nginx -t
sudo systemctl reload nginx
```

## 6. 备份

### 6.1 SQLite 备份

Linux 备份脚本：
- [scripts/backup-db.sh](d:\code\steel-process-card\scripts\backup-db.sh)

Windows 备份脚本：
- [scripts/backup-db.ps1](d:\code\steel-process-card\scripts\backup-db.ps1)

Linux 定时任务示例：

```bash
0 2 * * * /home/xhs/apps/steel-process-card/scripts/backup-db.sh >> /var/log/steel-process-card/backup.log 2>&1
```

建议策略：
- 每天至少备份一次
- 保留 7 到 30 天
- 备份到独立磁盘或共享存储

## 7. 升级流程

建议升级步骤：

```bash
cd /home/xhs/apps/steel-process-card
git pull origin main
npm install
npm run build
sudo systemctl restart steel-process-card
```

升级前建议：
- 先备份数据库
- 确认 `.env` 未被覆盖
- 在测试环境验证审批、打印和导出功能

## 8. 监控建议

至少监控：
- Node 服务在线状态
- Nginx 状态
- CPU / 内存
- 磁盘空间
- 数据库文件大小
- 最近 24 小时错误日志

## 9. 安全建议

- 生产环境关闭演示数据：`SEED_DEMO_CARD=false`
- 默认账号上线后立即修改密码
- 限制管理员数量
- 如条件允许，局域网也启用 HTTPS
- 定期导出并审查操作日志

## 10. 生产化下一步

如果进入更大范围使用，建议优先推进：
- 迁移 PostgreSQL
- 加统一日志采集
- 做 HTTPS 与内网域名
- 增加密码修改与账号策略
- 增加服务端 PDF 能力

## 11. PostgreSQL 迁移入口

如果准备把历史 SQLite 数据迁移到 PostgreSQL，请参考：

- [PostgreSQL 迁移手册](d:\code\steel-process-card\docs\postgresql-migration.md)

执行命令：

```bash
npm run db:migrate:postgres
```
