# 生产工艺卡系统企业级技术与部署说明

## 1. 文档目的

本文档用于说明当前《生产工艺卡系统》的：

- 技术栈与系统架构
- 企业级部署建议
- 运维与安全建议
- 对接外部系统时需要提供的接口手册与约定
- 后续扩展为正式生产系统时的演进建议

适用对象：

- 企业内部 IT/运维人员
- 项目实施人员
- 第三方系统对接方
- 后续接手维护的开发团队

---

## 2. 当前项目技术栈

### 2.1 前端

- 框架：React 19
- 语言：TypeScript
- 构建工具：Vite 8
- 路由：React Router 7
- 图表：Chart.js + react-chartjs-2
- 打印导出：
  - HTML 打印模板
  - 浏览器打印
  - `html2canvas` + `jsPDF` + `JSZip` 用于批量导出

### 2.2 后端

- 运行时：Node.js
- 框架：Fastify 5
- 语言：TypeScript
- 参数校验：Zod
- 静态资源：@fastify/static
- 跨域：@fastify/cors

### 2.3 数据存储

- 当前实现：SQLite 文件模型 + `sql.js`
- 数据文件位置：
  - [process-cards.sqlite](d:\code\steel-process-card\server\data\process-cards.sqlite)
- Schema 文件：
  - [schema.sql](d:\code\steel-process-card\server\db\schema.sql)

### 2.4 当前目录结构

```text
shared/   共享类型、工序目录、常量
server/   Fastify 服务、路由、仓储层、数据库 schema
src/      React 页面、组件、样式、打印模板
docs/     项目设计与部署文档
public/   logo、favicon 等静态资源
```

---

## 3. 当前系统架构说明

### 3.1 架构特点

当前系统为前后端分离开发、单体应用部署模式：

- 开发环境：
  - 前端 Vite 开发服务器
  - 后端 Fastify API
- 生产部署：
  - 后端可同时托管构建后的前端静态文件
  - 最终可由一个 Node 进程 + 一个反向代理完成部署

### 3.2 主要业务模块

- 工作台
- 工艺卡列表
- 新建/编辑工艺卡
- 打印预览 / PDF 导出
- 审批流程
- 生产部门设置
- 账号管理
- 操作日志

### 3.3 核心数据模型

核心表如下：

- `process_cards`
  - 工艺卡主表
- `card_operations`
  - 工艺卡启用工序实例
- `operation_details`
  - 工序明细/参数
- `operation_definitions`
  - 工序定义
- `operation_option_definitions`
  - 工序选项定义
- `department_options`
  - 生产部门字典
- `users`
  - 用户账号
- `user_roles`
  - 流程角色
- `sessions`
  - 登录会话
- `process_card_approval_logs`
  - 审批日志
- `audit_logs`
  - 完整系统操作日志

---

## 4. 当前项目适合的部署方式

### 4.1 推荐部署模式

推荐企业内网部署方式：

- 操作系统：Ubuntu Server 22.04/24.04 LTS
- 运行环境：Node.js 22 LTS
- 反向代理：Nginx
- 进程管理：systemd 或 PM2
- 数据库：
  - 小规模内网使用可先保留 SQLite
  - 正式企业级建议迁移 PostgreSQL

### 4.2 为什么推荐 Linux

- 部署简单稳定
- 日志与守护管理成熟
- 反向代理与 HTTPS 配置方便
- 便于做自动备份与定时任务
- 长期运行成本低于 Windows Server

### 4.3 当前规模建议

如果系统仅用于 1 到 10 人内网协作：

- CPU：2 核
- 内存：4GB
- 磁盘：40GB+

如果后续扩展到多部门协同：

- CPU：4 核
- 内存：8GB+
- 数据库迁移到 PostgreSQL

---

## 5. 企业级部署建议

### 5.1 最小生产环境建议

建议采用：

- `Nginx`
  - 对外提供 `80/443`
  - 反向代理到 Node 服务
- `Node.js`
  - 应用服务监听内网端口，如 `3001`
- `systemd`
  - 保证开机自启
  - 保证服务异常后自动拉起

