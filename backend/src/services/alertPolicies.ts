/**
 * Alert Policies Configuration
 * Defines thresholds and conditions for alerting
 */

import { addBreadcrumb, captureMessage } from '@/config/sentry';

export interface AlertPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'error_rate' | 'response_time' | 'uptime' | 'throughput';
  condition: {
    metric: string;
    operator: '>' | '<' | '==' | '!=' | '>=' | '<=';
    threshold: number;
    unit?: string;
  };
  evaluationWindow: number; // in seconds
  alertThreshold: number; // number of breaches to trigger alert
  actions: AlertAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'slack' | 'pagerduty';
  target: string;
  escalationLevel?: number; // for PagerDuty
}

export interface AlertEvent {
  policyId: string;
  policyName: string;
  severity: 'warning' | 'critical';
  value: number;
  threshold: number;
  timestamp: Date;
  message: string;
}

class AlertPolicyManager {
  private policies: Map<string, AlertPolicy> = new Map();
  private alertHistory: AlertEvent[] = [];
  private maxHistorySize = 1000;

  constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize default alert policies
   */
  private initializeDefaultPolicies(): void {
    // Policy 1: 5xx errors > threshold
    this.addPolicy({
      id: 'error_rate_5xx',
      name: '5xx Error Rate Alert',
      description: 'Alert when 5xx errors exceed threshold',
      enabled: true,
      type: 'error_rate',
      condition: {
        metric: 'error_rate_5xx',
        operator: '>',
        threshold: 5, // 5% threshold
        unit: 'percent',
      },
      evaluationWindow: 300, // 5 minutes
      alertThreshold: 2, // Alert after 2 consecutive breaches
      actions: [
        {
          type: 'email',
          target: process.env.ALERT_EMAIL || 'admin@example.com',
        },
        {
          type: 'slack',
          target: process.env.SLACK_WEBHOOK_URL || '',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Policy 2: Slow routes > 1.5s
    this.addPolicy({
      id: 'slow_routes',
      name: 'Slow Route Response Time Alert',
      description: 'Alert when route response time exceeds 1.5 seconds',
      enabled: true,
      type: 'response_time',
      condition: {
        metric: 'route_response_time',
        operator: '>',
        threshold: 1500,
        unit: 'ms',
      },
      evaluationWindow: 300, // 5 minutes
      alertThreshold: 3, // Alert after 3 consecutive slow requests
      actions: [
        {
          type: 'email',
          target: process.env.ALERT_EMAIL || 'admin@example.com',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Policy 3: Uptime < 99.5%
    this.addPolicy({
      id: 'uptime_degradation',
      name: 'Uptime Degradation Alert',
      description: 'Alert when uptime drops below 99.5%',
      enabled: true,
      type: 'uptime',
      condition: {
        metric: 'uptime',
        operator: '<',
        threshold: 99.5,
        unit: 'percent',
      },
      evaluationWindow: 3600, // 1 hour
      alertThreshold: 1, // Alert immediately
      actions: [
        {
          type: 'email',
          target: process.env.ALERT_EMAIL || 'admin@example.com',
        },
        {
          type: 'slack',
          target: process.env.SLACK_WEBHOOK_URL || '',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Policy 4: High error throughput
    this.addPolicy({
      id: 'error_throughput_high',
      name: 'High Error Throughput Alert',
      description: 'Alert when error requests exceed 100 per minute',
      enabled: true,
      type: 'throughput',
      condition: {
        metric: 'error_request_rate',
        operator: '>',
        threshold: 100,
        unit: 'requests/min',
      },
      evaluationWindow: 60, // 1 minute
      alertThreshold: 2, // Alert after 2 consecutive minutes
      actions: [
        {
          type: 'email',
          target: process.env.ALERT_EMAIL || 'admin@example.com',
        },
        {
          type: 'slack',
          target: process.env.SLACK_WEBHOOK_URL || '',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ Initialized 4 default alert policies');
  }

  /**
   * Add a new alert policy
   */
  addPolicy(policy: AlertPolicy): void {
    this.policies.set(policy.id, policy);
    addBreadcrumb(`Alert policy added: ${policy.name}`, 'alert', 'info');
  }

  /**
   * Get all policies
   */
  getPolicies(): AlertPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get policy by ID
   */
  getPolicy(id: string): AlertPolicy | undefined {
    return this.policies.get(id);
  }

  /**
   * Update a policy
   */
  updatePolicy(id: string, updates: Partial<AlertPolicy>): boolean {
    const policy = this.policies.get(id);
    if (!policy) return false;

    const updated = { ...policy, ...updates, updatedAt: new Date() };
    this.policies.set(id, updated);
    addBreadcrumb(`Alert policy updated: ${policy.name}`, 'alert', 'info');
    return true;
  }

  /**
   * Enable/disable a policy
   */
  setEnabled(id: string, enabled: boolean): void {
    const policy = this.policies.get(id);
    if (policy) {
      policy.enabled = enabled;
      policy.updatedAt = new Date();
      addBreadcrumb(
        `Alert policy ${enabled ? 'enabled' : 'disabled'}: ${policy.name}`,
        'alert',
        'info'
      );
    }
  }

  /**
   * Evaluate a metric against all policies
   */
  evaluateMetric(
    metric: string,
    value: number
  ): AlertEvent[] {
    const triggeredAlerts: AlertEvent[] = [];

    for (const [, policy] of this.policies) {
      if (!policy.enabled || policy.condition.metric !== metric) {
        continue;
      }

      if (this.checkCondition(value, policy.condition)) {
        const alert: AlertEvent = {
          policyId: policy.id,
          policyName: policy.name,
          severity: this.determineSeverity(policy),
          value,
          threshold: policy.condition.threshold,
          timestamp: new Date(),
          message: this.generateAlertMessage(policy, value),
        };

        triggeredAlerts.push(alert);
        this.recordAlert(alert);
        this.sendAlert(alert, policy);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Check if metric value meets condition
   */
  private checkCondition(
    value: number,
    condition: AlertPolicy['condition']
  ): boolean {
    switch (condition.operator) {
      case '>':
        return value > condition.threshold;
      case '<':
        return value < condition.threshold;
      case '>=':
        return value >= condition.threshold;
      case '<=':
        return value <= condition.threshold;
      case '==':
        return value === condition.threshold;
      case '!=':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Determine alert severity
   */
  private determineSeverity(policy: AlertPolicy): 'warning' | 'critical' {
    if (policy.type === 'error_rate' || policy.type === 'uptime') {
      return 'critical';
    }
    return 'warning';
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(policy: AlertPolicy, value: number): string {
    const unit = policy.condition.unit ? ` ${policy.condition.unit}` : '';
    return `${policy.name}: Current value ${value}${unit} ${policy.condition.operator} ${policy.condition.threshold}${unit}`;
  }

  /**
   * Record alert in history
   */
  private recordAlert(alert: AlertEvent): void {
    this.alertHistory.push(alert);

    // Keep history size manageable
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.shift();
    }
  }

  /**
   * Send alert notifications
   */
  private sendAlert(alert: AlertEvent, policy: AlertPolicy): void {
    captureMessage(alert.message, alert.severity === 'critical' ? 'error' : 'warning');

    for (const action of policy.actions) {
      switch (action.type) {
        case 'email':
          this.sendEmailAlert(alert, action.target);
          break;
        case 'slack':
          this.sendSlackAlert(alert, action.target);
          break;
        case 'webhook':
          this.sendWebhookAlert(alert, action.target);
          break;
        case 'pagerduty':
          this.sendPagerDutyAlert(alert, action);
          break;
      }
    }
  }

  /**
   * Send email alert
   */
  private sendEmailAlert(alert: AlertEvent, email: string): void {
    // TODO: Implement email sending
    console.log(`📧 Sending email alert to ${email}: ${alert.message}`);
  }

  /**
   * Send Slack alert
   */
  private sendSlackAlert(alert: AlertEvent, webhookUrl: string): void {
    if (!webhookUrl) return;

    const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';
    const color = alert.severity === 'critical' ? 'danger' : 'warning';

    const payload = {
      attachments: [
        {
          color,
          title: `${emoji} ${alert.policyName}`,
          text: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Value',
              value: `${alert.value}`,
              short: true,
            },
            {
              title: 'Threshold',
              value: `${alert.threshold}`,
              short: true,
            },
            {
              title: 'Time',
              value: alert.timestamp.toISOString(),
              short: true,
            },
          ],
        },
      ],
    };

    // Send to Slack
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(error => {
      console.error('Failed to send Slack alert:', error);
    });
  }

  /**
   * Send webhook alert
   */
  private sendWebhookAlert(alert: AlertEvent, webhookUrl: string): void {
    // TODO: Implement webhook
    console.log(`🔗 Sending webhook alert: ${alert.message}`);
  }

  /**
   * Send PagerDuty alert
   */
  private sendPagerDutyAlert(
    alert: AlertEvent,
    action: AlertAction
  ): void {
    // TODO: Implement PagerDuty integration
    console.log(`📲 Sending PagerDuty alert: ${alert.message}`);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit?: number): AlertEvent[] {
    const history = [...this.alertHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Clear alert history
   */
  clearAlertHistory(): void {
    this.alertHistory = [];
    addBreadcrumb('Alert history cleared', 'alert', 'info');
  }
}

// Singleton instance
const alertManager = new AlertPolicyManager();

export default alertManager;
