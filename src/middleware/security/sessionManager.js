const { session: sessionConfig } = require('../../config/security.config');

class SessionManager {
  constructor() {
    this.sessions = new Map(); // In-memory session tracking
    this.activityTimestamps = new Map();
    this.startCleanupInterval();
  }

  // Initialize session for a user
  initSession(userId, tenantId, req) {
    const sessionId = this.generateSessionId();
    const sessionData = {
      userId,
      tenantId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      isActive: true,
    };

    this.sessions.set(sessionId, sessionData);
    this.activityTimestamps.set(userId, Date.now());

    // Set session timeout
    this.setSessionTimeout(sessionId);

    return sessionId;
  }

  // Update session activity
  updateActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && session.isActive) {
      const now = Date.now();
      session.lastActivity = now;
      this.activityTimestamps.set(session.userId, now);

      // Extend session if configured
      if (sessionConfig.extendOnActivity) {
        this.setSessionTimeout(sessionId);
      }

      return true;
    }
    return false;
  }

  // Check if session is valid
  isValidSession(sessionId, tenantId) {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      return false;
    }

    // Check tenant isolation
    if (session.tenantId !== tenantId) {
      console.error(`Tenant isolation violation: Session ${sessionId} tried to access tenant ${tenantId}`);
      this.terminateSession(sessionId);
      return false;
    }

    // Check session timeout
    const inactivityTime = Date.now() - session.lastActivity;
    if (inactivityTime > sessionConfig.timeout) {
      this.terminateSession(sessionId);
      return false;
    }

    // Check absolute maximum age
    const sessionAge = Date.now() - session.createdAt;
    if (sessionAge > sessionConfig.maxAge) {
      this.terminateSession(sessionId);
      return false;
    }

    return true;
  }

  // Terminate a session
  terminateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.activityTimestamps.delete(session.userId);
      
      // Keep terminated session for audit purposes
      setTimeout(() => {
        this.sessions.delete(sessionId);
      }, 24 * 60 * 60 * 1000); // Delete after 24 hours
    }
  }

  // Set session timeout
  setSessionTimeout(sessionId) {
    setTimeout(() => {
      const session = this.sessions.get(sessionId);
      if (session && session.isActive) {
        const inactivityTime = Date.now() - session.lastActivity;
        if (inactivityTime >= sessionConfig.timeout) {
          this.terminateSession(sessionId);
        } else {
          // Re-check after remaining time
          setTimeout(() => {
            this.setSessionTimeout(sessionId);
          }, sessionConfig.timeout - inactivityTime);
        }
      }
    }, sessionConfig.timeout);
  }

  // Generate unique session ID
  generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get active sessions for a tenant
  getTenantSessions(tenantId) {
    const tenantSessions = [];
    for (const [sessionId, session] of this.sessions) {
      if (session.tenantId === tenantId && session.isActive) {
        tenantSessions.push({
          sessionId,
          userId: session.userId,
          lastActivity: session.lastActivity,
          ipAddress: session.ipAddress,
        });
      }
    }
    return tenantSessions;
  }

  // Cleanup expired sessions periodically
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of this.sessions) {
        if (session.isActive) {
          const inactivityTime = now - session.lastActivity;
          const sessionAge = now - session.createdAt;

          if (inactivityTime > sessionConfig.timeout || sessionAge > sessionConfig.maxAge) {
            this.terminateSession(sessionId);
          }
        }
      }
    }, sessionConfig.checkInterval);
  }

  // Get session info
  getSessionInfo(sessionId) {
    return this.sessions.get(sessionId);
  }

  // Check concurrent sessions limit
  checkConcurrentSessions(userId, maxSessions = 3) {
    let activeCount = 0;
    const userSessions = [];

    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId && session.isActive) {
        activeCount++;
        userSessions.push({ sessionId, createdAt: session.createdAt });
      }
    }

    // If exceeded, terminate oldest sessions
    if (activeCount >= maxSessions) {
      userSessions.sort((a, b) => a.createdAt - b.createdAt);
      const sessionsToTerminate = userSessions.slice(0, activeCount - maxSessions + 1);
      
      for (const session of sessionsToTerminate) {
        this.terminateSession(session.sessionId);
      }
    }

    return activeCount < maxSessions;
  }
}

// Export singleton instance
module.exports = new SessionManager();
