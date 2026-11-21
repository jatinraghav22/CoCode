"use strict";

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB

const STARTER_TEMPLATES = {
  javascript: {
    filename: "index.js",
    path: "/index.js",
    language: "javascript",
    content: `// Welcome to your CoCode JavaScript project\nfunction main() {\n    console.log("Hello, World!");\n}\n\nmain();\n`,
  },
  python: {
    filename: "main.py",
    path: "/main.py",
    language: "python",
    content: `# Welcome to your CoCode Python project\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n`,
  },
  cpp: {
    filename: "main.cpp",
    path: "/main.cpp",
    language: "cpp",
    content: `// Welcome to your CoCode C++ project\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n`,
  },
  c: {
    filename: "main.c",
    path: "/main.c",
    language: "c",
    content: `// Welcome to your CoCode C project\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n`,
  },
  java: {
    filename: "Main.java",
    path: "/Main.java",
    language: "java",
    content: `// Welcome to your CoCode Java project\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n`,
  },
  html: {
    filename: "index.html",
    path: "/index.html",
    language: "html",
    content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>CoCode Project</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>\n`,
  },
};

function normalizeLanguage(lang) {
  if (!lang || typeof lang !== "string") return "javascript";
  const l = lang.trim().toLowerCase();
  if (l === "c++" || l === "cpp") return "cpp";
  if (l === "py" || l === "python" || l === "python3") return "python";
  if (l === "js" || l === "javascript" || l === "node") return "javascript";
  if (l === "ts" || l === "typescript") return "typescript";
  if (l === "c") return "c";
  if (l === "java") return "java";
  if (l === "html" || l === "html / css") return "html";
  if (l === "css") return "css";
  if (l === "rust") return "rust";
  if (l === "go") return "go";
  return l;
}

function detectLanguageFromPath(path) {
  if (!path || typeof path !== "string") return "javascript";
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  switch (ext) {
    case ".js":
    case ".jsx":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".ts":
    case ".tsx":
      return "typescript";
    case ".py":
      return "python";
    case ".cpp":
    case ".cc":
    case ".cxx":
    case ".hpp":
    case ".h":
      return "cpp";
    case ".c":
      return "c";
    case ".java":
      return "java";
    case ".html":
    case ".htm":
      return "html";
    case ".css":
      return "css";
    case ".json":
      return "json";
    case ".md":
      return "markdown";
    default:
      return "javascript";
  }
}

function escapeRegex(string) {
  return typeof string === "string" ? string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
}

function sanitizeFolderPath(rawPath, fallbackName) {
  let p = typeof rawPath === "string" ? rawPath.trim() : "";
  if (!p && fallbackName) {
    p = `/${fallbackName.trim()}`;
  }
  if (!p.startsWith("/")) {
    p = `/${p}`;
  }
  p = p.replace(/\\/g, "/").replace(/\/+/g, "/");

  const segments = p.split("/").filter(Boolean);
  for (const seg of segments) {
    if (seg === "..") {
      const err = new Error("Invalid folder path. Path traversal is not allowed.");
      err.statusCode = 400;
      throw err;
    }
  }

  // Strip trailing slash unless root
  if (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }

  if (p === "/") {
    const err = new Error("Invalid folder path. Root directory cannot be targeted.");
    err.statusCode = 400;
    throw err;
  }

  return p;
}

function sanitizePath(rawPath, fallbackName) {
  let p = typeof rawPath === "string" ? rawPath.trim() : "";
  if (!p && fallbackName) {
    p = `/${fallbackName.trim()}`;
  }
  if (!p.startsWith("/")) {
    p = `/${p}`;
  }
  // Replace backslashes with forward slashes
  p = p.replace(/\\/g, "/");
  // Normalize consecutive slashes
  p = p.replace(/\/+/g, "/");

  // Reject path traversal
  const segments = p.split("/");
  for (const seg of segments) {
    if (seg === "..") {
      const err = new Error("Invalid file path. Path traversal is not allowed.");
      err.statusCode = 400;
      throw err;
    }
  }

  return p;
}

class ProjectService {
  /**
   * @param {Object} prisma - PrismaClient instance.
   * @param {Object} [options]
   * @param {Object} [options.activityService] - ActivityService instance.
   */
  constructor(prisma, options = {}) {
    if (!prisma) {
      throw new Error("ProjectService requires a prisma client.");
    }
    this.prisma = prisma;
    this.activityService = options.activityService || null;
  }

  /**
   * Verifies that the project exists and belongs to the specified user.
   * Throws 404 if project does not exist.
   * Throws 403 if project exists but belongs to another user.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {string} projectId - Project ID.
   * @returns {Promise<Object>} Project record.
   */
  async verifyProjectOwnership(userId, projectId) {
    if (!projectId || typeof projectId !== "string") {
      const err = new Error("Invalid project ID.");
      err.statusCode = 400;
      throw err;
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        files: true,
      },
    });

    if (!project) {
      const err = new Error("Project not found.");
      err.statusCode = 404;
      throw err;
    }

    if (project.userId !== userId) {
      const err = new Error("You do not have permission to access this project.");
      err.statusCode = 403;
      throw err;
    }

    return project;
  }

  /**
   * Creates a new persistent project with an initial starter file.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {Object} data
   * @param {string} data.name - Project name.
   * @param {string} [data.description] - Project description.
   * @param {string} [data.defaultLanguage] - Default programming language.
   * @param {string} [data.language] - Alias for defaultLanguage.
   * @returns {Promise<Object>} Created project with initial file.
   */
  async createProject(userId, data = {}) {
    if (!userId) {
      const err = new Error("User ID is required.");
      err.statusCode = 400;
      throw err;
    }

    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!name || name.length < 1 || name.length > 100) {
      const err = new Error("Project name must be between 1 and 100 characters.");
      err.statusCode = 400;
      throw err;
    }

    const description = typeof data.description === "string" ? data.description.trim() : null;
    if (description && description.length > 1000) {
      const err = new Error("Project description cannot exceed 1000 characters.");
      err.statusCode = 400;
      throw err;
    }

    const lang = normalizeLanguage(data.defaultLanguage || data.language || "javascript");
    const starter = STARTER_TEMPLATES[lang] || STARTER_TEMPLATES.javascript;

    const project = await this.prisma.project.create({
      data: {
        userId,
        name,
        description,
        defaultLanguage: lang,
        files: {
          create: [
            {
              name: starter.filename,
              path: starter.path,
              language: starter.language,
              content: starter.content,
            },
          ],
        },
      },
      include: {
        files: {
          orderBy: { path: "asc" },
        },
      },
    });

    // Track activity
    if (this.activityService) {
      await this.activityService.trackActivity({
        userId,
        projectId: project.id,
        language: lang,
        eventType: "project_created",
        status: "success",
      });
    }

    return project;
  }

  /**
   * Lists projects belonging to the authenticated user with pagination and search.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {Object} [query={}]
   * @param {number} [query.page=1]
   * @param {number} [query.limit=10]
   * @param {string} [query.search=""]
   * @returns {Promise<Object>} Paginated project list.
   */
  async listProjects(userId, query = {}) {
    if (!userId) {
      const err = new Error("User ID is required.");
      err.statusCode = 400;
      throw err;
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const where = { userId };
    const search = typeof query.search === "string" ? query.search.trim() : "";
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [total, projects] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          _count: {
            select: { files: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      success: true,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        defaultLanguage: p.defaultLanguage,
        language: p.defaultLanguage,
        fileCount: p._count ? p._count.files : 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
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
   * Retrieves full details and files for a single project.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {string} projectId - Project ID.
   * @returns {Promise<Object>} Project details with all files.
   */
  async getProject(userId, projectId) {
    const project = await this.verifyProjectOwnership(userId, projectId);
    return {
      success: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        defaultLanguage: project.defaultLanguage,
        language: project.defaultLanguage,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        files: (project.files || []).sort((a, b) => a.path.localeCompare(b.path)),
      },
    };
  }

  /**
   * Updates project metadata.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {string} projectId - Project ID.
   * @param {Object} data - Update data.
   * @returns {Promise<Object>} Updated project.
   */
  async updateProject(userId, projectId, data = {}) {
    await this.verifyProjectOwnership(userId, projectId);

    const updateData = {};

    if (data.name !== undefined) {
      const name = typeof data.name === "string" ? data.name.trim() : "";
      if (!name || name.length < 1 || name.length > 100) {
        const err = new Error("Project name must be between 1 and 100 characters.");
        err.statusCode = 400;
        throw err;
      }
      updateData.name = name;
    }

    if (data.description !== undefined) {
      const description = typeof data.description === "string" ? data.description.trim() : null;
      if (description && description.length > 1000) {
        const err = new Error("Project description cannot exceed 1000 characters.");
        err.statusCode = 400;
        throw err;
      }
      updateData.description = description;
    }

    if (data.defaultLanguage !== undefined || data.language !== undefined) {
      updateData.defaultLanguage = normalizeLanguage(data.defaultLanguage || data.language);
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: updateData,
      include: {
        files: {
          orderBy: { path: "asc" },
        },
      },
    });

    if (this.activityService) {
      await this.activityService.trackActivity({
        userId,
        projectId,
        language: updated.defaultLanguage,
        eventType: "project_updated",
        status: "success",
      });
    }

    return {
      success: true,
      project: updated,
    };
  }

  /**
   * Deletes a project and all associated files.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {string} projectId - Project ID.
   * @returns {Promise<Object>} Confirmation message.
   */
  async deleteProject(userId, projectId) {
    await this.verifyProjectOwnership(userId, projectId);

    await this.prisma.project.delete({
      where: { id: projectId },
    });

    return {
      success: true,
      message: "Project deleted successfully.",
    };
  }

  /**
   * Creates a new file in a project.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {string} projectId - Project ID.
   * @param {Object} fileData
   * @param {string} fileData.name - File name.
   * @param {string} [fileData.path] - Full file path.
   * @param {string} [fileData.language] - Programming language.
   * @param {string} [fileData.content=""] - Initial content.
   * @returns {Promise<Object>} Created file record.
   */
  async createProjectFile(userId, projectId, fileData = {}) {
    const project = await this.verifyProjectOwnership(userId, projectId);

    const name = typeof fileData.name === "string" ? fileData.name.trim() : "";
    if (!name || name.length < 1 || name.length > 100) {
      const err = new Error("File name must be between 1 and 100 characters.");
      err.statusCode = 400;
      throw err;
    }

    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      const err = new Error("File name contains invalid characters.");
      err.statusCode = 400;
      throw err;
    }

    const path = sanitizePath(fileData.path, name);

    const content = typeof fileData.content === "string" ? fileData.content : "";
    if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE_BYTES) {
      const err = new Error("File content exceeds 1MB limit.");
      err.statusCode = 413;
      throw err;
    }

    // Check for duplicate path in same project
    const existing = await this.prisma.projectFile.findUnique({
      where: {
        projectId_path: {
          projectId,
          path,
        },
      },
    });

    if (existing) {
      const err = new Error("A file with this path already exists in this project.");
      err.statusCode = 409;
      throw err;
    }

    const language = normalizeLanguage(fileData.language || detectLanguageFromPath(path));

    const file = await this.prisma.projectFile.create({
      data: {
        projectId,
        name,
        path,
        language,
        content,
      },
    });

    // Touch project updatedAt
    await this.prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    if (this.activityService) {
      await this.activityService.trackActivity({
        userId,
        projectId,
        language,
        eventType: "file_created",
        status: "success",
      });
    }

    return {
      success: true,
      file,
    };
  }

  /**
   * Retrieves a single file from a project.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {string} projectId - Project ID.
   * @param {string} fileId - File ID.
   * @returns {Promise<Object>} File record.
   */
  async getProjectFile(userId, projectId, fileId) {
    await this.verifyProjectOwnership(userId, projectId);

    const file = await this.prisma.projectFile.findFirst({
      where: {
        id: fileId,
        projectId,
      },
    });

    if (!file) {
      const err = new Error("File not found in project.");
      err.statusCode = 404;
      throw err;
    }

    return {
      success: true,
      file,
    };
  }

  /**
   * Updates an existing project file.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {string} projectId - Project ID.
   * @param {string} fileId - File ID.
   * @param {Object} data - Update data.
   * @returns {Promise<Object>} Updated file record.
   */
  async updateProjectFile(userId, projectId, fileId, data = {}) {
    await this.verifyProjectOwnership(userId, projectId);

    const currentFile = await this.prisma.projectFile.findFirst({
      where: {
        id: fileId,
        projectId,
      },
    });

    if (!currentFile) {
      const err = new Error("File not found in project.");
      err.statusCode = 404;
      throw err;
    }

    const updateData = {};

    if (data.name !== undefined) {
      const name = typeof data.name === "string" ? data.name.trim() : "";
      if (!name || name.length < 1 || name.length > 100) {
        const err = new Error("File name must be between 1 and 100 characters.");
        err.statusCode = 400;
        throw err;
      }
      if (name.includes("/") || name.includes("\\") || name.includes("..")) {
        const err = new Error("File name contains invalid characters.");
        err.statusCode = 400;
        throw err;
      }
      updateData.name = name;
    }

    if (data.path !== undefined) {
      const newPath = sanitizePath(data.path, updateData.name || currentFile.name);
      if (newPath !== currentFile.path) {
        const conflict = await this.prisma.projectFile.findUnique({
          where: {
            projectId_path: {
              projectId,
              path: newPath,
            },
          },
        });
        if (conflict && conflict.id !== fileId) {
          const err = new Error("A file with this path already exists in this project.");
          err.statusCode = 409;
          throw err;
        }
        updateData.path = newPath;
      }
    }

    if (data.content !== undefined) {
      const content = typeof data.content === "string" ? data.content : "";
      if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE_BYTES) {
        const err = new Error("File content exceeds 1MB limit.");
        err.statusCode = 413;
        throw err;
      }
      updateData.content = content;
    }

    if (data.language !== undefined) {
      updateData.language = normalizeLanguage(data.language);
    } else if (updateData.path) {
      updateData.language = detectLanguageFromPath(updateData.path);
    }

    const updatedFile = await this.prisma.projectFile.update({
      where: { id: fileId },
      data: updateData,
    });

    // Touch project updatedAt
    await this.prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    if (this.activityService) {
      await this.activityService.trackActivity({
        userId,
        projectId,
        language: updatedFile.language,
        eventType: "file_updated",
        status: "success",
      });
    }

    return {
      success: true,
      file: updatedFile,
    };
  }

  /**
   * Deletes a file from a project.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {string} projectId - Project ID.
   * @param {string} fileId - File ID.
   * @returns {Promise<Object>} Confirmation message.
   */
  async deleteProjectFile(userId, projectId, fileId) {
    await this.verifyProjectOwnership(userId, projectId);

    const file = await this.prisma.projectFile.findFirst({
      where: {
        id: fileId,
        projectId,
      },
    });

    if (!file) {
      const err = new Error("File not found in project.");
      err.statusCode = 404;
      throw err;
    }

    await this.prisma.projectFile.delete({
      where: { id: fileId },
    });

    // Touch project updatedAt
    await this.prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return {
      success: true,
      message: "File deleted successfully.",
    };
  }

  /**
   * Creates a new folder (persisted via empty folder placeholder).
   *
   * @param {string} userId - Authenticated user ID.
   * @param {string} projectId - Project ID.
   * @param {Object} folderData
   * @param {string} [folderData.path] - Full folder path (e.g. /src/components).
   * @param {string} [folderData.name] - Folder name if parentPath is provided.
   * @param {string} [folderData.parentPath] - Parent folder path.
   * @returns {Promise<Object>} Created folder info.
   */
  async createFolder(userId, projectId, folderData = {}) {
    const project = await this.verifyProjectOwnership(userId, projectId);

    let rawPath = folderData.path;
    if (!rawPath && folderData.name) {
      const parent = folderData.parentPath ? folderData.parentPath.trim() : "";
      rawPath = `${parent}/${folderData.name.trim()}`;
    }

    const folderPath = sanitizeFolderPath(rawPath);
    const folderName = folderPath.slice(folderPath.lastIndexOf("/") + 1);

    if (folderName.includes("/") || folderName.includes("\\") || folderName.includes("..")) {
      const err = new Error("Folder name contains invalid characters.");
      err.statusCode = 400;
      throw err;
    }

    const keepPath = `${folderPath}/.cocode-keep`;
    const existingKeep = (project.files || []).find((f) => f.path === keepPath);
    const existingChildren = (project.files || []).some((f) => f.path.startsWith(`${folderPath}/`));

    if (existingKeep || existingChildren) {
      return {
        success: true,
        message: "Folder already exists.",
        folder: {
          path: folderPath,
          name: folderName,
        },
      };
    }

    await this.prisma.projectFile.create({
      data: {
        projectId,
        name: ".cocode-keep",
        path: keepPath,
        language: "text",
        content: "",
      },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return {
      success: true,
      folder: {
        path: folderPath,
        name: folderName,
      },
    };
  }

  /**
   * Renames a folder and moves all nested files recursively.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {string} projectId - Project ID.
   * @param {Object} data
   * @param {string} data.oldPath - Existing folder path.
   * @param {string} data.newPath - Desired new folder path.
   * @returns {Promise<Object>} Result with count of updated files.
   */
  async renameFolder(userId, projectId, data = {}) {
    const project = await this.verifyProjectOwnership(userId, projectId);

    const oldPath = sanitizeFolderPath(data.oldPath);
    const newPath = sanitizeFolderPath(data.newPath);

    if (oldPath === newPath) {
      return {
        success: true,
        message: "Folder path unchanged.",
        oldPath,
        newPath,
        count: 0,
      };
    }

    const allFiles = project.files || [];
    const filesToUpdate = allFiles.filter(
      (f) => f.path === oldPath || f.path.startsWith(`${oldPath}/`)
    );

    if (filesToUpdate.length === 0) {
      const err = new Error("Folder not found in project.");
      err.statusCode = 404;
      throw err;
    }

    // Check collision with other existing files
    for (const f of filesToUpdate) {
      let candidatePath;
      if (f.path === oldPath) {
        candidatePath = newPath;
      } else {
        candidatePath = `${newPath}/${f.path.slice(oldPath.length + 1)}`;
      }
      const collision = allFiles.find(
        (existing) => !filesToUpdate.some((u) => u.id === existing.id) && existing.path === candidatePath
      );
      if (collision) {
        const err = new Error("A file or folder with the destination path already exists.");
        err.statusCode = 409;
        throw err;
      }
    }

    // Update each affected file
    for (const f of filesToUpdate) {
      let updatedPath;
      if (f.path === oldPath) {
        updatedPath = newPath;
      } else {
        updatedPath = `${newPath}/${f.path.slice(oldPath.length + 1)}`;
      }
      const updatedName = updatedPath.slice(updatedPath.lastIndexOf("/") + 1);

      await this.prisma.projectFile.update({
        where: { id: f.id },
        data: {
          path: updatedPath,
          name: updatedName,
        },
      });
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return {
      success: true,
      message: "Folder renamed successfully.",
      oldPath,
      newPath,
      count: filesToUpdate.length,
    };
  }

  /**
   * Deletes a folder and all nested files recursively.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {string} projectId - Project ID.
   * @param {string} folderPathRaw - Folder path to delete.
   * @returns {Promise<Object>} Result with count of deleted files.
   */
  async deleteFolder(userId, projectId, folderPathRaw) {
    const project = await this.verifyProjectOwnership(userId, projectId);
    const folderPath = sanitizeFolderPath(folderPathRaw);

    const allFiles = project.files || [];
    const filesToDelete = allFiles.filter(
      (f) => f.path === folderPath || f.path.startsWith(`${folderPath}/`)
    );

    for (const f of filesToDelete) {
      await this.prisma.projectFile.delete({
        where: { id: f.id },
      });
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return {
      success: true,
      message: "Folder and contents deleted successfully.",
      count: filesToDelete.length,
    };
  }

  /**
   * Searches text across all supported files in a project.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {string} projectId - Project ID.
   * @param {string} query - Search term.
   * @param {Object} [options]
   * @param {boolean} [options.matchCase=false]
   * @param {boolean} [options.wholeWord=false]
   * @returns {Promise<Object>} Search matches.
   */
  async searchProjectFiles(userId, projectId, query = "", options = {}) {
    const project = await this.verifyProjectOwnership(userId, projectId);
    const q = typeof query === "string" ? query.trim() : "";

    if (!q) {
      return {
        success: true,
        query: "",
        totalMatches: 0,
        matches: [],
      };
    }

    const matchCase = Boolean(options.matchCase);
    const wholeWord = Boolean(options.wholeWord);
    const flags = matchCase ? "g" : "gi";
    const pattern = wholeWord ? `\\b${escapeRegex(q)}\\b` : escapeRegex(q);
    const regex = new RegExp(pattern, flags);

    const matches = [];
    const allFiles = project.files || [];

    for (const file of allFiles) {
      if (file.name === ".cocode-keep") continue;
      const content = file.content || "";
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        regex.lastIndex = 0;
        let m;
        while ((m = regex.exec(line)) !== null) {
          matches.push({
            fileId: file.id,
            fileName: file.name,
            filePath: file.path,
            language: file.language,
            lineNumber: i + 1,
            lineContent: line.trim(),
            matchStart: m.index,
            matchEnd: m.index + m[0].length,
          });
          if (!regex.global) break;
        }
      }
    }

    return {
      success: true,
      query: q,
      totalMatches: matches.length,
      matches,
    };
  }

  /**
   * Saves multiple modified files in one batch using a transaction.
   * Validates all files belong to the project, validates sizes, and rolls back on failure.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {string} projectId - Project ID.
   * @param {Array<Object>} filesToSave - Array of { id, content, language }.
   * @returns {Promise<Object>} Result with count of saved files.
   */
  async saveAllFiles(userId, projectId, filesToSave = []) {
    const project = await this.verifyProjectOwnership(userId, projectId);

    if (!Array.isArray(filesToSave) || filesToSave.length === 0) {
      return {
        success: true,
        message: "No files provided to save.",
        count: 0,
      };
    }

    const allFilesMap = new Map((project.files || []).map((f) => [f.id, f]));

    // Strictly validate ALL items upfront before starting any database writes
    for (const item of filesToSave) {
      if (!item || typeof item.id !== "string" || !item.id.trim()) {
        const err = new Error("Invalid file entry in batch: missing or invalid file id.");
        err.statusCode = 400;
        throw err;
      }

      if (!allFilesMap.has(item.id)) {
        const err = new Error(`File ID "${item.id}" does not exist in this project.`);
        err.statusCode = 404;
        throw err;
      }

      const content = typeof item.content === "string" ? item.content : "";
      if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE_BYTES) {
        const f = allFilesMap.get(item.id);
        const err = new Error(`File ${f?.name || item.id} exceeds 1MB limit.`);
        err.statusCode = 413;
        throw err;
      }
    }

    // Execute batch update inside transaction
    const executeBatch = async (tx) => {
      for (const item of filesToSave) {
        const content = typeof item.content === "string" ? item.content : "";
        const updateData = { content };
        if (item.language) {
          updateData.language = normalizeLanguage(item.language);
        }

        await tx.projectFile.update({
          where: { id: item.id },
          data: updateData,
        });
      }

      await tx.project.update({
        where: { id: projectId },
        data: { updatedAt: new Date() },
      });
    };

    if (typeof this.prisma.$transaction === "function") {
      await this.prisma.$transaction(executeBatch);
    } else {
      await executeBatch(this.prisma);
    }

    return {
      success: true,
      message: "Files saved successfully.",
      count: filesToSave.length,
    };
  }
}

module.exports = {
  ProjectService,
  normalizeLanguage,
  detectLanguageFromPath,
  sanitizePath,
  sanitizeFolderPath,
  escapeRegex,
};
