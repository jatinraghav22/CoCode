"use strict";

/**
 * DashboardService — aggregates user-scoped statistics and activity.
 *
 * Scopes all data strictly to the authenticated user ID.
 * Returns real database-backed values for active rooms and language usage from room documents.
 * For metrics that do not have a dedicated backing table in the schema (e.g. projects, session duration),
 * returns safe zero/empty defaults without failing or inventing artificial data.
 */

const LANGUAGE_META = Object.freeze({
  javascript: { name: "JavaScript", color: "#facc15", icon: "⚡" },
  js: { name: "JavaScript", color: "#facc15", icon: "⚡" },
  python: { name: "Python", color: "#38bdf8", icon: "🐍" },
  py: { name: "Python", color: "#38bdf8", icon: "🐍" },
  cpp: { name: "C++", color: "#60a5fa", icon: "⚙️" },
  "c++": { name: "C++", color: "#60a5fa", icon: "⚙️" },
  c: { name: "C", color: "#818cf8", icon: "🔧" },
  java: { name: "Java", color: "#c084fc", icon: "☕" },
  css: { name: "CSS", color: "#38bdf8", icon: "🎨" },
  html: { name: "HTML / CSS", color: "#fb923c", icon: "🌐" },
  typescript: { name: "TypeScript", color: "#3b82f6", icon: "🔷" },
  ts: { name: "TypeScript", color: "#3b82f6", icon: "🔷" },
  rust: { name: "Rust", color: "#f97316", icon: "🦀" },
  go: { name: "Go", color: "#06b6d4", icon: "🐹" },
});

class DashboardService {
  /**
   * @param {Object} prisma - PrismaClient instance.
   */
  constructor(prisma) {
    if (!prisma) {
      throw new Error("DashboardService requires a prisma client.");
    }
    this.prisma = prisma;
  }

  /**
   * Retrieves dashboard statistics scoped to the authenticated user.
   *
   * @param {string} userId - Authenticated user ID.
   * @returns {Promise<Object>} Dashboard payload matching frontend contract.
   */
  async getDashboardData(userId) {
    if (!userId) {
      const err = new Error("User ID is required.");
      err.statusCode = 400;
      throw err;
    }

    // 1. Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }

    // 2. Count active collaboration rooms where the user is owner or participant
    let activeRoomsCount = 0;
    try {
      if (this.prisma.collaborationRoom && typeof this.prisma.collaborationRoom.count === "function") {
        activeRoomsCount = await this.prisma.collaborationRoom.count({
          where: {
            OR: [
              { ownerId: userId },
              { participants: { some: { userId } } },
            ],
            isActive: true,
          },
        });
      }
    } catch (roomErr) {
      console.warn("Failed to query active rooms for dashboard:", roomErr.message);
      activeRoomsCount = 0;
    }

    // 3. Derive real language statistics from user's collaboration room documents
    let languagesUsedCount = 0;
    let popularLanguages = [];

    try {
      if (this.prisma.collaborationRoom && typeof this.prisma.collaborationRoom.findMany === "function") {
        const userRooms = await this.prisma.collaborationRoom.findMany({
          where: {
            OR: [
              { ownerId: userId },
              { participants: { some: { userId } } },
            ],
          },
          select: {
            documents: {
              select: { language: true },
            },
          },
        });

        const langWeights = new Map();
        let totalDocs = 0;

        for (const room of userRooms) {
          for (const doc of room.documents || []) {
            if (doc.language && typeof doc.language === "string") {
              const langKey = doc.language.trim().toLowerCase();
              langWeights.set(langKey, (langWeights.get(langKey) || 0) + 1);
              totalDocs++;
            }
          }
        }

        languagesUsedCount = langWeights.size;

        if (totalDocs > 0) {
          const sorted = Array.from(langWeights.entries()).sort((a, b) => b[1] - a[1]);
          let accumulatedPct = 0;
          const top = sorted.slice(0, 4);
          const remainder = sorted.slice(4);

          popularLanguages = top.map(([langKey, count]) => {
            const meta = LANGUAGE_META[langKey] || {
              name: langKey.charAt(0).toUpperCase() + langKey.slice(1),
              color: "#94a3b8",
              icon: "💻",
            };
            const percentage = Math.round((count / totalDocs) * 100);
            accumulatedPct += percentage;
            return {
              name: meta.name,
              percentage,
              color: meta.color,
              icon: meta.icon,
            };
          });

          if (remainder.length > 0) {
            const othersPct = Math.max(1, 100 - accumulatedPct);
            popularLanguages.push({
              name: "Others",
              percentage: othersPct,
              color: "#94a3b8",
              icon: "📦",
            });
          } else if (popularLanguages.length > 0) {
            const diff = 100 - popularLanguages.reduce((sum, item) => sum + item.percentage, 0);
            if (diff !== 0 && popularLanguages[0]) {
              popularLanguages[0].percentage += diff;
            }
          }
        }
      }
    } catch (langErr) {
      console.warn("Failed to derive language statistics for dashboard:", langErr.message);
      languagesUsedCount = 0;
      popularLanguages = [];
    }

    // 4. Safe defaults for metrics without backing tables in server-v2 schema
    // Projects and session duration are not persisted in server-v2's real-time collaboration schema.
    const totalProjects = 0;
    const todayActivityMinutes = 0;
    const recentProjects = [];

    return {
      success: true,
      stats: {
        totalProjects,
        activeRooms: activeRoomsCount,
        todayActivityMinutes,
        languagesUsedCount,
      },
      recentProjects,
      popularLanguages,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }
}

module.exports = { DashboardService, LANGUAGE_META };
