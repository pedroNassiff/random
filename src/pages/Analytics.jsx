import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Chart from 'react-apexcharts';
import { analyticsApi } from '../services/analyticsApi';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/Analytics.css';

const Analytics = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [summary, setSummary] = useState(null);
  const [topPages, setTopPages] = useState([]);
  const [topEvents, setTopEvents] = useState([]);
  const [engagementZones, setEngagementZones] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [summaryData, pagesData, eventsData, zonesData] = await Promise.all([
        analyticsApi.getSummary(timeRange),
        analyticsApi.getTopPages(timeRange),
        analyticsApi.getTopEvents(timeRange),
        analyticsApi.getEngagementZones(timeRange)
      ]);

      setSummary(summaryData);
      setTopPages(pagesData);
      setTopEvents(eventsData);
      setEngagementZones(zonesData);
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
      width: 3
    },
    fill: {
      type: 'solid',
      opacity: 0.1
    },
    colors: ['#fff'],
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.1)',
      strokeDashArray: 4
    },
    xaxis: {
      categories: summary?.daily_sessions?.map(d => d.date) || [],
      labels: {
        style: { colors: '#888' }
      }
    },
    yaxis: {
      labels: {
        style: { colors: '#888' }
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
    colors: ['#fff', '#aaa', '#666', '#333'],
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
              color: '#fff',
              fontSize: '16px'
            }
          }
        }
      }
    },
    dataLabels: {
      enabled: true,
      style: {
        colors: ['#000']
      }
    },
    legend: {
      position: 'bottom',
      labels: { colors: '#fff' }
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
    colors: ['#fff'],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        distributed: false
      }
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      categories: topPages.map(p => p.page_path) || [],
      labels: {
        style: { colors: '#888' }
      }
    },
    yaxis: {
      labels: {
        style: { colors: '#888' }
      }
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.1)'
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
          <div className="time-range-selector">
            <button
              className={timeRange === 7 ? 'active' : ''}
              onClick={() => setTimeRange(7)}
            >
              7D
            </button>
            <button
              className={timeRange === 30 ? 'active' : ''}
              onClick={() => setTimeRange(30)}
            >
              30D
            </button>
            <button
              className={timeRange === 90 ? 'active' : ''}
              onClick={() => setTimeRange(90)}
            >
              90D
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
              <h3 className="stat-value">{Math.round(summary?.avg_session_duration || 0)}s</h3>
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

        {/* Charts Grid */}
        <div className="charts-grid">
          {/* Line Chart - Sessions Over Time */}
          <div className="chart-card large">
            <h3 className="chart-title">Sessions Over Time</h3>
            <Chart
              options={lineChartOptions}
              series={lineChartSeries}
              type="area"
              height={300}
            />
          </div>

          {/* Donut Chart - Device Breakdown */}
          <div className="chart-card">
            <h3 className="chart-title">Device Breakdown</h3>
            <Chart
              options={donutChartOptions}
              series={donutChartSeries}
              type="donut"
              height={300}
            />
          </div>

          {/* Bar Chart - Top Pages */}
          <div className="chart-card large">
            <h3 className="chart-title">Top Pages</h3>
            <Chart
              options={barChartOptions}
              series={barChartSeries}
              type="bar"
              height={300}
            />
          </div>

          {/* Top Events Table */}
          <div className="chart-card">
            <h3 className="chart-title">Top Events</h3>
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

          {/* Engagement Zones */}
          <div className="chart-card">
            <h3 className="chart-title">Engagement Zones</h3>
            <div className="engagement-list">
              {engagementZones.map((zone, index) => (
                <div key={index} className="engagement-item">
                  <div className="engagement-info">
                    <p className="zone-name">{zone.zone_id}</p>
                    <div className="engagement-bar">
                      <div
                        className="engagement-fill"
                        style={{ width: `${(zone.avg_duration / 60) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="engagement-time">
                    {Math.round(zone.avg_duration)}s
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Traffic Sources */}
          <div className="chart-card large">
            <h3 className="chart-title">Traffic Sources</h3>
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

          {/* Geographic Distribution */}
          <div className="chart-card">
            <h3 className="chart-title">Geographic Distribution</h3>
            <div className="geo-list">
              {summary?.top_countries?.map((location, index) => (
                <div key={index} className="geo-item">
                  <div className="geo-flag">🌍</div>
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
      </div>

      <Footer />
    </div>
  );
};

export default Analytics;
