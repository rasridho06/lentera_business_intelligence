'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users, GitMerge, GitBranch, CheckCircle, XCircle, AlertTriangle,
  Clock, MessageSquare, ArrowRight, Eye, UserPlus, LayoutDashboard,
} from 'lucide-react';
import type { MergeRequestData, CollaborationUserData } from '@/types';

const statusConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  open: { icon: <Eye className="h-4 w-4" />, color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', label: 'Open' },
  reviewing: { icon: <Users className="h-4 w-4" />, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Reviewing' },
  conflict: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Conflict' },
  merged: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-700', bg: 'bg-green-50 border-green-200', label: 'Merged' },
  closed: { icon: <XCircle className="h-4 w-4" />, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', label: 'Closed' },
};

export function CollaborationView() {
  const [mergeRequests, setMergeRequests] = useState<MergeRequestData[]>([]);
  const [users, setUsers] = useState<CollaborationUserData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [mrRes, usersRes] = await Promise.all([
      fetch('/api/merge-requests'),
      fetch('/api/users'),
    ]);
    setMergeRequests(await mrRes.json());
    setUsers(await usersRes.json());
    setLoading(false);
  }, []);

  // Load on mount
  const [initCollab] = useState(() => {
    setTimeout(() => { loadData(); }, 0);
    return true;
  });
  void initCollab;

  const handleMerge = async (id: string) => {
    await fetch('/api/merge-requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'merge' }),
    });
    loadData();
  };

  const handleResolveConflict = async (id: string) => {
    await fetch('/api/merge-requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'resolve_conflict' }),
    });
    loadData();
  };

  const parseConflict = (json: string | null) => {
    if (!json) return null;
    try { return JSON.parse(json); } catch { return null; }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Collaboration & Version Control</h2>
        <p className="text-sm text-muted-foreground">Real-time editing, branching, merge requests, and conflict resolution</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Users */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm">Team Members</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users.map(user => (
                  <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: user.color || '#666' }}
                    >
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] capitalize">{user.role}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Merge Requests */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitMerge className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-sm">Merge Requests</CardTitle>
                </div>
                <Badge variant="outline" className="text-[9px]">{mergeRequests.filter(mr => mr.status === 'open' || mr.status === 'conflict').length} open</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {mergeRequests.length === 0 ? (
                <div className="text-center py-8">
                  <GitMerge className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No merge requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mergeRequests.map(mr => {
                    const status = statusConfig[mr.status] || statusConfig.open;
                    const conflict = parseConflict(mr.conflictDetails);

                    return (
                      <div key={mr.id} className={`p-4 rounded-lg border ${status.bg}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={status.color}>{status.icon}</span>
                            <span className="font-medium text-sm">{mr.title}</span>
                          </div>
                          <Badge className={`text-[9px] ${status.color} ${status.bg} border`}>
                            {status.label}
                          </Badge>
                        </div>

                        {mr.description && (
                          <p className="text-xs text-muted-foreground mb-2">{mr.description}</p>
                        )}

                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" /> {mr.sourceBranch?.name}
                          </span>
                          <ArrowRight className="h-3 w-3" />
                          <span>{mr.targetBranch}</span>
                          <span className="flex items-center gap-1">
                            <LayoutDashboard className="h-3 w-3" /> {mr.sourceBranch?.dashboard?.name}
                          </span>
                        </div>

                        {/* Conflict details */}
                        {conflict && mr.status === 'conflict' && (
                          <div className="p-2 bg-red-100 rounded text-xs mb-2">
                            <div className="flex items-center gap-1 font-medium text-red-800 mb-1">
                              <AlertTriangle className="h-3 w-3" /> {conflict.reason}
                            </div>
                            <p className="text-red-700">{conflict.suggestion}</p>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5 inline mr-0.5" /> {new Date(mr.createdAt).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-2">
                            {mr.status === 'open' && (
                              <Button size="sm" className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700" onClick={() => handleMerge(mr.id)}>
                                <GitMerge className="h-3 w-3 mr-0.5" /> Merge
                              </Button>
                            )}
                            {mr.status === 'conflict' && (
                              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleResolveConflict(mr.id)}>
                                Resolve Conflict
                              </Button>
                            )}
                            {mr.status === 'merged' && (
                              <span className="text-[10px] text-green-700 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Merged {mr.mergedAt && new Date(mr.mergedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workflow Explanation */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm">How Collaboration Works</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2 text-lg font-bold">1</div>
                  <p className="text-sm font-medium">Edit Together</p>
                  <p className="text-xs text-muted-foreground mt-1">Multiple users can view dashboards simultaneously. See each other&apos;s cursors in real-time like Google Sheets.</p>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="h-10 w-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center mx-auto mb-2 text-lg font-bold">2</div>
                  <p className="text-sm font-medium">Lock on Edit</p>
                  <p className="text-xs text-muted-foreground mt-1">When a user edits a chart, it gets locked. Others can see who is editing and must wait or branch.</p>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="h-10 w-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center mx-auto mb-2 text-lg font-bold">3</div>
                  <p className="text-sm font-medium">Branch Changes</p>
                  <p className="text-xs text-muted-foreground mt-1">Like GitHub branches — create a branch to work on changes without affecting the main dashboard.</p>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-2 text-lg font-bold">4</div>
                  <p className="text-sm font-medium">Merge & Resolve</p>
                  <p className="text-xs text-muted-foreground mt-1">Submit a merge request. System checks for conflicts. If none, merge. If conflicts, resolve before merging.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