### 5.2 推荐部署拓扑

```text
用户浏览器
   ↓
Nginx
   ↓
Fastify / Node.js
   ↓
SQLite（当前）或 PostgreSQL（建议演进）
```

### 5.3 当前项目的生产启动方式

构建：

```bash
npm install
npm run build
```

启动：

```bash
npm run start
```

### 5.4 Nginx 反向代理建议

建议外部统一访问：

```text
http://process-card.local
或
http://192.168.x.x
```

不要直接让用户访问 `3001` 端口。

---

## 6. 企业级安全建议

### 6.1 账号安全

建议尽快补齐：

- 强密码规则
- 首次登录修改密码
- 定期修改密码
- 停用账号自动踢出会话
- 管理员账号最少数量控制

### 6.2 访问安全

建议：

- 局域网内也使用 HTTPS
- 反向代理层控制允许访问的网段
- 对关键管理接口开启审计

### 6.3 审计建议

当前系统已经具备：

- 登录日志
- 工艺卡新建/编辑/删除日志
- 审批日志
- 字典修改日志
- 账号管理日志
- 关键字段前后变化记录

建议对审计日志：

- 保留至少 1 年
- 支持导出
- 限制仅管理员可查看

---

## 7. 数据库与存储建议

### 7.1 当前状态

当前项目使用：

- `sql.js` + SQLite 文件持久化

优点：

- 轻量
- 便于快速部署
- 适合小规模内部系统

不足：

- 并发写入能力有限
- 不适合多人高频并发
- 不适合作为中大型企业系统长期核心数据库

### 7.2 企业级建议

正式企业级建议升级为：

- PostgreSQL

原因：

- 并发能力更强
- 事务一致性更稳定
- 适合审计、统计和对接场景
- 便于做备份、主从、迁移与 BI 报表

### 7.3 迁移建议

推荐路线：

1. 先保持当前业务逻辑不变
2. 替换仓储层数据库实现
3. 将 SQLite Schema 迁移为 PostgreSQL DDL
4. 对审计、统计查询做索引优化

---

## 8. 运维建议

### 8.1 日志

建议将日志分为：

- 应用运行日志
- 错误日志
- 审计日志

当前系统的业务操作审计日志已经在数据库中留痕。  
建议运维层另外保留：

- Node stdout/stderr
- Nginx access/error

### 8.2 备份

当前若仍使用 SQLite，必须至少做：

- 每日自动备份数据库文件
- 保留 7 到 30 天
- 备份到独立目录或共享存储

如果改用 PostgreSQL：

- 建议做逻辑备份 + 定时快照备份

### 8.3 监控

建议最少监控：

- 服务在线状态
- CPU / 内存
- 磁盘空间
- 数据库文件大小
- 近 24 小时错误次数

---

## 9. 对接其他系统时的建议

### 9.1 建议的对接方式

如果本系统需要与 ERP、MES、PLM、OA 或数据中台对接，建议采用：

- REST API 对接
- Bearer Token 鉴权
- JSON 数据格式

如果后续需要事件驱动：

- 可增加 Webhook
- 或增加消息队列（如 RabbitMQ / Kafka）

### 9.2 建议的对接边界

推荐对接范围：

- 主数据同步
  - 客户代码
  - 产品名称
  - 材质
  - 规格
- 工艺卡主数据查询
- 工艺卡审批状态同步
- 工艺卡打印 PDF 获取
- 审批完成事件通知

不建议一开始就深度耦合：

- 不要让外部系统直接改底层库
- 不要绕过本系统审批逻辑直接写单据
- 不要直接共享 SQLite 文件

---

## 10. 当前接口总览

### 10.1 认证接口

前缀：`/api/auth`

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### 10.2 工作台接口

前缀：`/api/dashboard`

- `GET /api/dashboard/overview`

### 10.3 元数据接口

前缀：`/api/meta`

- `GET /api/meta/operations`
- `GET /api/meta/departments`
- `PUT /api/meta/departments`
- `GET /api/meta/users`

### 10.4 工艺卡接口

