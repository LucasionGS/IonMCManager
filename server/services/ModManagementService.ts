import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Buffer } from "node:buffer";
import process from "node:process";
import MinecraftServer from '../database/models/MinecraftServer.ts';

export interface ModInfo {
  id: string;
  name: string;
  version: string;
  filename: string;
  enabled: boolean;
  description?: string;
  authors?: string[];
  size?: number;
  lastModified?: Date;
}

export interface CurseForgeModFile {
  id: number;
  displayName: string;
  fileName: string;
  fileDate: string;
  downloadUrl: string;
  gameVersions: string[];
}

export interface CurseForgeMod {
  id: number;
  name: string;
  summary: string;
  downloadCount: number;
  dateCreated: string;
  dateModified: string;
  gamePopularityRank: number;
  logo?: {
    url: string;
  };
  screenshots?: Array<{
    url: string;
    title: string;
  }>;
  latestFiles: CurseForgeModFile[];
  categories: Array<{
    id: number;
    name: string;
  }>;
  authors: Array<{
    name: string;
  }>;
}

export interface CurseForgeSearchResult {
  data: CurseForgeMod[];
  pagination: {
    index: number;
    pageSize: number;
    resultCount: number;
    totalCount: number;
  };
}

export interface CurseForgeManifest {
  minecraft: {
    version: string;
    modLoaders: Array<{
      id: string;
      primary: boolean;
    }>;
  };
  manifestType: string;
  manifestVersion: number;
  name: string;
  version?: string;
  author?: string;
  files: Array<{
    projectID: number;
    fileID: number;
    required: boolean;
  }>;
  overrides?: string;
}

export default class ModManagementService {
  private getServerModsPath(serverId: string): string {
    return path.join('/app/minecraft_servers', serverId, 'mods');
  }

  private getServerPath(serverId: string): string {
    return path.join('/app/minecraft_servers', serverId);
  }

  async ensureModsDirectory(serverId: string): Promise<void> {
    const modsPath = this.getServerModsPath(serverId);
    try {
      await fs.access(modsPath);
    } catch {
      await fs.mkdir(modsPath, { recursive: true });
    }
  }

