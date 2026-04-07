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
import type { DashboardOverview } from '../../shared/types';
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

export function DashboardPage() {
  const { hasWorkflowRole, isAdmin, user } = useAuth();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .getDashboardOverview()
      .then((response) => {
        setOverview(response);
        setError('');
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : '加载工作台失败'))
      .finally(() => setLoading(false));
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

  const taskCards = [
    { label: '我的草稿', value: overview.tasks.draftCount, visible: hasWorkflowRole('prepare') || isAdmin },
    { label: '待确认', value: overview.tasks.pendingConfirmCount, visible: hasWorkflowRole('confirm') || isAdmin },
    { label: '待审核', value: overview.tasks.pendingReviewCount, visible: hasWorkflowRole('review') || isAdmin },
    { label: '待批准', value: overview.tasks.pendingApproveCount, visible: hasWorkflowRole('approve') || isAdmin },
    { label: '退回待处理', value: overview.tasks.returnedCount, visible: true },
  ].filter((item) => item.visible);

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
          <h2>工作台</h2>
          <p>欢迎回来，{user?.displayName ?? user?.username}。这里汇总了待办、统计和最近流程动态。</p>
        </div>
        <div className="dashboard-hero__actions">
          <Link to="/cards/new" className="button button--primary">
            新建工艺卡
          </Link>
          <Link to="/cards" className="button button--ghost">
            查看工艺卡列表
          </Link>
        </div>
      </header>

      {error ? <div className="state state--error">{error}</div> : null}

      <section className="dashboard-section">
        <div className="panel dashboard-highlight">
          <div>
            <span className="dashboard-highlight__label">当前待办总数</span>
            <strong>{overview.tasks.totalPendingCount}</strong>
            <p>包含草稿、各审批节点待办以及退回待处理单据。</p>
          </div>
          <div className="dashboard-highlight__meta">
            <span>最近流程动态 {overview.recentActivities.length} 条</span>
          </div>
        </div>
      </section>

      <section className="dashboard-grid dashboard-grid--tasks">
        {taskCards.map((item) => (
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
            <h3>近 7 天新增趋势</h3>
            <span>按工艺卡创建时间统计</span>
          </div>
          {trendData ? <Line data={trendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} /> : null}
        </article>

        <article className="panel dashboard-chart dashboard-chart--small">
          <div className="panel__header">
            <h3>状态分布</h3>
            <span>当前系统内工艺卡状态</span>
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

        <article className="panel">
          <div className="panel__header">
            <h3>快捷入口</h3>
            <span>常用操作一键进入</span>
          </div>
          <div className="dashboard-shortcuts">
            <Link to="/cards/new" className="dashboard-shortcut">
              <strong>新建工艺卡</strong>
              <span>快速录入新的生产工艺卡</span>
            </Link>
            <Link to="/cards" className="dashboard-shortcut">
              <strong>工艺卡列表</strong>
              <span>查询、筛选、导出和打印工艺卡</span>
            </Link>
            {isAdmin ? (
              <>
                <Link to="/settings/departments" className="dashboard-shortcut">
                  <strong>生产部门设置</strong>
                  <span>维护工序下拉字典</span>
                </Link>
                <Link to="/settings/users" className="dashboard-shortcut">
                  <strong>账号管理</strong>
                  <span>新增账号、分配角色、启停用</span>
                </Link>
              </>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
