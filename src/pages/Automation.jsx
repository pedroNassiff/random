import React, { useState, useEffect } from 'react';
import { automationApi } from '../services/automationApi';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/Automation.css';

const Automation = () => {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [allItems, setAllItems] = useState([]);
  const [activeTypeTab, setActiveTypeTab] = useState('all'); // lead, content, all
  const [activeStatusTab, setActiveStatusTab] = useState('pending'); // pending, approved, rejected, all
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashboardData, leadsData, contentData] = await Promise.all([
        automationApi.getDashboard(),
        automationApi.getLeads(),
        automationApi.getContent()
      ]);

      // Combine all leads and content with type field
      const allLeads = leadsData.map(lead => ({ ...lead, type: 'lead' }));
      const allContent = contentData.map(content => ({ ...content, type: 'content' }));
      const combined = [...allLeads, ...allContent].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );

      setDashboard(dashboardData);
      setAllItems(combined);
    } catch (error) {
      console.error('Failed to fetch automation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (item, type, action) => {
    setSelectedItem({ ...item, type });
    setActionType(action);
    setShowModal(true);
  };

  const confirmAction = async () => {
    setProcessingAction(true);
    try {
      const { type, id } = selectedItem;
      
      if (actionType === 'approve') {
        if (type === 'lead') await automationApi.approveLead(id);
        else if (type === 'content') await automationApi.approveContent(id);
      } else if (actionType === 'reject') {
        if (type === 'lead') await automationApi.rejectLead(id);
        else if (type === 'content') await automationApi.rejectContent(id);
      }

      // Refresh data after action
      await fetchData();
      setShowModal(false);
      setSelectedItem(null);
      setActionType(null);
    } catch (error) {
      console.error(`Failed to ${actionType} ${selectedItem.type}:`, error);
      alert(`Error: Failed to ${actionType} ${selectedItem.type}`);
    } finally {
      setProcessingAction(false);
    }
  };

  const cancelAction = () => {
    setShowModal(false);
    setSelectedItem(null);
    setActionType(null);
  };

  const filterItems = () => {
    let filtered = allItems;

    // Filter by type
    if (activeTypeTab !== 'all') {
      filtered = filtered.filter(item => item.type === activeTypeTab);
    }

    // Filter by status
    if (activeStatusTab === 'pending') {
      filtered = filtered.filter(item => 
        item.status === 'pending_review' || item.status === 'pending_approval'
      );
    } else if (activeStatusTab !== 'all') {
      filtered = filtered.filter(item => item.status === activeStatusTab);
    }

    return filtered;
  };

  const getScoreColor = (score) => {
    if (!score) return '#666';
    if (score >= 80) return '#8BC34A';
    if (score >= 60) return '#4A90E2';
    if (score >= 40) return '#E8B84F';
    return '#E85A4F';
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !dashboard) {
    return (
      <div className="automation-loading">
        <div className="loading-spinner"></div>
        <p>Loading automation dashboard...</p>
      </div>
    );
  }

  const filteredItems = filterItems();

  return (
    <div className="automation-container">
      <Navbar />

      <div className="automation-content">
        {/* Header */}
        <div className="automation-header">
          <h1 className="automation-title">Automation Dashboard</h1>
          <button className="refresh-button" onClick={fetchData} disabled={loading}>
            {loading ? '↻ Refreshing...' : '↻ Refresh'}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-label">Leads Pending</p>
              <h3 className="stat-value" style={{ color: '#4A90E2' }}>
                {dashboard?.leads_pending || 0}
              </h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-label">Avg Lead Score</p>
              <h3 className="stat-value" style={{ color: getScoreColor(dashboard?.avg_lead_score) }}>
                {dashboard?.avg_lead_score ? Math.round(dashboard.avg_lead_score) : 'N/A'}
              </h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-label">Content Pending</p>
              <h3 className="stat-value" style={{ color: '#8BC34A' }}>
                {dashboard?.content_pending || 0}
              </h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-label">Content Published</p>
              <h3 className="stat-value" style={{ color: '#666' }}>
                {dashboard?.content_published || 0}
              </h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-label">Actions Pending</p>
              <h3 className="stat-value" style={{ color: '#E8B84F' }}>
                {dashboard?.actions_pending_approval || 0}
              </h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-label">Errors (24h)</p>
              <h3 className="stat-value" style={{ color: dashboard?.errors_24h > 0 ? '#E85A4F' : '#666' }}>
                {dashboard?.errors_24h || 0}
              </h3>
            </div>
          </div>
        </div>

        {/* Type Tabs */}
        <div className="tabs-container">
          <button 
            className={`tab ${activeTypeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTypeTab('all')}
          >
            All
          </button>
          <button 
            className={`tab ${activeTypeTab === 'lead' ? 'active' : ''}`}
            onClick={() => setActiveTypeTab('lead')}
          >
            👤 Leads
          </button>
          <button 
            className={`tab ${activeTypeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTypeTab('content')}
          >
            📝 Content
          </button>
        </div>

        {/* Status Tabs */}
        <div className="tabs-container status-tabs">
          <button 
            className={`tab status-tab ${activeStatusTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveStatusTab('pending')}
          >
            ⏳ Pending ({allItems.filter(i => i.status === 'pending_review' || i.status === 'pending_approval').length})
          </button>
          <button 
            className={`tab status-tab ${activeStatusTab === 'approved' ? 'active' : ''}`}
            onClick={() => setActiveStatusTab('approved')}
          >
            ✓ Approved ({allItems.filter(i => i.status === 'approved').length})
          </button>
          <button 
            className={`tab status-tab ${activeStatusTab === 'rejected' ? 'active' : ''}`}
            onClick={() => setActiveStatusTab('rejected')}
          >
            ✕ Rejected ({allItems.filter(i => i.status === 'rejected').length})
          </button>
          <button 
            className={`tab status-tab ${activeStatusTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveStatusTab('all')}
          >
            All Status
          </button>
        </div>

        {/* Items Grid */}
        <div className="pending-items-grid">
          {filteredItems.length === 0 ? (
            <div className="no-items">
              <p>No items found</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div 
                key={`${item.type}-${item.id}`} 
                className={`pending-item ${item.type} ${item.status}`}
                onClick={() => handleItemClick(item)}
                style={{ cursor: 'pointer' }}
              >
                {/* Header with type badge and status */}
                <div className="item-header">
                  <div className="header-left">
                    <span className={`type-badge ${item.type}`}>
                      {item.type === 'lead' ? '👤' : '📝'} 
                      {item.type.toUpperCase()}
                    </span>
                    <span className={`status-badge ${item.status}`}>
                      {item.status === 'pending_review' || item.status === 'pending_approval' ? '⏳ Pending' :
                       item.status === 'approved' ? '✓ Approved' :
                       item.status === 'rejected' ? '✕ Rejected' :
                       item.status === 'published' ? '🌐 Published' : item.status}
                    </span>
                  </div>
                  <span className="item-date">{formatDate(item.created_at)}</span>
                </div>

                {/* Lead Content */}
                {item.type === 'lead' && (
                  <div className="item-content">
                    <h3 className="item-title">{item.company_name}</h3>
                    <div className="item-details">
                      <p><strong>Contact:</strong> {item.contact_name}</p>
                      <p><strong>Email:</strong> {item.contact_email}</p>
                      {item.contact_phone && <p><strong>Phone:</strong> {item.contact_phone}</p>}
                      {item.website && (
                        <p><strong>Website:</strong> <a href={item.website} target="_blank" rel="noopener noreferrer">{item.website}</a></p>
                      )}
                      {item.ai_score !== null && (
                        <div className="score-container">
                          <span className="score-label">AI Score:</span>
                          <span className="score-value" style={{ color: getScoreColor(item.ai_score) }}>
                            {item.ai_score}/100
                          </span>
                        </div>
                      )}
                      {item.ai_reasoning && (
                        <p className="ai-reasoning"><em>{item.ai_reasoning}</em></p>
                      )}
                      {item.tech_stack && item.tech_stack.length > 0 && (
                        <div className="tech-stack">
                          <strong>Tech:</strong>
                          {item.tech_stack.map((tech, i) => (
                            <span key={i} className="tech-tag">{tech}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Content Content */}
                {item.type === 'content' && (
                  <div className="item-content">
                    <h3 className="item-title">{item.title}</h3>
                    <div className="item-details">
                      <p><strong>Type:</strong> <span className="content-type">{item.content_type}</span></p>
                      <p className="content-body">{item.body?.substring(0, 200)}{item.body?.length > 200 ? '...' : ''}</p>
                      {item.related_lead_id && (
                        <p><strong>Related Lead:</strong> #{item.related_lead_id}</p>
                      )}
                      {item.related_campaign_id && (
                        <p><strong>Related Campaign:</strong> #{item.related_campaign_id}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons - Only for pending items */}
                {(item.status === 'pending_review' || item.status === 'pending_approval') && (
                  <div className="item-actions">
                    <button 
                      className="action-button approve"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(item, item.type, 'approve');
                      }}
                    >
                      ✓ Approve
                    </button>
                    <button 
                      className="action-button reject"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(item, item.type, 'reject');
                      }}
                    >
                      ✕ Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <h2 className="modal-title">
                  {selectedItem.type === 'lead' ? '👤 Lead Details' : '📝 Content Details'}
                </h2>
                <span className={`status-badge ${selectedItem.status}`}>
                  {selectedItem.status === 'pending_review' || selectedItem.status === 'pending_approval' ? '⏳ Pending' :
                   selectedItem.status === 'approved' ? '✓ Approved' :
                   selectedItem.status === 'rejected' ? '✕ Rejected' :
                   selectedItem.status === 'published' ? '🌐 Published' : selectedItem.status}
                </span>
              </div>
              <button className="close-button" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {selectedItem.type === 'lead' && (
                <>
                  <h3 className="detail-title">{selectedItem.company_name}</h3>
                  <div className="detail-grid">
                    <div className="detail-section">
                      <h4>Contact Information</h4>
                      <p><strong>Name:</strong> {selectedItem.contact_name || 'N/A'}</p>
                      <p><strong>Title:</strong> {selectedItem.contact_title || 'N/A'}</p>
                      <p><strong>Email:</strong> {selectedItem.contact_email || 'N/A'}</p>
                      <p><strong>LinkedIn:</strong> {selectedItem.contact_linkedin ? <a href={selectedItem.contact_linkedin} target="_blank" rel="noopener noreferrer">View Profile</a> : 'N/A'}</p>
                    </div>
                    <div className="detail-section">
                      <h4>Company Details</h4>
                      <p><strong>Website:</strong> {selectedItem.website ? <a href={selectedItem.website} target="_blank" rel="noopener noreferrer">{selectedItem.website}</a> : 'N/A'}</p>
                      <p><strong>LinkedIn:</strong> {selectedItem.linkedin_url ? <a href={selectedItem.linkedin_url} target="_blank" rel="noopener noreferrer">Company Page</a> : 'N/A'}</p>
                      <p><strong>Industry:</strong> {selectedItem.industry || 'N/A'}</p>
                      <p><strong>Size:</strong> {selectedItem.company_size || 'N/A'}</p>
                      <p><strong>Location:</strong> {selectedItem.location || 'N/A'}</p>
                    </div>
                    {selectedItem.ai_score !== null && (
                      <div className="detail-section full-width">
                        <h4>AI Analysis</h4>
                        <div className="score-display">
                          <span className="score-label">Score:</span>
                          <span className="score-value" style={{ color: getScoreColor(selectedItem.ai_score) }}>
                            {selectedItem.ai_score}/100
                          </span>
                          <span className={`fit-badge ${selectedItem.fit_category}`}>
                            {selectedItem.fit_category?.toUpperCase()}
                          </span>
                        </div>
                        {selectedItem.ai_reasoning && (
                          <p className="ai-reasoning-detail">{selectedItem.ai_reasoning}</p>
                        )}
                      </div>
                    )}
                    {selectedItem.tech_stack && selectedItem.tech_stack.length > 0 && (
                      <div className="detail-section full-width">
                        <h4>Tech Stack</h4>
                        <div className="tech-stack">
                          {selectedItem.tech_stack.map((tech, i) => (
                            <span key={i} className="tech-tag">{tech}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedItem.tags && selectedItem.tags.length > 0 && (
                      <div className="detail-section full-width">
                        <h4>Tags</h4>
                        <div className="tech-stack">
                          {selectedItem.tags.map((tag, i) => (
                            <span key={i} className="tech-tag">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {selectedItem.type === 'content' && (
                <>
                  <h3 className="detail-title">{selectedItem.title}</h3>
                  <div className="detail-grid">
                    <div className="detail-section">
                      <h4>Metadata</h4>
                      <p><strong>Type:</strong> <span className="content-type">{selectedItem.content_type}</span></p>
                      <p><strong>Format:</strong> {selectedItem.format || 'N/A'}</p>
                      <p><strong>Tone:</strong> {selectedItem.tone || 'N/A'}</p>
                      <p><strong>Generated by:</strong> {selectedItem.generated_by || 'N/A'}</p>
                      {selectedItem.published_at && (
                        <p><strong>Published:</strong> {formatDate(selectedItem.published_at)}</p>
                      )}
                    </div>
                    <div className="detail-section">
                      <h4>Performance</h4>
                      <p><strong>Views:</strong> {selectedItem.views || 0}</p>
                      <p><strong>Clicks:</strong> {selectedItem.clicks || 0}</p>
                      <p><strong>Engagement:</strong> {selectedItem.engagement_rate ? `${(selectedItem.engagement_rate * 100).toFixed(1)}%` : 'N/A'}</p>
                    </div>
                    {selectedItem.target_audience && (
                      <div className="detail-section full-width">
                        <h4>Target Audience</h4>
                        <p>{JSON.stringify(selectedItem.target_audience, null, 2)}</p>
                      </div>
                    )}
                    <div className="detail-section full-width">
                      <h4>Content</h4>
                      <div className="content-body-full">
                        {selectedItem.body}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              {(selectedItem.status === 'pending_review' || selectedItem.status === 'pending_approval') && (
                <>
                  <button 
                    className="modal-button approve"
                    onClick={() => {
                      setShowDetailModal(false);
                      handleAction(selectedItem, selectedItem.type, 'approve');
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button 
                    className="modal-button reject"
                    onClick={() => {
                      setShowDetailModal(false);
                      handleAction(selectedItem, selectedItem.type, 'reject');
                    }}
                  >
                    ✕ Reject
                  </button>
                </>
              )}
              <button 
                className="modal-button cancel"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showModal && selectedItem && (
        <div className="modal-overlay" onClick={cancelAction}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">
              {actionType === 'approve' ? '✓ Confirm Approval' : '✕ Confirm Rejection'}
            </h2>
            <p className="modal-text">
              Are you sure you want to <strong>{actionType}</strong> this <strong>{selectedItem.type}</strong>?
            </p>
            <div className="modal-summary">
              {selectedItem.type === 'lead' && <p><strong>{selectedItem.company_name}</strong></p>}
              {selectedItem.type === 'content' && <p><strong>{selectedItem.title}</strong></p>}
              {selectedItem.type === 'action' && <p><strong>{selectedItem.action_type}</strong></p>}
            </div>
            <div className="modal-actions">
              <button 
                className="modal-button cancel"
                onClick={cancelAction}
                disabled={processingAction}
              >
                Cancel
              </button>
              <button 
                className={`modal-button confirm ${actionType}`}
                onClick={confirmAction}
                disabled={processingAction}
              >
                {processingAction ? 'Processing...' : `${actionType === 'approve' ? 'Approve' : 'Reject'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Automation;
