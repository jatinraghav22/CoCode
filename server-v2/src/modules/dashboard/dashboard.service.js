"use strict";

/**
 * DashboardService — aggregates user-scoped statistics and activity.
 *
 * Scopes all data strictly to the authenticated user ID.
 * Returns real database-backed values for:
 * - Total Projects
 * - Active Rooms
 * - Today's Coding Activity
 * - Languages Used
 * - Recent Projects
 * - Recent Activity
 * - Popular Languages
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

function formatTimeAgo(date) {
  if (!date) return "Recently";
  const now = new Date();
  const d = new Date(date);
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function getIconTypeForLanguage(lang) {
  if (!lang || typeof lang !== "string") return "code";
  const l = lang.toLowerCase();
  if (l.includes("html") || l.includes("web") || l.includes("css")) return "web";
  if (l.includes("python") || l.includes("calc")) return "calc";
  if (l.includes("js") || l.includes("javascript") || l.includes("react")) return "weather";
  return "code";
}

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

    // 3. Count total projects owned by user
    let totalProjects = 0;
    try {
      if (this.prisma.project && typeof this.prisma.project.count === "function") {
        totalProjects = await this.prisma.project.count({
          where: { userId },
        });
      }
    } catch (projErr) {
      console.warn("Failed to query total projects for dashboard:", projErr.message);
      totalProjects = 0;
    }

    // 4. Retrieve recent projects
    let recentProjects = [];
    try {
      if (this.prisma.project && typeof this.prisma.project.findMany === "function") {
        const rawProjects = await this.prisma.project.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          take: 5,
          include: {
            files: { select: { id: true, name: true, language: true } },
          },
        });

        recentProjects = rawProjects.map((p) => {
          const lang = p.defaultLanguage || "javascript";
          return {
            id: p.id,
            name: p.name,
            description: p.description || "",
            language: lang,
            defaultLanguage: lang,
            fileCount: p.files ? p.files.length : 0,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            updatedText: formatTimeAgo(p.updatedAt),
            iconType: getIconTypeForLanguage(lang),
          };
        });
      }
    } catch (recErr) {
      console.warn("Failed to query recent projects for dashboard:", recErr.message);
      recentProjects = [];
    }

    // 5. Query today's coding activity and recent activities
    let todayActivityMinutes = 0;
    let recentActivities = [];
    try {
      if (this.prisma.codingActivity && typeof this.prisma.codingActivity.findMany === "function") {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [todayActivities, rawRecentActivities] = await Promise.all([
          this.prisma.codingActivity.findMany({
            where: {
              userId,
              createdAt: { gte: startOfToday },
            },
            select: { durationSeconds: true },
          }),
          this.prisma.codingActivity.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
              project: { select: { id: true, name: true } },
            },
          }),
        ]);

        let totalDurationSec = 0;
        for (const act of todayActivities) {
          if (act.durationSeconds) {
            totalDurationSec += act.durationSeconds;
          }
        }
        todayActivityMinutes = Math.round(totalDurationSec / 60);

        recentActivities = rawRecentActivities.map((a) => ({
          id: a.id,
          eventType: a.eventType,
          language: a.language,
          status: a.status,
          projectName: a.project?.name || null,
          durationSeconds: a.durationSeconds,
          createdAt: a.createdAt,
        }));
      }
    } catch (actErr) {
      console.warn("Failed to query activities for dashboard:", actErr.message);
      todayActivityMinutes = 0;
      recentActivities = [];
    }

    // 6. Aggregate language usage across:
    // a) Room documents
    // b) Project files and project default languages
    // c) Coding activities
    const langWeights = new Map();
    let totalLanguageTokens = 0;

    // From collaboration rooms
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

        for (const room of userRooms) {
          for (const doc of room.documents || []) {
            if (doc.language && typeof doc.language === "string") {
              const langKey = doc.language.trim().toLowerCase();
              langWeights.set(langKey, (langWeights.get(langKey) || 0) + 1);
              totalLanguageTokens++;
            }
          }
        }
      }
    } catch {}

    // From projects and files
    try {
      if (this.prisma.project && typeof this.prisma.project.findMany === "function") {
        const userProjects = await this.prisma.project.findMany({
          where: { userId },
          select: {
            defaultLanguage: true,
            files: { select: { language: true } },
          },
        });

        for (const proj of userProjects) {
          if (proj.files && proj.files.length > 0) {
            for (const file of proj.files) {
              if (file.language) {
                const langKey = file.language.trim().toLowerCase();
                langWeights.set(langKey, (langWeights.get(langKey) || 0) + 1);
                totalLanguageTokens++;
              }
            }
          } else if (proj.defaultLanguage) {
            const langKey = proj.defaultLanguage.trim().toLowerCase();
            langWeights.set(langKey, (langWeights.get(langKey) || 0) + 1);
            totalLanguageTokens++;
          }
        }
      }
    } catch {}

    // From coding activities
    try {
      if (this.prisma.codingActivity && typeof this.prisma.codingActivity.findMany === "function") {
        const activities = await this.prisma.codingActivity.findMany({
          where: { userId },
          select: { language: true },
          take: 200,
        });

        for (const act of activities) {
          if (act.language) {
            const langKey = act.language.trim().toLowerCase();
            langWeights.set(langKey, (langWeights.get(langKey) || 0) + 1);
            totalLanguageTokens++;
          }
        }
      }
    } catch {}

    const languagesUsedCount = langWeights.size;
    let popularLanguages = [];

    if (totalLanguageTokens > 0) {
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
        const percentage = Math.round((count / totalLanguageTokens) * 100);
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

    return {
      success: true,
      stats: {
        totalProjects,
        activeRooms: activeRoomsCount,
        todayActivityMinutes,
        languagesUsedCount,
      },
      recentProjects,
      recentActivities,
      popularLanguages,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }
}

module.exports = {
  DashboardService,
  LANGUAGE_META,
  formatTimeAgo,
  getIconTypeForLanguage,
};
