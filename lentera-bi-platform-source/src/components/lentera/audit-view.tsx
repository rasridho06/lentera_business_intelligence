'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Info, Shield, GitBranch, Database, BarChart3, FileText } from 'lucide-react';

interface AuditData {
  findings: Array<{
    id: string;
    ruleId: string;
    ruleVersion: string;
    severity: string;
    title: string;
    description: string;
    evidence: Record<string, unknown> | null;
    recommendation: string | null;
    status: string;
    suppressionReason: string | null;
    node: {
      id: string;
      name: string;
      type: string;
      platform: string;
      qualifiedName: string;
    } | null;
    createdAt: string;
  }>;
  rules: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  severityCounts: Record<string, number>;
  total: number;
}

const severityConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; badge: string }> = {
  critical: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-700', bg: 'bg-red-50 border-red-200', badge: 'destructive' },
  error: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', badge: 'destructive' },
  warning: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', badge: 'secondary' },
  info: { icon: <Info className="h-4 w-4" />, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', badge: 'secondary' },
};

const ruleIcons: Record<string, React.ReactNode> = {
  R1: <Shield className="h-4 w-4" />,
  R2: <Database className="h-4 w-4" />,
  R3: <BarChart3 className="h-4 w-4" />,
  R4: <GitBranch className="h-4 w-4" />,
  R5: <FileText className="h-4 w-4" />,
  R6: <GitBranch className="h-4 w-4" />,
  R7: <FileText className="h-4 w-4" />,
  R8: <Database className="h-4 w-4" />,
};

export function AuditView({ data }: { data: AuditData }) {
  const findingsByRule = data.rules.map(rule => ({
    ...rule,
    findings: data.findings.filter(f => f.ruleId === rule.id),
  })).filter(r => r.findings.length > 0);

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(data.severityCounts).map(([sev, count]) => {
          const config = severityConfig[sev];
          if (!config) return null;
          return (
            <div key={sev} className={`p-4 rounded-lg border ${config.bg} flex items-center gap-3`}>
              <span className={config.color}>{config.icon}</span>
              <div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs capitalize text-muted-foreground">{sev}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Findings by Rule */}
      <div className="space-y-4">
        {findingsByRule.map(rule => (
          <Card key={rule.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted">
                  {ruleIcons[rule.id] || <AlertTriangle className="h-4 w-4" />}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono">{rule.id}</Badge>
                    <CardTitle className="text-sm">{rule.name}</CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                </div>
                <Badge variant="secondary" className="text-xs">{rule.findings.length} finding{rule.findings.length > 1 ? 's' : ''}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {rule.findings.map(finding => {
                const sevConfig = severityConfig[finding.severity] || severityConfig.info;
                return (
                  <div key={finding.id} className={`p-4 rounded-lg border ${sevConfig.bg}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={sevConfig.color}>{sevConfig.icon}</span>
                        <span className="font-medium text-sm">{finding.title}</span>
                      </div>
                      <Badge variant={sevConfig.badge as "destructive" | "secondary"} className="text-xs capitalize shrink-0">
                        {finding.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{finding.description}</p>
                    {finding.node && (
                      <div className="text-xs mb-2 flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] capitalize">{finding.node.type.replace('_', ' ')}</Badge>
                        <span className="font-mono text-muted-foreground">{finding.node.qualifiedName}</span>
                      </div>
                    )}
                    {finding.evidence && (
                      <div className="text-xs bg-white/50 rounded p-2 mb-2 font-mono overflow-x-auto max-h-32">
                        <pre className="whitespace-pre-wrap">{JSON.stringify(finding.evidence, null, 2)}</pre>
                      </div>
                    )}
                    {finding.recommendation && (
                      <div className="flex items-start gap-2 text-xs">
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                        <span><span className="font-medium">Remediation:</span> {finding.recommendation}</span>
                      </div>
                    )}
                    {finding.status === 'suppressed' && finding.suppressionReason && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Info className="h-3 w-3" />
                        Suppressed: {finding.suppressionReason}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