  async listMods(serverId: string): Promise<{ enabled: ModInfo[], disabled: ModInfo[] }> {
    await this.ensureModsDirectory(serverId);
    const modsPath = this.getServerModsPath(serverId);
    
    const enabled: ModInfo[] = [];
    const disabled: ModInfo[] = [];

    try {
      const files = await fs.readdir(modsPath, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile()) {
          const filename = file.name;
          const isEnabled = !filename.endsWith('.disabled');
          const actualFilename = isEnabled ? filename : filename.replace('.disabled', '');
          
          if (actualFilename.endsWith('.jar')) {
            const filePath = path.join(modsPath, filename);
            const stats = await fs.stat(filePath);
            
            // Extract mod info from filename (basic approach)
            // In a more advanced implementation, you could parse the JAR file's metadata
            const modInfo: ModInfo = {
              id: actualFilename.replace('.jar', ''),
              name: actualFilename.replace('.jar', '').replace(/[_-]/g, ' '),
              version: 'unknown',
              filename: actualFilename,
              enabled: isEnabled,
              size: stats.size,
              lastModified: stats.mtime
            };

            if (isEnabled) {
              enabled.push(modInfo);
            } else {
              disabled.push(modInfo);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error listing mods:', error);
    }

    return { enabled, disabled };
  }

  async uploadMod(serverId: string, fileBuffer: Buffer, filename: string): Promise<void> {
    if (!filename.endsWith('.jar')) {
      throw new Error('Only .jar files are supported');
    }

    await this.ensureModsDirectory(serverId);
    const modsPath = this.getServerModsPath(serverId);
    const filePath = path.join(modsPath, filename);

    // Check if mod already exists
    try {
      await fs.access(filePath);
      throw new Error(`Mod '${filename}' already exists`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    await fs.writeFile(filePath, fileBuffer);
  }

  async deleteMod(serverId: string, filename: string): Promise<void> {
    const modsPath = this.getServerModsPath(serverId);
    const filePath = path.join(modsPath, filename);
    const disabledPath = path.join(modsPath, filename + '.disabled');

    try {
      // Try to delete both enabled and disabled versions
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      try {
        await fs.unlink(disabledPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    } catch (error) {
      throw new Error(`Failed to delete mod: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async enableMod(serverId: string, filename: string): Promise<void> {
    const modsPath = this.getServerModsPath(serverId);
    const disabledPath = path.join(modsPath, filename + '.disabled');
    const enabledPath = path.join(modsPath, filename);

    try {
      await fs.access(disabledPath);
      await fs.rename(disabledPath, enabledPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Disabled mod '${filename}' not found`);
      }
      throw error;
    }
  }

  async disableMod(serverId: string, filename: string): Promise<void> {
    const modsPath = this.getServerModsPath(serverId);
    const enabledPath = path.join(modsPath, filename);
    const disabledPath = path.join(modsPath, filename + '.disabled');

    try {
      await fs.access(enabledPath);
      await fs.rename(enabledPath, disabledPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Enabled mod '${filename}' not found`);
      }
      throw error;
    }
  }

  async searchCurseForgeMods(query: string, gameVersion?: string, categoryId?: number, pageSize: number = 20, index: number = 0): Promise<CurseForgeSearchResult> {
    const CURSEFORGE_API_KEY = process.env.CURSEFORGE_API_KEY;
    if (!CURSEFORGE_API_KEY) {
      throw new Error('CurseForge API key not configured');
    }

    const url = new URL('https://api.curseforge.com/v1/mods/search');
    url.searchParams.set('gameId', '432'); // Minecraft
    url.searchParams.set('classId', '6'); // Mods
    url.searchParams.set('searchFilter', query);
    url.searchParams.set('pageSize', pageSize.toString());
    url.searchParams.set('index', index.toString());
    url.searchParams.set('sortField', '2'); // Popularity
    url.searchParams.set('sortOrder', 'desc');

    if (gameVersion) {
      url.searchParams.set('gameVersion', gameVersion);
    }

    if (categoryId) {
      url.searchParams.set('categoryId', categoryId.toString());
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'x-api-key': CURSEFORGE_API_KEY
        }
      });

      if (!response.ok) {
        throw new Error(`CurseForge API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('CurseForge search error:', error);
      throw new Error('Failed to search CurseForge mods');
    }
  }

  async getCurseForgeModDetails(modId: number): Promise<CurseForgeMod> {
    const CURSEFORGE_API_KEY = process.env.CURSEFORGE_API_KEY;
    if (!CURSEFORGE_API_KEY) {
      throw new Error('CurseForge API key not configured');
    }

    try {
      const response = await fetch(`https://api.curseforge.com/v1/mods/${modId}`, {
        headers: {
          'Accept': 'application/json',
          'x-api-key': CURSEFORGE_API_KEY
        }
      });

      if (!response.ok) {
        throw new Error(`CurseForge API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('CurseForge mod details error:', error);
      throw new Error('Failed to get mod details from CurseForge');
    }
  }

  async downloadModFromCurseForge(serverId: string, modId: number, fileId?: number): Promise<ModInfo> {
    const modDetails = await this.getCurseForgeModDetails(modId);
    
    let fileToDownload: CurseForgeModFile;
    if (fileId) {
      // Find specific file
      fileToDownload = modDetails.latestFiles.find(f => f.id === fileId) || modDetails.latestFiles[0];
    } else {
      // Use latest file
      fileToDownload = modDetails.latestFiles[0];
    }

    if (!fileToDownload) {
      throw new Error('No downloadable files found for this mod');
    }

    try {
      const response = await fetch(fileToDownload.downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download mod: ${response.status} ${response.statusText}`);
      }

      const fileBuffer = Buffer.from(await response.arrayBuffer());
      await this.uploadMod(serverId, fileBuffer, fileToDownload.fileName);

      return {
        id: modId.toString(),
        name: modDetails.name,
        version: fileToDownload.displayName,
        filename: fileToDownload.fileName,
        enabled: true,
        description: modDetails.summary,
        authors: modDetails.authors.map(a => a.name)
      };
    } catch (error) {
      console.error('Mod download error:', error);
      throw new Error('Failed to download mod from CurseForge');
    }
  }

  async installModsFromManifest(serverId: string, manifest: CurseForgeManifest): Promise<ModInfo[]> {
    const installedMods: ModInfo[] = [];
    const errors: string[] = [];

    for (const file of manifest.files) {
      try {
        const modInfo = await this.downloadModFromCurseForge(serverId, file.projectID, file.fileID);
        installedMods.push(modInfo);
      } catch (error) {
        const errorMessage = `Failed to install mod ${file.projectID}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        errors.push(errorMessage);
      }
    }

    if (errors.length > 0 && installedMods.length === 0) {
      throw new Error(`Failed to install any mods: ${errors.join(', ')}`);
    }

    return installedMods;
  }

  async getModpackCompatibility(serverId: string): Promise<{ minecraftVersion: string, forgeVersion?: string }> {
    // Get server details to determine compatibility
    const server = await MinecraftServer.findByPk(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    return {
      minecraftVersion: server.minecraftVersion,
      forgeVersion: server.forgeVersion || undefined
    };
  }
}