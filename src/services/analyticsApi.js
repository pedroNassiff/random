const API_URL = import.meta.env.VITE_ANALYTICS_API || 'http://localhost:8000/analytics';

export const analyticsApi = {
  async getSummary(days = 30) {
    try {
      const response = await fetch(`${API_URL}/summary?days=${days}`);
      if (!response.ok) throw new Error('Failed to fetch analytics summary');
      return await response.json();
    } catch (error) {
      console.error('Error fetching analytics summary:', error);
      throw error;
    }
  },

  async getTopPages(days = 30, limit = 10) {
    try {
      const response = await fetch(`${API_URL}/top-pages?days=${days}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch top pages');
      return await response.json();
    } catch (error) {
      console.error('Error fetching top pages:', error);
      throw error;
    }
  },

  async getTopEvents(days = 30, limit = 10) {
    try {
      const response = await fetch(`${API_URL}/top-events?days=${days}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch top events');
      return await response.json();
    } catch (error) {
      console.error('Error fetching top events:', error);
      throw error;
    }
  },

  async getEngagementZones(days = 30, limit = 10) {
    try {
      const response = await fetch(`${API_URL}/top-engagement-zones?days=${days}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch engagement zones');
      return await response.json();
    } catch (error) {
      console.error('Error fetching engagement zones:', error);
      throw error;
    }
  },

  async getUsersActivity(days = 30, limit = 20) {
    try {
      const response = await fetch(`${API_URL}/users-activity?days=${days}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch users activity');
      return await response.json();
    } catch (error) {
      console.error('Error fetching users activity:', error);
      throw error;
    }
  }
};
