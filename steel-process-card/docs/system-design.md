# 需求理解摘要

系统目标是把纸质《钢棒/型钢生产工艺卡》改造成内部轻量线上系统，核心不是审批，而是录入更快、查询更准、打印更稳。

- 使用人数少，不做复杂权限和流程。
- 录入页优先考虑填写体验，不照搬纸面。
- 打印页单独设计，按 A4 竖版、单页优先还原原表。
- 工序按“按需启用”建模，不要求每张卡启用全部工序。
- 热处理必须支持多条明细，每条明细独立参数。

# 系统功能模块划分

1. 工艺卡列表模块
   支持关键字、计划单号、客户代码、产品名称、材质、规格、交付日期、工序、热处理类型筛选。
2. 工艺卡编辑模块
   包含主信息、工序启用栏、工序卡片编辑区、签字备注区。
3. 打印 / PDF 模块
   使用独立打印模板，支持浏览器打印和另存为 PDF。
4. 基础配置模块
   工序定义、工艺方式字典、字段配置统一保存在后端与数据库初始化数据中。

# 数据库表设计

## 1. `process_cards`

主信息与签字信息。

- `id`
- `card_no`
- `plan_number`
- `customer_code`
- `order_date`
- `product_name`
- `material`
- `specification`
- `quantity`
- `delivery_date`
- `delivery_status`
- `standard`
- `technical_requirements`
- `remark`
- `prepared_by / prepared_date`
- `confirmed_by / confirmed_date`
- `reviewed_by / reviewed_date`
- `approved_by / approved_date`
- `created_at / updated_at`

## 2. `operation_definitions`

系统支持的工序主数据。

- `code`
- `name`
- `default_order`
- `detail_mode`
- `allows_multiple_details`
- `detail_label`
- `field_config_json`

## 3. `operation_option_definitions`

工艺/制造方式、检验项目、热处理类型等可维护字典。

- `operation_code`
- `option_code`
- `label`
- `sort_order`

## 4. `card_operations`

某张工艺卡实际启用的工序实例。

- `id`
- `card_id`
- `operation_code`
- `sort_order`
- `enabled`
- `department`
- `special_characteristic`
- `delivery_time`
- `other_requirements`
- `remark`

## 5. `card_operation_selected_options`

保存某工序勾选了哪些字典项。

- `id`
- `card_operation_id`
- `option_code`

## 6. `operation_details`

保存结构化参数与多明细。

- `id`
- `card_operation_id`
- `detail_seq`
- `detail_type`
- `display_text`
- `params_json`

# 页面设计方案

## 工艺卡列表页

- 顶部操作区：新建、批量导出。
- 中部筛选区：关键字、业务字段、工序、热处理类型。
- 底部表格区：编辑、打印、删除、批量勾选。

## 新建 / 编辑页

- 主信息区：先录基本单据信息。
- 工序启用区：以按钮形式勾选启用工序。
- 工序卡片区：每道工序独立面板，支持顺序调整。
- 热处理卡片：支持新增 / 删除多条处理明细。
- 签字备注区：普通字段，不做流程。

## 打印预览页

- 顶部工具条：返回编辑、浏览器打印 / 导出 PDF。
- 打印内容区：按纸质表结构分为抬头、主信息、工艺流程表、包装与签字区。

# 接口设计

## 已实现接口

- `GET /api/meta/operations`
- `GET /api/process-cards`
- `GET /api/process-cards/:id`
- `POST /api/process-cards`
- `PUT /api/process-cards/:id`
- `DELETE /api/process-cards/:id`
- `POST /api/process-cards/export/batch`

## 返回原则

- 列表接口返回结构化工序与热处理检索字段。
- 详情接口返回完整主表 + 工序实例 + 选项 + 多条明细。
- 批量导出接口返回打印页地址，由前端统一调用浏览器打印。

# 打印 / PDF 方案

- 打印页与录入页分离，不直接打印编辑表单。
- 使用固定宽度 A4 HTML 模板。
- 工序表按原纸质卡七列表格组织。
- 所有工序行默认显示，未启用工序以未勾选状态展示，尽量贴近原表。
- 热处理在“工艺/制造”列显示各类型，在“质量要求”列逐条显示温度 / 时长 / 冷却 / 性能。
- 包装、签字、备注单独放在底部，压缩进同一页。
- MVP 导出方式采用浏览器打印和“另存为 PDF”。

# MVP 开发计划

## 第一阶段已覆盖

- 工艺卡录入
- 工序动态启用
- 热处理多明细
- 检验多选
- 基础列表查询
- 单张打印预览
- 浏览器导出 PDF
- 批量打开打印页

## 第二阶段建议

- 服务端 PDF 批量合并导出
- 字典配置维护页面
- Excel 导入历史卡片
- 打印模板字号 / 行高自适应优化

# 风险点与注意事项

- 热处理如果继续扩展更多参数，建议把 `params_json` 逐步拆成更强结构化字段。
- 当前批量 PDF 采用浏览器侧导出，若要真正后端生成 PDF，需要引入无头浏览器或专业 PDF 引擎。
- 打印单页效果依赖实际内容密度，超长技术要求或备注可能仍会触发分页，需要后续加超长内容控制策略。
