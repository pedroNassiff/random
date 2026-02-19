import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Chart from 'react-apexcharts';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import { analyticsApi } from '../services/analyticsApi';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import '../styles/Analytics.css';

const DEFAULT_LAYOUT = {
  lg: [
    { i: 'sessions',   x: 0,  y: 0,  w: 8, h: 6, minW: 4, minH: 4 },
    { i: 'devices',    x: 8,  y: 0,  w: 4, h: 6, minW: 3, minH: 4 },
    { i: 'top_pages',  x: 0,  y: 6,  w: 8, h: 6, minW: 4, minH: 4 },
    { i: 'top_events', x: 8,  y: 6,  w: 4, h: 6, minW: 3, minH: 4 },
    { i: 'engagement', x: 0,  y: 12, w: 4, h: 5, minW: 3, minH: 3 },
    { i: 'traffic',    x: 4,  y: 12, w: 4, h: 5, minW: 3, minH: 3 },
    { i: 'geo',        x: 8,  y: 12, w: 4, h: 5, minW: 3, minH: 3 },
    { i: 'users',      x: 0,  y: 17, w: 12, h: 10, minW: 4, minH: 4 },
  ]
};

const STORAGE_KEY = 'analytics_dashboard_layout';

const Analytics = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [summary, setSummary] = useState(null);
  const [topPages, setTopPages] = useState([]);
  const [topEvents, setTopEvents] = useState([]);
  const [engagementZones, setEngagementZones] = useState([]);
  const [usersActivity, setUsersActivity] = useState([]);
  const [layouts, setLayouts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return DEFAULT_LAYOUT;
      const parsed = JSON.parse(saved);
      // Reject corrupt layouts — if any item is too small it got mangled
      const items = parsed.lg ?? [];
      const isValid = items.length === DEFAULT_LAYOUT.lg.length &&
        items.every(item => item.w >= 2 && item.h >= 2);
      if (!isValid) {
        console.warn('[Analytics] Stored layout invalid, resetting to default');
        localStorage.removeItem(STORAGE_KEY);
        return DEFAULT_LAYOUT;
      }
      return parsed;
    } catch { return DEFAULT_LAYOUT; }
  });

  const { containerRef: gridRef, width: gridWidth } = useContainerWidth();

  const logDimensions = useCallback((label, layoutItems, cols = 12) => {
    const ROW_H = 60;
    const MARGIN = 16;
    const colWidth = (gridWidth - MARGIN * (cols + 1)) / cols;
    console.group(`📐 [Analytics Grid] ${label} — container width: ${Math.round(gridWidth)}px`);
    layoutItems.forEach(item => {
      const pxW = Math.round(colWidth * item.w + MARGIN * (item.w - 1));
      const pxH = Math.round(ROW_H * item.h + MARGIN * (item.h - 1));
      console.log(
        `%c ${item.i.padEnd(12)} %c grid(${item.w}×${item.h}) → ${pxW}×${pxH}px  [x:${item.x} y:${item.y}]`,
        'background:#00FFD1;color:#000;font-weight:bold;border-radius:3px;padding:1px 4px',
        'color:#aaa'
      );
    });
    console.groupEnd();
  }, [gridWidth]);

  // Log on first meaningful render (when gridWidth is known)
  useEffect(() => {
    if (gridWidth <= 0) return;
    const current = layouts.lg ?? DEFAULT_LAYOUT.lg;
    logDimensions('DEFAULT LAYOUT (initial)', current);
  }, [gridWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLayoutChange = useCallback((_, allLayouts) => {
    setLayouts(allLayouts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts));
    if (allLayouts.lg) logDimensions('LAYOUT CHANGED', allLayouts.lg);
  }, [logDimensions]);

  const resetLayout = () => {
    setLayouts(DEFAULT_LAYOUT);
    localStorage.removeItem(STORAGE_KEY);
  };

  const DragHandle = ({ title }) => (
    <div className="widget-drag-handle">
      <span className="widget-title">{title}</span>
      <span className="drag-hint">⠿</span>
    </div>
  );

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [summaryData, pagesData, eventsData, zonesData, usersData] = await Promise.all([
        analyticsApi.getSummary(timeRange),
        analyticsApi.getTopPages(timeRange),
        analyticsApi.getTopEvents(timeRange),
        analyticsApi.getEngagementZones(timeRange),
        analyticsApi.getUsersActivity(timeRange)
      ]);

      setSummary(summaryData);
      setTopPages(pagesData);
      setTopEvents(eventsData);
      setEngagementZones(zonesData);
      setUsersActivity(usersData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Configuración del gráfico de línea (Sessions over time)
  const lineChartOptions = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      background: 'transparent',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      }
    },
    dataLabels: { enabled: false },
    stroke: {
      curve: 'smooth',
      width: 2
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.25,
        opacityTo: 0.02,
        stops: [0, 100]
      }
    },
    colors: ['#00FFD1'],
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.06)',
      strokeDashArray: 4
    },
    xaxis: {
      categories: summary?.daily_sessions?.map(d => d.date) || [],
      labels: {
        style: { colors: '#555' }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: '#555' }
      }
    },
    tooltip: {
      theme: 'dark',
      x: { show: true },
      y: {
        formatter: (val) => `${val} sessions`
      }
    },
    legend: {
      labels: { colors: '#fff' }
    }
  };

  const lineChartSeries = [
    {
      name: 'Sessions',
      data: summary?.daily_sessions?.map(d => d.count) || []
    }
  ];

  // Configuración del gráfico de donut (Device breakdown)
  const donutChartOptions = {
    chart: {
      type: 'donut',
      background: 'transparent'
    },
    colors: ['#00FFD1', '#FF6B2C', '#00B4FF', '#FFD700'],
    labels: summary?.device_breakdown?.map(d => d.device_type) || [],
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Devices',
              color: '#888',
              fontSize: '13px',
              fontFamily: 'monospace'
            },
            value: {
              color: '#fff',
              fontSize: '22px',
              fontWeight: 700
            }
          }
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    legend: {
      position: 'bottom',
      labels: { colors: '#888' },
      markers: { width: 8, height: 8, radius: 8 }
    },
    tooltip: {
      theme: 'dark'
    }
  };

  const donutChartSeries = summary?.device_breakdown?.map(d => d.count) || [];

  // Configuración del gráfico de barras (Top pages)
  const barChartOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      background: 'transparent'
    },
    colors: ['#00FFD1'],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 3,
        distributed: false,
        barHeight: '60%'
      }
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      categories: topPages.map(p => p.page_path) || [],
      labels: {
        style: { colors: '#555' }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: '#aaa', fontSize: '12px' }
      }
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.06)',
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } }
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val) => `${val} views`
      }
    },
    legend: { show: false }
  };

  const barChartSeries = [
    {
      name: 'Pageviews',
      data: topPages.map(p => p.views) || []
    }
  ];

  const formatDuration = (seconds) => {
    const s = Math.round(seconds || 0);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
  };

  const formatEuropeDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleString('es-ES', {
        timeZone: 'Europe/Madrid',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <Navbar />

      <div className="analytics-content">
        {/* Header */}
        <div className="analytics-header">
          <h1 className="analytics-title">Random Analytics</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="time-range-selector">
              <button className={timeRange === 7 ? 'active' : ''} onClick={() => setTimeRange(7)}>7D</button>
              <button className={timeRange === 30 ? 'active' : ''} onClick={() => setTimeRange(30)}>30D</button>
              <button className={timeRange === 90 ? 'active' : ''} onClick={() => setTimeRange(90)}>90D</button>
            </div>
            <button onClick={resetLayout} className="reset-layout-btn" title="Reset dashboard layout">
              ↺ Reset
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-label">Unique Visitors</p>
              <h3 className="stat-value">{summary?.unique_visitors || 0}</h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-label">Total Sessions</p>
              <h3 className="stat-value">{summary?.total_sessions || 0}</h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-label">Pageviews</p>
              <h3 className="stat-value">{summary?.total_pageviews || 0}</h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-label">Avg Duration</p>
              <h3 className="stat-value">{formatDuration(summary?.avg_session_duration)}</h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-label">Bounce Rate</p>
              <h3 className="stat-value">{summary?.bounce_rate?.toFixed(1) || 0}%</h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-label">Return Rate</p>
              <h3 className="stat-value">{summary?.return_visitor_rate?.toFixed(1) || 0}%</h3>
            </div>
          </div>
        </div>

        {/* Dashboard Grid — draggable & resizable */}
        <div ref={gridRef} className="dashboard-grid">
        <ResponsiveGridLayout
          width={gridWidth}
          layouts={layouts}
          onLayoutChange={handleLayoutChange}
          breakpoints={{ lg: 1200, md: 996, sm: 768 }}
          cols={{ lg: 12, md: 10, sm: 6 }}
          rowHeight={60}
          draggableHandle=".widget-drag-handle"
          margin={[16, 16]}
          containerPadding={[0, 0]}
          useCSSTransforms
        >
          {/* Sessions Over Time */}
          <div key="sessions" className="widget">
            <DragHandle title="Sessions Over Time" />
            <div className="widget-body">
              <Chart options={lineChartOptions} series={lineChartSeries} type="area" height="100%" />
            </div>
          </div>

          {/* Device Breakdown */}
          <div key="devices" className="widget">
            <DragHandle title="Device Breakdown" />
            <div className="widget-body">
              <Chart options={donutChartOptions} series={donutChartSeries} type="donut" height="100%" />
            </div>
          </div>

          {/* Top Pages */}
          <div key="top_pages" className="widget">
            <DragHandle title="Top Pages" />
            <div className="widget-body">
              <Chart options={barChartOptions} series={barChartSeries} type="bar" height="100%" />
            </div>
          </div>

          {/* Top Events */}
          <div key="top_events" className="widget">
            <DragHandle title="Top Events" />
            <div className="widget-body widget-scroll">
              <div className="events-list">
                {topEvents.map((event, index) => (
                  <div key={index} className="event-item">
                    <div className="event-rank">{index + 1}</div>
                    <div className="event-details">
                      <p className="event-name">{event.event_name}</p>
                      <p className="event-category">{event.event_category || 'General'}</p>
                    </div>
                    <div className="event-count">{event.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Engagement Zones */}
          <div key="engagement" className="widget">
            <DragHandle title="Engagement Zones" />
            <div className="widget-body widget-scroll">
              <div className="engagement-list">
                {engagementZones.map((zone, index) => (
                  <div key={index} className="engagement-item">
                    <div className="engagement-info">
                      <p className="zone-name">{zone.zone_id}</p>
                      <div className="engagement-bar">
                        <div className="engagement-fill" style={{ width: `${Math.min((zone.avg_duration / 60) * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div className="engagement-time">{formatDuration(zone.avg_duration)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Traffic Sources */}
          <div key="traffic" className="widget">
            <DragHandle title="Traffic Sources" />
            <div className="widget-body widget-scroll">
              <div className="sources-grid">
                {summary?.top_sources?.map((source, index) => (
                  <div key={index} className="source-item">
                    <div className="source-details">
                      <p className="source-name">{source.referrer_source || 'Direct'}</p>
                      <p className="source-count">{source.count} visits</p>
                    </div>
                    <div className="source-percentage">
                      {((source.count / summary.total_sessions) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Geographic Distribution */}
          <div key="geo" className="widget">
            <DragHandle title="Geographic Distribution" />
            <div className="widget-body widget-scroll">
              <div className="geo-list">
                {summary?.top_countries?.map((location, index) => (
                  <div key={index} className="geo-item">
                    <div className="geo-details">
                      <p className="geo-location">
                        {location.city ? `${location.city}, ` : ''}{location.country || 'Unknown'}
                      </p>
                      <p className="geo-count">{location.count} visits</p>
                    </div>
                    <div className="geo-percentage">
                      {((location.count / summary.total_sessions) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
                {(!summary?.top_countries || summary.top_countries.length === 0) && (
                  <p className="no-data">No geographic data available yet</p>
                )}
              </div>
            </div>
          </div>

          {/* User Activity */}
          <div key="users" className="widget">
            <DragHandle title="User Activity" />
            <div className="widget-body widget-scroll">
              <div className="users-activity-container">
                {usersActivity.length > 0 ? (
                  usersActivity.map((user) => (
                    <div key={user.id} className="user-activity-card">
                      <div className="user-header">
                        <div className="user-info">
                          <div className="user-avatar">
                            {user.email
                              ? <span className="avatar-icon">✉️</span>
                              : <span className="avatar-icon anonymous">👤</span>}
                          </div>
                          <div className="user-details">
                            <p className="user-name">
                              {user.name || user.email || `Anonymous ${user.anonymous_id.slice(-8)}`}
                            </p>
                            {user.email && <p className="user-email">{user.email}</p>}
                            {user.city && user.country && (
                              <p className="user-location">📍 {user.city}, {user.country}</p>
                            )}
                            <div className="user-timestamps">
                              {user.first_seen && (
                                <span className="user-ts">🟢 Primera visita: {formatEuropeDate(user.first_seen)}</span>
                              )}
                              {user.last_seen && (
                                <span className="user-ts">🕐 Última visita: {formatEuropeDate(user.last_seen)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="user-stats">
                          <div className="stat-badge">
                            <span className="stat-label">Sessions</span>
                            <span className="stat-value">{user.total_sessions}</span>
                          </div>
                          <div className="stat-badge">
                            <span className="stat-label">Clicks</span>
                            <span className="stat-value">{user.total_clicks || 0}</span>
                          </div>
                          <div className="stat-badge">
                            <span className="stat-label">Time</span>
                            <span className="stat-value">{Math.round(user.total_time || 0)}s</span>
                          </div>
                        </div>
                      </div>
                      {user.pages && user.pages.length > 0 && (
                        <div className="user-pages">
                          <p className="pages-title">Pages visited:</p>
                          {user.pages.map((page, pageIndex) => (
                            <div key={pageIndex} className="page-item">
                              <div className="page-info">
                                <span className="page-path">{page.page_path}</span>
                                <span className="page-visits">{page.visits} visit{page.visits > 1 ? 's' : ''}</span>
                              </div>
                              <div className="page-metrics">
                                <span className="page-time">⏱ {Math.round(page.avg_time || 0)}s avg</span>
                                <span className="page-clicks">🖱 {page.total_clicks || 0} clicks</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="no-data">No user activity data available yet</p>
                )}
              </div>
            </div>
          </div>
        </ResponsiveGridLayout>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Analytics;
