import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import type { DashboardOverview, ProcessCardListItem } from '../../shared/types';
import { CARD_STATUS_LABELS } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

type DashboardMode = 'admin' | 'prepare' | 'confirm' | 'review' | 'approve' | 'viewer';

type ShortcutItem = {
  title: string;
  description: string;
  to: string;
};

type FocusCardItem = {
  id: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  actionLabel: string;
  to: string;
  updatedAt: string;
};

type DashboardModeConfig = {
  badge: string;
  heading: string;
  description: string;
  highlightLabel: string;
  highlightDescription: string;
  highlightValue: number;
  taskCards: Array<{ label: string; value: number }>;
  shortcuts: ShortcutItem[];
  focusTitle: string;
  focusDescription: string;
  focusCards: FocusCardItem[];
  chartTitle: string;
  chartDescription: string;
  shortcutTitle: string;
  shortcutDescription: string;
};

function getFocusAction(mode: DashboardMode, card: ProcessCardListItem) {
  if (mode === 'review' || mode === 'approve') {
    return {
      label: '进入审阅',
      to: `/cards/${card.id}/print`,
    };
  }

  if (card.permissions.canEdit) {
    return {
      label: '继续处理',
      to: `/cards/${card.id}/edit`,
    };
  }

  return {
    label: '查看表单',
    to: `/cards/${card.id}/print`,
  };
}

function buildFocusCards(cards: ProcessCardListItem[], mode: DashboardMode): FocusCardItem[] {
  const matchedCards = cards.filter((card) => {
    if (mode === 'admin') {
      return card.status !== 'approved' && card.status !== 'voided';
    }

    if (mode === 'prepare') {
      return (
        card.permissions.canEdit &&
        (card.status === 'draft' || card.status === 'rejected_to_prepare')
      );
    }

    if (mode === 'confirm') {
      return (
        card.permissions.canEdit &&
        (card.status === 'pending_confirm' || card.status === 'rejected_to_confirm')
      );
    }

    if (mode === 'review') {
      return card.status === 'pending_review' || card.status === 'rejected_to_review';
    }

    if (mode === 'approve') {
      return card.status === 'pending_approve';
    }

    return true;
  });

  return matchedCards.slice(0, 6).map((card) => {
    const action = getFocusAction(mode, card);
    return {
      id: card.id,
      title: card.planNumber || card.productName || '未命名单据',
      subtitle: [card.productName, card.material, card.specification].filter(Boolean).join(' / '),
      statusLabel: CARD_STATUS_LABELS[card.status],
      actionLabel: action.label,
      to: action.to,
      updatedAt: card.updatedAt,
    };
  });
}

function resolveDashboardMode(
  isAdmin: boolean,
  workflowRoles: string[],
  overview: DashboardOverview,
): DashboardMode {
  if (isAdmin) {
    return 'admin';
  }

  const weightedRoles: Array<{ mode: Exclude<DashboardMode, 'admin' | 'viewer'>; score: number }> = [
    { mode: 'prepare', score: overview.tasks.draftCount + overview.tasks.returnedCount },
    { mode: 'confirm', score: overview.tasks.pendingConfirmCount },
    { mode: 'review', score: overview.tasks.pendingReviewCount },
    { mode: 'approve', score: overview.tasks.pendingApproveCount },
  ];

  const available = weightedRoles.filter((item) => workflowRoles.includes(item.mode));
  const withPending = [...available].sort((left, right) => right.score - left.score);

  if (withPending[0]?.score) {
    return withPending[0].mode;
  }

  return available[0]?.mode ?? 'viewer';
}