前缀：`/api/process-cards`

- `GET /api/process-cards`
- `GET /api/process-cards/:id`
- `POST /api/process-cards`
- `PUT /api/process-cards/:id`
- `POST /api/process-cards/:id/actions`
- `DELETE /api/process-cards/:id`
- `POST /api/process-cards/:id/void`
- `DELETE /api/process-cards/:id/force`
- `GET /api/process-cards/prefill/by-product-name`
- `POST /api/process-cards/export/batch`

### 10.5 管理接口

前缀：`/api/admin`

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:id`
- `POST /api/admin/users/:id/reset-password`
- `PATCH /api/admin/users/:id/active`
- `GET /api/admin/audit-logs`

---

## 11. 对接方接口使用说明

### 11.1 鉴权方式

登录成功后会返回：

- `token`
- `user`

后续请求头带：

```http
Authorization: Bearer <token>
```

### 11.2 登录示例

请求：

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

返回：

```json
{
  "token": "xxxxxx",
  "user": {
    "id": "user-id",
    "username": "admin",
    "displayName": "系统管理员",
    "role": "admin",
    "workflowRoles": ["prepare", "confirm", "review", "approve"],
    "isActive": true
  }
}
```

### 11.3 工艺卡列表查询示例

```http
GET /api/process-cards?planNumber=XM260331&status=pending_review
Authorization: Bearer <token>
```

### 11.4 工艺卡详情示例

```http
GET /api/process-cards/{id}
Authorization: Bearer <token>
```

### 11.5 审批动作示例

```http
POST /api/process-cards/{id}/actions
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "submit_review",
  "comment": "确认无误"
}
```

可用动作包括：

- `submit_confirm`
- `return_prepare`
- `submit_review`
- `reject_to_prepare`
- `reject_to_confirm`
- `submit_approve`
- `reject_to_review`
- `approve`

### 11.6 作废与强制删除

管理员可调用：

```http
POST /api/process-cards/{id}/void
DELETE /api/process-cards/{id}/force
```

建议：

- 正式业务单据优先使用“作废”
- 仅测试数据或误建数据使用“强制删除”

---

## 12. 提供给第三方对接方的最小资料清单

如果你要让对方系统来对接，建议至少提供以下资料：

### 12.1 基础资料

- 系统名称
- 部署地址
- 测试环境地址
- 鉴权方式
- 联调账号
- 接口文档
- 状态码说明

### 12.2 数据字典

建议提供：

- 工艺卡状态枚举
- 审批动作枚举
- 用户角色枚举
- 流程角色枚举
- 工序编码与工序名称对应表

### 12.3 错误码建议

当前系统主要返回 HTTP 状态码和 message。  
企业级建议后续统一补充：

- `code`
- `message`
- `details`
- `traceId`

例如：

```json
{
  "code": "CARD_NOT_FOUND",
  "message": "工艺卡不存在",
  "details": null,
  "traceId": "..."
}
```

---

## 13. 企业级演进建议

### 13.1 短期建议

- 增加操作日志导出
- 增加用户修改自己密码
- 增加消息提醒与待办角标
- 统计卡片支持点击跳转列表筛选结果

### 13.2 中期建议

- 将数据库迁移到 PostgreSQL
- 增加组织/部门维度
- 增加工艺卡版本控制
- 增加工艺卡复制/归档策略
- 增加统一错误码和 traceId

### 13.3 长期建议

- 增加单点登录（SSO）
- 增加 Webhook / MQ 消息对接
- 增加 BI 报表与数据中台接口
- 增加电子签名或更严谨的审批审计机制

---

## 14. 结论

当前系统已经具备中小规模企业内部上线的基础条件：

- 业务结构完整
- 审批链路明确
- 打印模板独立
- 管理功能可用
- 审计留痕具备基础能力

如果要按企业级标准长期运行，最优先的升级方向是：

1. 数据库升级到 PostgreSQL
2. 部署到 Linux + Nginx + systemd
3. 增强安全与运维监控
4. 统一接口规范与对接文档
5. 增强消息、统计和外部集成能力

