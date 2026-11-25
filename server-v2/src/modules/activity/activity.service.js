"use strict";

const { logger } = require("../../utils/logger");

/**
 * ActivityService — persists and aggregates user-scoped coding activities.
 *
 * Scopes all events strictly to the authenticated user ID.
 * Tracks genuine events: code execution, project creation/updates, file operations.
 * Never stores tokens, passwords, raw source code, or secrets.
 */

class ActivityService {
  /**
   * @param {Object} prisma - PrismaClient instance.
   */
  constructor(prisma) {
    if (!prisma) {
      throw new Error("ActivityService requires a prisma client.");
    }
    this.prisma = prisma;
  }

  /**
   * Tracks a genuine coding or project activity.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} [params.projectId=null]
   * @param {string} [params.language="javascript"]
   * @param {string} params.eventType
   * @param {string} [params.status="success"]
   * @param {number|null} [params.durationSeconds=null]
   * @returns {Promise<Object>} The created activity record.
   */
  async trackActivity({
    userId,
    projectId = null,
    language = "javascript",
    eventType,
    status = "success",
    durationSeconds = null,
  }) {
    if (!userId) {
      throw new Error("userId is required to track activity.");
    }
    if (!eventType) {
      throw new Error("eventType is required to track activity.");
    }

    const safeLanguage = (typeof language === "string" ? language.trim().toLowerCase() : "javascript") || "javascript";
    const safeStatus = (typeof status === "string" ? status.trim().toLowerCase() : "success") || "success";
    const safeDuration =
      typeof durationSeconds === "number" && !isNaN(durationSeconds) && durationSeconds >= 0
        ? Math.round(durationSeconds)
        : null;

    if (!this.prisma.codingActivity || typeof this.prisma.codingActivity.create !== "function") {
      return null;
    }

    try {
      const record = await this.prisma.codingActivity.create({
        data: {
          userId,
          projectId: projectId || null,
          language: safeLanguage,
          eventType: eventType.trim(),
          status: safeStatus,
          durationSeconds: safeDuration,
        },
      });
      return record;
    } catch (err) {
      logger.warn("ACTIVITY", "Failed to record coding activity:", err);
      return null;
    }
  }

  /**
   * Retrieves paginated, user-scoped activity history with optional filters.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {Object} [query={}]
   * @param {number} [query.page=1]
   * @param {number} [query.limit=20]
   * @param {string} [query.eventType]
   * @param {string} [query.projectId]
   * @param {string} [query.startDate]
   * @param {string} [query.endDate]
   * @returns {Promise<Object>} Paginated activity list.
   */
  async getActivities(userId, query = {}) {
    if (!userId) {
      const err = new Error("User ID is required.");
      err.statusCode = 400;
      throw err;
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    if (!this.prisma.codingActivity || typeof this.prisma.codingActivity.count !== "function") {
      return {
        success: true,
        activities: [],
        pagination: { page, limit, total: 0, totalPages: 1 },
      };
    }

    const where = { userId };

    if (query.eventType && typeof query.eventType === "string") {
      where.eventType = query.eventType.trim();
    }

    if (query.projectId && typeof query.projectId === "string") {
      where.projectId = query.projectId.trim();
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        if (!isNaN(start.getTime())) {
          where.createdAt.gte = start;
        }
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (!isNaN(end.getTime())) {
          where.createdAt.lte = end;
        }
      }
      if (Object.keys(where.createdAt).length === 0) {
        delete where.createdAt;
      }
    }

    const [total, activities] = await Promise.all([
      this.prisma.codingActivity.count({ where }),
      this.prisma.codingActivity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      success: true,
      activities: activities.map((a) => ({
        id: a.id,
        userId: a.userId,
        projectId: a.projectId,
        projectName: a.project?.name || null,
        language: a.language,
        eventType: a.eventType,
        status: a.status,
        durationSeconds: a.durationSeconds,
        createdAt: a.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Computes aggregated activity metrics for the user.
   *
   * @param {string} userId - Authenticated user ID.
   * @returns {Promise<Object>} Aggregated activity summary.
   */
  async getActivitySummary(userId) {
    if (!userId) {
      const err = new Error("User ID is required.");
      err.statusCode = 400;
      throw err;
    }

    if (!this.prisma.codingActivity || typeof this.prisma.codingActivity.count !== "function") {
      return {
        success: true,
        summary: {
          totalEvents: 0,
          todayCount: 0,
          todayDurationSeconds: 0,
          todayActivityMinutes: 0,
          dailyActivity: [],
          languageUsage: [],
          recentEvents: [],
        },
      };
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalEvents, todayActivities, recentEvents, allActivitiesForAggregation] = await Promise.all([
      this.prisma.codingActivity.count({ where: { userId } }),
      this.prisma.codingActivity.findMany({
        where: {
          userId,
          createdAt: { gte: startOfToday },
        },
        select: {
          id: true,
          durationSeconds: true,
          eventType: true,
          language: true,
        },
      }),
      this.prisma.codingActivity.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.codingActivity.findMany({
        where: { userId },
        select: {
          language: true,
          createdAt: true,
          eventType: true,
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

    // Calculate today's duration in seconds and minutes
    let todayDurationSeconds = 0;
    for (const act of todayActivities) {
      if (act.durationSeconds) {
        todayDurationSeconds += act.durationSeconds;
      }
    }
    const todayActivityMinutes = Math.round(todayDurationSeconds / 60);

    // Language usage breakdown
    const langCountMap = new Map();
    for (const act of allActivitiesForAggregation) {
      if (act.language) {
        const lang = act.language.toLowerCase();
        langCountMap.set(lang, (langCountMap.get(lang) || 0) + 1);
      }
    }

    const languageUsage = Array.from(langCountMap.entries())
      .map(([lang, count]) => ({ language: lang, count }))
      .sort((a, b) => b.count - a.count);

    // Daily activity counts for the last 7 days
    const dailyMap = new Map();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      dailyMap.set(dateKey, 0);
    }

    for (const act of allActivitiesForAggregation) {
      const dateKey = new Date(act.createdAt).toISOString().slice(0, 10);
      if (dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, dailyMap.get(dateKey) + 1);
      }
    }

    const dailyActivity = Array.from(dailyMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    return {
      success: true,
      summary: {
        totalEvents,
        todayCount: todayActivities.length,
        todayDurationSeconds,
        todayActivityMinutes,
        dailyActivity,
        languageUsage,
        recentEvents: recentEvents.map((a) => ({
          id: a.id,
          eventType: a.eventType,
          language: a.language,
          status: a.status,
          projectName: a.project?.name || null,
          durationSeconds: a.durationSeconds,
          createdAt: a.createdAt,
        })),
      },
    };
  }
}

module.exports = { ActivityService };