function createModeConfig(
  mode: DashboardMode,
  overview: DashboardOverview,
  focusCards: FocusCardItem[],
): DashboardModeConfig {
  const commonShortcuts: ShortcutItem[] = [
    {
      title: '工艺卡列表',
      description: '进入列表进行查询、筛选、打印和导出。',
      to: '/cards',
    },
  ];

  switch (mode) {
    case 'admin':
      return {
        badge: '管理员工作台',
        heading: '系统管理与全局监控',
        description: '优先关注整体待办、账号与字典管理、近期异常与作废情况。',
        highlightLabel: '当前全局待办总数',
        highlightDescription: '包含草稿、待确认、待审核、待批准和退回待处理单据。',
        highlightValue: overview.tasks.totalPendingCount,
        taskCards: [
          { label: '草稿待处理', value: overview.tasks.draftCount },
          { label: '待确认', value: overview.tasks.pendingConfirmCount },
          { label: '待审核', value: overview.tasks.pendingReviewCount },
          { label: '待批准', value: overview.tasks.pendingApproveCount },
          { label: '退回待处理', value: overview.tasks.returnedCount },
        ],
        shortcuts: [
          {
            title: '新建工艺卡',
            description: '从工作台直接新建受控流程单据。',
            to: '/cards/new',
          },
          {
            title: '生产部门设置',
            description: '维护下拉字典，保证录入口径一致。',
            to: '/settings/departments',
          },
          {
            title: '账号管理',
            description: '新增账号、分配角色、启用或停用用户。',
            to: '/settings/users',
          },
          {
            title: '操作日志',
            description: '查看登录、审批、字典和账号修改留痕。',
            to: '/settings/audit-logs',
          },
          ...commonShortcuts,
        ],
        focusTitle: '优先关注单据',
        focusDescription: '按最近更新时间展示当前仍在流程中的工艺卡。',
        focusCards,
        chartTitle: '近 7 天新增趋势',
        chartDescription: '帮助管理员查看工作量变化和近期流入情况。',
        shortcutTitle: '管理入口',
        shortcutDescription: '管理员常用功能集合。',
      };
    case 'prepare':
      return {
        badge: '编制工作台',
        heading: '编制与退回处理视角',
        description: '重点看我的草稿和被退回的工艺卡，快速继续录入或修改后重新提交。',
        highlightLabel: '当前待编制与待修改',
        highlightDescription: '包括草稿和退回到编制的单据，建议优先处理最近更新的任务。',
        highlightValue: overview.tasks.draftCount + overview.tasks.returnedCount,
        taskCards: [
          { label: '我的草稿', value: overview.tasks.draftCount },
          { label: '退回待修改', value: overview.tasks.returnedCount },
          { label: '本周新建', value: overview.stats.weekCreated },
          { label: '本月新建', value: overview.stats.monthCreated },
        ],
        shortcuts: [
          {
            title: '新建工艺卡',
            description: '录入新的生产工艺卡并发起后续流程。',
            to: '/cards/new',
          },
          ...commonShortcuts,
        ],
        focusTitle: '待编制单据',
        focusDescription: '展示当前可直接编辑的草稿和退回单据。',
        focusCards,
        chartTitle: '近 7 天新建趋势',
        chartDescription: '帮助编制人员把握近期录入节奏和工作量变化。',
        shortcutTitle: '快捷操作',
        shortcutDescription: '围绕录入与修改的高频入口。',
      };
    case 'confirm':
      return {
        badge: '确认工作台',
        heading: '确认与纠偏视角',
        description: '优先查看待确认单据，可直接修订后提交审核或退回编制。',
        highlightLabel: '当前待确认数量',
        highlightDescription: '建议优先处理交期近、最近更新较多的单据。',
        highlightValue: overview.tasks.pendingConfirmCount,
        taskCards: [
          { label: '待确认', value: overview.tasks.pendingConfirmCount },
          { label: '退回待处理', value: overview.tasks.returnedCount },
          { label: '今日新建', value: overview.stats.todayCreated },
          { label: '本周新建', value: overview.stats.weekCreated },
        ],
        shortcuts: commonShortcuts,
        focusTitle: '待确认单据',
        focusDescription: '展示当前由你处理的确认环节工艺卡。',
        focusCards,
        chartTitle: '近 7 天单据流入趋势',
        chartDescription: '帮助确认人员了解近期新增单据规模。',
        shortcutTitle: '快捷操作',
        shortcutDescription: '围绕确认处理的常用入口。',
      };
    case 'review':
      return {
        badge: '审核工作台',
        heading: '审核审阅视角',
        description: '重点关注待审核单据，建议通过审阅打印版式后完成审核意见。',
        highlightLabel: '当前待审核数量',
        highlightDescription: '优先处理停留时间较长或临近交付的工艺卡。',
        highlightValue: overview.tasks.pendingReviewCount,
        taskCards: [
          { label: '待审核', value: overview.tasks.pendingReviewCount },
          { label: '已批准总数', value: overview.stats.approvedCount },
          { label: '本周新建', value: overview.stats.weekCreated },
          { label: '本月新建', value: overview.stats.monthCreated },
        ],
        shortcuts: commonShortcuts,
        focusTitle: '待审核单据',
        focusDescription: '点击可直接进入审阅模式处理审核动作。',
        focusCards,
        chartTitle: '近 7 天单据新增趋势',
        chartDescription: '辅助判断近期审核压力和单据流入规模。',
        shortcutTitle: '审核入口',
        shortcutDescription: '围绕审阅和查询的快捷操作。',
      };
    case 'approve':
      return {
        badge: '批准工作台',
        heading: '批准终审视角',
        description: '重点查看待批准单据，结合打印版式完成最终批准或退回审核。',
        highlightLabel: '当前待批准数量',
        highlightDescription: '批准通过后单据将锁定，建议在批准前重点核对打印版式。',
        highlightValue: overview.tasks.pendingApproveCount,
        taskCards: [
          { label: '待批准', value: overview.tasks.pendingApproveCount },
          { label: '已批准总数', value: overview.stats.approvedCount },
          { label: '本周新建', value: overview.stats.weekCreated },
          { label: '本年新建', value: overview.stats.yearCreated },
        ],
        shortcuts: commonShortcuts,
        focusTitle: '待批准单据',
        focusDescription: '点击可直接进入审阅模式完成最终处理。',
        focusCards,
        chartTitle: '近 7 天单据新增趋势',
        chartDescription: '帮助批准人观察近期单据输入规模。',
        shortcutTitle: '批准入口',
        shortcutDescription: '围绕终审与查询的快捷操作。',
      };
    default:
      return {
        badge: '业务工作台',
        heading: '业务总览',
        description: '查看近期工艺卡趋势、流程动态和常用功能入口。',
        highlightLabel: '当前待办总数',
        highlightDescription: '汇总当前系统中的流程单据和业务动态。',
        highlightValue: overview.tasks.totalPendingCount,
        taskCards: [
          { label: '待确认', value: overview.tasks.pendingConfirmCount },
          { label: '待审核', value: overview.tasks.pendingReviewCount },
          { label: '待批准', value: overview.tasks.pendingApproveCount },
          { label: '已批准', value: overview.stats.approvedCount },
        ],
        shortcuts: commonShortcuts,
        focusTitle: '近期单据',
        focusDescription: '按最近更新时间展示近期关注单据。',
        focusCards,
        chartTitle: '近 7 天趋势',
        chartDescription: '展示近期工艺卡新增情况。',
        shortcutTitle: '快捷入口',
        shortcutDescription: '进入常用业务页面。',
      };
  }
}

