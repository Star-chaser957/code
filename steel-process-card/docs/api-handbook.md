# 生产工艺卡系统接口手册

## 1. 文档范围

本文档用于给第三方系统、实施人员和后续维护人员说明当前系统的接口边界、调用方式和对接注意事项。

适用对象：
- ERP / MES / OA / BI 对接方
- 企业内部 IT 与实施团队
- 后续接手开发的维护人员

## 2. 基础说明

- 接口前缀：`/api`
- 数据格式：`application/json`
- 鉴权方式：`Authorization: Bearer <token>`
- 字符编码：`UTF-8`

推荐响应约定：
- 成功：HTTP `200`
- 未认证：HTTP `401`
- 无权限：HTTP `403`
- 参数错误：HTTP `400`
- 资源不存在：HTTP `404`
- 服务异常：HTTP `500`

## 3. 鉴权接口

### 3.1 登录

- `POST /api/auth/login`

请求示例：

```json
{
  "username": "admin",
  "password": "admin123"
}
```

响应示例：

```json
{
  "token": "session-token",
  "user": {
    "id": "user-id",
    "username": "admin",
    "displayName": "系统管理员",
    "role": "admin",
    "workflowRoles": ["prepare", "confirm", "review", "approve"]
  }
}
```

### 3.2 获取当前登录人

- `GET /api/auth/me`

### 3.3 退出登录

- `POST /api/auth/logout`

## 4. 工作台接口

### 4.1 获取工作台总览

- `GET /api/dashboard/overview`

返回内容包括：
- 我的待办统计
- 最近 7 天新增趋势
- 状态分布
- 最近流程动态

## 5. 基础元数据接口

### 5.1 获取工序定义

- `GET /api/meta/operations`

### 5.2 获取生产部门字典

- `GET /api/meta/departments`

### 5.3 保存生产部门字典

- `PUT /api/meta/departments`

权限要求：
- 管理员

### 5.4 获取用户摘要

- `GET /api/meta/users`

用途：
- 工艺卡中选择确认人、审核人、批准人

## 6. 工艺卡接口

### 6.1 列表查询

- `GET /api/process-cards`

常用查询参数：
- `keyword`
- `planNumber`
- `customerCode`
- `productName`
- `material`
- `specification`
- `deliveryDate`
- `status`
- `operationCode`
- `heatTreatmentType`

### 6.2 获取详情

- `GET /api/process-cards/:id`

### 6.3 根据产品名称获取带入候选

- `GET /api/process-cards/prefill/by-product-name?productName=...`

### 6.4 新建工艺卡

- `POST /api/process-cards`

### 6.5 保存工艺卡

- `PUT /api/process-cards/:id`

### 6.6 审批动作

- `POST /api/process-cards/:id/actions`

请求示例：

```json
{
  "action": "submit_review",
  "comment": "确认完成，提交审核。"
}
```

支持动作：
- `submit_confirm`
- `return_prepare`
- `submit_review`
- `reject_to_prepare`
- `reject_to_confirm`
- `submit_approve`
- `reject_to_review`
- `approve`

### 6.7 普通删除

- `DELETE /api/process-cards/:id`

### 6.8 管理员作废

- `POST /api/process-cards/:id/void`

### 6.9 管理员强制删除

- `DELETE /api/process-cards/:id/force`

### 6.10 批量导出准备

- `POST /api/process-cards/export/batch`

用途：
- 返回批量导出的工艺卡打印链接与导出提示

## 7. 管理接口

### 7.1 用户列表

- `GET /api/admin/users`

### 7.2 新增用户

- `POST /api/admin/users`

### 7.3 更新用户

- `PUT /api/admin/users/:id`

### 7.4 重置密码

- `POST /api/admin/users/:id/reset-password`

### 7.5 启用/停用账号

- `PATCH /api/admin/users/:id/active`

### 7.6 查询操作日志

- `GET /api/admin/audit-logs`

常用参数：
- `category`
- `actorUserId`
- `keyword`

## 8. 对接建议

如果其他系统需要集成，建议优先采用以下方式：

1. 只对接查询与新增，不直接跨系统改审批状态
2. 审批动作仍由本系统主导，避免双向状态冲突
3. 计划单号、客户代码、产品名称等字段作为主匹配键
4. 外部系统通过接口同步业务数据，不直接写数据库

## 9. 版本与兼容建议

- 对外接口建议加版本前缀，例如 `/api/v1/...`
- 对接字段变更前应先发布变更通知
- 审批状态枚举、工序编码、日志分类等应保持稳定
