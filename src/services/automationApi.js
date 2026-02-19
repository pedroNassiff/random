const API_URL = import.meta.env.VITE_AUTOMATION_API || '/api/automation';

export const automationApi = {
  // Dashboard metrics
  async getDashboard() {
    try {
      const response = await fetch(`${API_URL}/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch automation dashboard');
      return await response.json();
    } catch (error) {
      console.error('Error fetching automation dashboard:', error);
      throw error;
    }
  },

  // Pending approvals
  async getPendingApprovals() {
    try {
      const response = await fetch(`${API_URL}/pending-approvals`);
      if (!response.ok) throw new Error('Failed to fetch pending approvals');
      return await response.json();
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      throw error;
    }
  },

  // Leads
  async getLeads() {
    try {
      const response = await fetch(`${API_URL}/leads`);
      if (!response.ok) throw new Error('Failed to fetch leads');
      return await response.json();
    } catch (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }
  },

  async approveLead(leadId) {
    try {
      const response = await fetch(`${API_URL}/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      if (!response.ok) throw new Error('Failed to approve lead');
      return await response.json();
    } catch (error) {
      console.error('Error approving lead:', error);
      throw error;
    }
  },

  async rejectLead(leadId) {
    try {
      const response = await fetch(`${API_URL}/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });
      if (!response.ok) throw new Error('Failed to reject lead');
      return await response.json();
    } catch (error) {
      console.error('Error rejecting lead:', error);
      throw error;
    }
  },

  // Content
  async getContent() {
    try {
      const response = await fetch(`${API_URL}/content`);
      if (!response.ok) throw new Error('Failed to fetch content');
      return await response.json();
    } catch (error) {
      console.error('Error fetching content:', error);
      throw error;
    }
  },

  async approveContent(contentId) {
    try {
      const response = await fetch(`${API_URL}/content/${contentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      if (!response.ok) throw new Error('Failed to approve content');
      return await response.json();
    } catch (error) {
      console.error('Error approving content:', error);
      throw error;
    }
  },

  async rejectContent(contentId) {
    try {
      const response = await fetch(`${API_URL}/content/${contentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });
      if (!response.ok) throw new Error('Failed to reject content');
      return await response.json();
    } catch (error) {
      console.error('Error rejecting content:', error);
      throw error;
    }
  },

  async publishContent(contentId, platforms) {
    try {
      const response = await fetch(`${API_URL}/content/${contentId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms })
      });
      if (!response.ok) throw new Error('Failed to publish content');
      return await response.json();
    } catch (error) {
      console.error('Error publishing content:', error);
      throw error;
    }
  },

  // Actions (automation logs) - Read-only, no approve/reject
  async approveAction(actionId) {
    // Logs are audit trails, typically read-only
    // If needed, implement a status update mechanism in the backend
    console.warn('Action approval not implemented - logs are audit trails');
    return { success: false, message: 'Action logs are read-only audit trails' };
  },

  async rejectAction(actionId) {
    console.warn('Action rejection not implemented - logs are audit trails');
    return { success: false, message: 'Action logs are read-only audit trails' };
  },

  // Campaigns
  async getCampaigns() {
    try {
      const response = await fetch(`${API_URL}/campaigns`);
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      return await response.json();
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      throw error;
    }
  }
};
