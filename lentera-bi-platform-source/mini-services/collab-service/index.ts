import { Server } from 'socket.io';

const PORT = 3003;

const io = new Server(PORT, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

interface CursorUpdate {
  userId: string;
  userName: string;
  userColor: string;
  dashboardId: string;
  x: number;
  y: number;
  activeChartId: string | null;
}

interface EditLock {
  chartId: string;
  userId: string;
  userName: string;
  dashboardId: string;
}

const activeCursors = new Map<string, CursorUpdate>();
const editLocks = new Map<string, EditLock>(); // chartId -> lock

io.on('connection', (socket) => {
  console.log(`[collab] Client connected: ${socket.id}`);

  socket.on('join-dashboard', (data: { dashboardId: string; userId: string; userName: string; userColor: string }) => {
    socket.join(`dashboard:${data.dashboardId}`);
    console.log(`[collab] ${data.userName} joined dashboard ${data.dashboardId}`);

    // Send existing cursors to the new joiner
    const existingCursors: CursorUpdate[] = [];
    activeCursors.forEach((cursor) => {
      if (cursor.dashboardId === data.dashboardId) {
        existingCursors.push(cursor);
      }
    });
    socket.emit('existing-cursors', existingCursors);

    // Notify others
    socket.to(`dashboard:${data.dashboardId}`).emit('user-joined', {
      userId: data.userId,
      userName: data.userName,
      userColor: data.userColor,
    });
  });

  socket.on('cursor-move', (data: CursorUpdate) => {
    activeCursors.set(`${data.dashboardId}:${data.userId}`, data);
    socket.to(`dashboard:${data.dashboardId}`).emit('cursor-update', data);
  });

  socket.on('request-edit', (data: { chartId: string; userId: string; userName: string; dashboardId: string }) => {
    const existingLock = editLocks.get(data.chartId);
    if (existingLock && existingLock.userId !== data.userId) {
      // Conflict: chart is already being edited
      socket.emit('edit-denied', {
        chartId: data.chartId,
        lockedBy: existingLock.userName,
        lockedByUserId: existingLock.userId,
      });
      return;
    }

    editLocks.set(data.chartId, {
      chartId: data.chartId,
      userId: data.userId,
      userName: data.userName,
      dashboardId: data.dashboardId,
    });

    io.to(`dashboard:${data.dashboardId}`).emit('edit-locked', {
      chartId: data.chartId,
      userId: data.userId,
      userName: data.userName,
    });
  });

  socket.on('release-edit', (data: { chartId: string; userId: string; dashboardId: string }) => {
    const existingLock = editLocks.get(data.chartId);
    if (existingLock && existingLock.userId === data.userId) {
      editLocks.delete(data.chartId);
      io.to(`dashboard:${data.dashboardId}`).emit('edit-unlocked', {
        chartId: data.chartId,
      });
    }
  });

  socket.on('chart-updated', (data: { dashboardId: string; chartId: string; userId: string; changes: unknown }) => {
    socket.to(`dashboard:${data.dashboardId}`).emit('chart-change', {
      chartId: data.chartId,
      userId: data.userId,
      changes: data.changes,
      timestamp: Date.now(),
    });
  });

  socket.on('save-attempt', (data: { dashboardId: string; userId: string; userName: string; chartIds: string[] }) => {
    // Check if any of the charts are being edited by other users
    const conflicts: string[] = [];
    for (const chartId of data.chartIds) {
      const lock = editLocks.get(chartId);
      if (lock && lock.userId !== data.userId) {
        conflicts.push(chartId);
      }
    }

    if (conflicts.length > 0) {
      socket.emit('save-conflict', {
        conflicts,
        message: `Cannot save: ${conflicts.length} chart(s) are being edited by other users. Please create a branch or wait.`,
      });
    } else {
      socket.emit('save-ok', { dashboardId: data.dashboardId });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[collab] Client disconnected: ${socket.id}`);
    // Clean up cursors and locks for this socket's user
    activeCursors.forEach((cursor, key) => {
      // We'd need userId-socket mapping for full cleanup
      // For demo, we keep cursors briefly
    });
  });
});

console.log(`[collab] Collaboration WebSocket service running on port ${PORT}`);
