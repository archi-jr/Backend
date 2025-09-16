// WebhookMonitor.js
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  ShoppingCart, 
  CreditCard, 
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';

const WebhookMonitor = () => {
  const [queueStatus, setQueueStatus] = useState(null);
  const [abandonmentMetrics, setAbandonmentMetrics] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchQueueStatus();
    fetchAbandonmentMetrics();
    fetchRecentEvents();
    
    // Set up polling
    const interval = setInterval(() => {
      fetchQueueStatus();
      fetchRecentEvents();
    }, 10000); // Poll every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchQueueStatus = async () => {
    try {
      const response = await fetch('/api/webhooks/queue/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setQueueStatus(data);
      }
    } catch (err) {
      console.error('Error fetching queue status:', err);
    }
  };

  const fetchAbandonmentMetrics = async () => {
    try {
      const shopId = localStorage.getItem('shopId');
      const response = await fetch(`/api/webhooks/analytics/abandonment/${shopId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAbandonmentMetrics(data);
      }
    } catch (err) {
      console.error('Error fetching abandonment metrics:', err);
    }
  };

  const fetchRecentEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/events/recent', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecentEvents(data);
      }
    } catch (err) {
      setError('Failed to fetch recent events');
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'CART_ABANDONED':
        return <ShoppingCart className="w-4 h-4" />;
      case 'CHECKOUT_STARTED':
        return <CreditCard className="w-4 h-4" />;
      case 'CHECKOUT_ABANDONED':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'PROCESSING':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Queue Status */}
      {queueStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Event Queue Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {queueStatus.highPriority.size}
                </div>
                <div className="text-sm text-gray-600">High Priority</div>
                <div className="text-xs text-gray-500">
                  {queueStatus.highPriority.pending} pending
                </div>
              </div>
              
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {queueStatus.normalPriority.size}
                </div>
                <div className="text-sm text-gray-600">Normal Priority</div>
                <div className="text-xs text-gray-500">
                  {queueStatus.normalPriority.pending} pending
                </div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {queueStatus.lowPriority.size}
                </div>
                <div className="text-sm text-gray-600">Low Priority</div>
                <div className="text-xs text-gray-500">
                  {queueStatus.lowPriority.pending} pending
                </div>
              </div>
            </div>
            
            {queueStatus.retryQueueSize > 0 && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {queueStatus.retryQueueSize} events in retry queue
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Abandonment Metrics */}
      {abandonmentMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Abandonment Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {abandonmentMetrics.metrics.map((metric, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="text-sm font-medium text-gray-600">
                    {metric.type} Abandonments
                  </div>
                  <div className="text-2xl font-bold">
                    {metric._count}
                  </div>
                  <div className="text-sm text-gray-500">
                    Total Value: ${metric._sum.value?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-sm text-gray-500">
                    Avg Value: ${metric._avg.value?.toFixed(2) || '0.00'}
                  </div>
                </div>
              ))}
            </div>
            
            {abandonmentMetrics.recoveryRate && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-gray-600">Recovery Rate</div>
                <div className="text-2xl font-bold text-blue-600">
                  {abandonmentMetrics.recoveryRate.rate}%
                </div>
                <div className="text-xs text-gray-500">
                  {abandonmentMetrics.recoveryRate.recovered} of {abandonmentMetrics.recoveryRate.abandoned} recovered
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Custom Events</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading events...</div>
          ) : error ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : recentEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recent events
            </div>
          ) : (
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {getEventIcon(event.eventType)}
                    <div>
                      <div className="font-medium">{event.eventType}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(event.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(event.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WebhookMonitor;
