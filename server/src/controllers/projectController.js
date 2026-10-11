const prisma = require('../config/prisma');

// GET /api/projects
const getUserProjects = async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      include: {
        _count: {
          select: { files: true, versions: true, rooms: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: { projects },
    });
  } catch (error) {
    console.error('getUserProjects error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch projects.',
    });
  }
};

// POST /api/projects
const createProject = async (req, res) => {
  try {
    const { title, description, language = 'javascript' } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Project title is required.',
      });
    }

    const defaultFilename = language === 'python' ? 'main.py' :
      language === 'cpp' ? 'main.cpp' :
      language === 'java' ? 'Main.java' :
      language === 'html' ? 'index.html' : 'index.js';

    const starterContent = language === 'python'
      ? `# ${title}\nprint("Hello from CoCode!")\n`
      : language === 'cpp'
      ? `// ${title}\n#include <iostream>\n\nint main() {\n    std::cout << "Hello from CoCode!" << std::endl;\n    return 0;\n}\n`
      : language === 'java'
      ? `// ${title}\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from CoCode!");\n    }\n}\n`
      : `// ${title}\nconsole.log("Hello from CoCode!");\n`;

    const project = await prisma.project.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        userId: req.user.id,
        files: {
          create: [
            {
              name: defaultFilename,
              path: `/${defaultFilename}`,
              language,
              content: starterContent,
              isFolder: false,
            },
          ],
        },
      },
      include: {
        files: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      data: { project },
    });
  } catch (error) {
    console.error('createProject error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create project.',
    });
  }
};

// GET /api/projects/:id
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, username: true, avatar: true },
        },
        files: {
          orderBy: [{ isFolder: 'desc' }, { name: 'asc' }],
        },
        versions: {
          select: { id: true, name: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.',
      });
    }

    // Authorization check: owner or member of a collaboration room linked to this project
    const isOwner = project.userId === req.user.id;
    let isMember = false;

    if (!isOwner) {
      const roomAccess = await prisma.roomMember.findFirst({
        where: {
          userId: req.user.id,
          room: {
            projectId: id,
          },
        },
      });
      if (roomAccess) {
        isMember = true;
      }
    }

    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this project.',
      });
    }

    return res.status(200).json({
      success: true,
      data: { project, isOwner },
    });
  } catch (error) {
    console.error('getProjectById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch project details.',
    });
  }
};

// PUT /api/projects/:id
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (project.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only project owners can modify project metadata.' });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Project updated.',
      data: { project: updated },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update project.' });
  }
};

// DELETE /api/projects/:id
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (project.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the project owner can delete this project.' });
    }

    await prisma.project.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete project.' });
  }
};

// POST /api/projects/:id/files (Save / Create File or Folder)
const saveFile = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { fileId, name, path, content, language, isFolder, parentId } = req.body;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (fileId) {
      // Update existing file
      const updatedFile = await prisma.projectFile.update({
        where: { id: fileId },
        data: {
          ...(content !== undefined && { content }),
          ...(name && { name }),
          ...(path && { path }),
          ...(language && { language }),
        },
      });

      // Update project updatedAt
      await prisma.project.update({
        where: { id: projectId },
        data: { updatedAt: new Date() },
      });

      return res.status(200).json({
        success: true,
        message: 'File saved successfully.',
        data: { file: updatedFile },
      });
    }

    // Create new file or folder
    if (!name || !path) {
      return res.status(400).json({
        success: false,
        message: 'File name and path are required.',
      });
    }

    const newFile = await prisma.projectFile.create({
      data: {
        name,
        path,
        content: content || '',
        language: language || 'plaintext',
        isFolder: Boolean(isFolder),
        parentId: parentId || null,
        projectId,
      },
    });

    return res.status(201).json({
      success: true,
      message: `${isFolder ? 'Folder' : 'File'} created successfully.`,
      data: { file: newFile },
    });
  } catch (error) {
    console.error('saveFile error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'A file with this path already exists in this project.',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to save file.',
      error: error.message,
    });
  }
};

// DELETE /api/projects/:id/files/:fileId
const deleteFile = async (req, res) => {
  try {
    const { id: projectId, fileId } = req.params;

    const file = await prisma.projectFile.findUnique({
      where: { id: fileId },
    });

    if (!file || file.projectId !== projectId) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    await prisma.projectFile.delete({
      where: { id: fileId },
    });

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete file.' });
  }
};

// POST /api/projects/:id/versions (Save snapshot)
const createVersion = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { name } = req.body;

    const files = await prisma.projectFile.findMany({
      where: { projectId },
    });

    const snapshot = JSON.stringify(files);

    const version = await prisma.projectVersion.create({
      data: {
        name: name || `Snapshot ${new Date().toLocaleString()}`,
        snapshot,
        projectId,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Version snapshot saved successfully.',
      data: { version },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create version snapshot.' });
  }
};

// GET /api/projects/:id/versions
const listVersions = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const versions = await prisma.projectVersion.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: { versions },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to list versions.' });
  }
};

// POST /api/projects/:id/versions/:versionId/restore
const restoreVersion = async (req, res) => {
  try {
    const { id: projectId, versionId } = req.params;

    const version = await prisma.projectVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.projectId !== projectId) {
      return res.status(404).json({ success: false, message: 'Version not found.' });
    }

    const filesToRestore = JSON.parse(version.snapshot);

    // Delete existing files and restore snapshot
    await prisma.projectFile.deleteMany({
      where: { projectId },
    });

    // Recreate files (folders first if parentId is tracked, or simple recreate)
    for (const file of filesToRestore) {
      await prisma.projectFile.create({
        data: {
          id: file.id,
          name: file.name,
          path: file.path,
          content: file.content || '',
          language: file.language || 'javascript',
          isFolder: Boolean(file.isFolder),
          parentId: file.parentId || null,
          projectId,
        },
      });
    }

    const updatedFiles = await prisma.projectFile.findMany({
      where: { projectId },
      orderBy: [{ isFolder: 'desc' }, { name: 'asc' }],
    });

    return res.status(200).json({
      success: true,
      message: `Restored to version: ${version.name}`,
      data: { files: updatedFiles },
    });
  } catch (error) {
    console.error('restoreVersion error:', error);
    return res.status(500).json({ success: false, message: 'Failed to restore version.' });
  }
};

module.exports = {
  getUserProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  saveFile,
  deleteFile,
  createVersion,
  listVersions,
  restoreVersion,
};