export function DashboardPage() {
  const { isAdmin, user } = useAuth();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [cards, setCards] = useState<ProcessCardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);

      try {
        const [overviewResponse, cardResponse] = await Promise.all([
          api.getDashboardOverview(),
          api.listProcessCards({
            keyword: '',
            planNumber: '',
            customerCode: '',
            productName: '',
            material: '',
            specification: '',
            deliveryDate: '',
            operationCode: '',
            heatTreatmentType: '',
            status: '',
          }),
        ]);

        if (!active) {
          return;
        }

        setOverview(overviewResponse);
        setCards(cardResponse.items);
        setError('');
      } catch (reason) {
        if (!active) {
          return;
        }

        setError(reason instanceof Error ? reason.message : '加载工作台失败');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const trendData = useMemo(() => {
    if (!overview) {
      return null;
    }

    return {
      labels: overview.trend.map((item) => item.label),
      datasets: [
        {
          label: '新增工艺卡',
          data: overview.trend.map((item) => item.value),
          borderColor: '#2f6b4f',
          backgroundColor: 'rgba(47, 107, 79, 0.16)',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        },
      ],
    };
  }, [overview]);

  const doughnutData = useMemo(() => {
    if (!overview) {
      return null;
    }

    return {
      labels: overview.statusDistribution.map((item) => item.label),
      datasets: [
        {
          data: overview.statusDistribution.map((item) => item.value),
          backgroundColor: ['#365847', '#5f8b6d', '#d6a05c', '#c96a32', '#2e4f7a', '#8b5e3c'],
          borderWidth: 0,
        },
      ],
    };
  }, [overview]);

  if (loading) {
    return (
      <div className="page">
        <div className="state">正在加载工作台...</div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="page">
        <div className="state state--error">{error || '工作台数据加载失败'}</div>
      </div>
    );
  }

  const dashboardMode = resolveDashboardMode(isAdmin, user?.workflowRoles ?? [], overview);
  const focusCards = buildFocusCards(cards, dashboardMode);
  const modeConfig = createModeConfig(dashboardMode, overview, focusCards);

  const statCards = [
    { label: '今日新建', value: overview.stats.todayCreated },
    { label: '本周新建', value: overview.stats.weekCreated },
    { label: '本月新建', value: overview.stats.monthCreated },
    { label: '本年新建', value: overview.stats.yearCreated },
    { label: '已批准', value: overview.stats.approvedCount },
    { label: '已作废', value: overview.stats.voidedCount },
  ];

  return (
    <div className="page dashboard-page">
      <header className="dashboard-hero">
        <div>
          <p className="page__eyebrow">Workbench</p>
          <div className="dashboard-hero__badge">{modeConfig.badge}</div>
          <h2>{modeConfig.heading}</h2>
          <p>
            欢迎回来，{user?.displayName ?? user?.username}。{modeConfig.description}
          </p>
        </div>
        <div className="dashboard-hero__actions">
          {modeConfig.shortcuts.slice(0, 2).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={item.to === '/cards/new' ? 'button button--primary' : 'button button--ghost'}
            >
              {item.title}
            </Link>
          ))}
        </div>
      </header>

      {error ? <div className="state state--error">{error}</div> : null}

      <section className="dashboard-section">
        <div className="panel dashboard-highlight">
          <div>
            <span className="dashboard-highlight__label">{modeConfig.highlightLabel}</span>
            <strong>{modeConfig.highlightValue}</strong>
            <p>{modeConfig.highlightDescription}</p>
          </div>
          <div className="dashboard-highlight__meta">
            <span>最近流程动态 {overview.recentActivities.length} 条</span>
          </div>
        </div>
      </section>

      <section className="dashboard-grid dashboard-grid--tasks">
        {modeConfig.taskCards.map((item) => (
          <article key={item.label} className="panel dashboard-card">
            <span className="dashboard-card__label">{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="dashboard-grid dashboard-grid--stats">
        {statCards.map((item) => (
          <article key={item.label} className="panel dashboard-card dashboard-card--soft">
            <span className="dashboard-card__label">{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="dashboard-charts">
        <article className="panel dashboard-chart">
          <div className="panel__header">
            <h3>{modeConfig.chartTitle}</h3>
            <span>{modeConfig.chartDescription}</span>
          </div>
          {trendData ? (
            <Line
              data={trendData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
              }}
            />
          ) : null}
        </article>

        <article className="panel dashboard-chart dashboard-chart--small">
          <div className="panel__header">
            <h3>状态分布</h3>
            <span>当前系统内工艺卡状态分布</span>
          </div>
          {doughnutData ? (
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                cutout: '64%',
              }}
            />
          ) : null}
        </article>
      </section>

      <section className="dashboard-bottom">
        <article className="panel">
          <div className="panel__header">
            <h3>{modeConfig.focusTitle}</h3>
            <span>{modeConfig.focusDescription}</span>
          </div>
          <div className="dashboard-focus-list">
            {modeConfig.focusCards.map((item) => (
              <div key={item.id} className="dashboard-focus-item">
                <div className="dashboard-focus-item__content">
                  <strong>{item.title}</strong>
                  <p>{item.subtitle || '未补充产品信息'}</p>
                </div>
                <div className="dashboard-focus-item__meta">
                  <span>{item.statusLabel}</span>
                  <span>{new Date(item.updatedAt).toLocaleString('zh-CN')}</span>
                </div>
                <div className="dashboard-focus-item__actions">
                  <Link to={item.to} className="button button--ghost button--small">
                    {item.actionLabel}
                  </Link>
                </div>
              </div>
            ))}
            {modeConfig.focusCards.length === 0 ? (
              <div className="state">当前没有需要你优先处理的工艺卡。</div>
            ) : null}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <h3>{modeConfig.shortcutTitle}</h3>
            <span>{modeConfig.shortcutDescription}</span>
          </div>
          <div className="dashboard-shortcuts">
            {modeConfig.shortcuts.map((item) => (
              <Link key={item.to} to={item.to} className="dashboard-shortcut">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <article className="panel">
          <div className="panel__header">
            <h3>站内消息</h3>
            <span>{`当前待办提醒 ${overview.notificationCount} 条`}</span>
          </div>
          <div className="notification-list">
            {overview.notifications.slice(0, 6).map((item) => (
              <article key={item.id} className={`notification-card notification-card--${item.level}`}>
                <div className="notification-card__header">
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <div className="notification-card__actions">
                  <Link to={item.to} className="button button--ghost button--small">
                    {item.actionLabel}
                  </Link>
                </div>
              </article>
            ))}
            {overview.notifications.length === 0 ? (
              <div className="state">当前没有新的待办提醒和站内消息。</div>
            ) : null}
          </div>
          {overview.notifications.length > 0 ? (
            <div className="toolbar">
              <Link to="/messages" className="button button--ghost button--small">
                查看全部消息
              </Link>
            </div>
          ) : null}
        </article>
      </section>

      <section className="dashboard-section">
        <article className="panel">
          <div className="panel__header">
            <h3>最近流程动态</h3>
            <span>基于工艺卡和审批日志</span>
          </div>
          <div className="dashboard-activity-list">
            {overview.recentActivities.map((item) => (
              <div key={item.id} className="dashboard-activity-item">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.actorDisplayName}</p>
                </div>
                <div className="dashboard-activity-item__meta">
                  <span>{item.statusLabel}</span>
                  <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            ))}
            {overview.recentActivities.length === 0 ? <div className="state">当前还没有流程动态。</div> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
