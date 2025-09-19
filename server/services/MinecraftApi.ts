/**
 * Minecraft API namespace for interacting with Mojang's version manifest and server data
 */
export namespace MinecraftApi {
  export interface VersionManifest {
    latest: {
      release: string;
      snapshot: string;
    };
    versions: Version[];
  }

  export interface Version {
    id: string;
    type: string;
    url: string;
    time: string;
    releaseTime: string;
    complianceLevel?: number;
  }

  export interface VersionData {
    id: string;
    type: string;
    time: string;
    releaseTime: string;
    downloads: {
      client?: {
        sha1: string;
        size: number;
        url: string;
      };
      client_mappings?: {
        sha1: string;
        size: number;
        url: string;
      };
      server: {
        sha1: string;
        size: number;
        url: string;
      };
      server_mappings?: {
        sha1: string;
        size: number;
        url: string;
      };
    };
    javaVersion?: {
      component: string;
      majorVersion: number;
    };
  }

  export interface ServerType {
    id: string;
    name: string;
    description: string;
    category: 'vanilla' | 'modded' | 'plugin';
    supportsVersions: string[];
  }

  /**
   * Fetches the Minecraft server version manifest from Mojang
   * @returns Promise<VersionManifest> The version manifest containing all available versions
   */
  export async function getServerVersions(): Promise<VersionManifest> {
    try {
      const response = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
      
      if (!response.ok) {
        throw new Error(`Failed to fetch version manifest: ${response.status} ${response.statusText}`);
      }
      
      const data: VersionManifest = await response.json();
      return data;
    } catch (error) {
      throw new Error(`Error fetching Minecraft versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetches detailed server data for a specific Minecraft version
   * @param version The version ID, "latest", "latest-snapshot", or a Version object
   * @returns Promise<VersionData> Detailed version data including download URLs
   */
  export async function getServerData(version: string | Version): Promise<VersionData> {
    try {
      let versionObj: Version | undefined;
      
      if (typeof version === "string") {
        const manifest = await getServerVersions();

        if (version === "latest") {
          version = manifest.latest.release;
        } else if (version === "latest-snapshot") {
          version = manifest.latest.snapshot;
        }

        versionObj = manifest.versions.find((v: Version) => v.id === version);
      } else {
        versionObj = version;
      }

      if (!versionObj) {
        throw new Error(`Version "${version}" not found in manifest`);
      }

      const versionResponse = await fetch(versionObj.url);
      
      if (!versionResponse.ok) {
        throw new Error(`Failed to fetch version data: ${versionResponse.status} ${versionResponse.statusText}`);
      }

      const versionData: VersionData = await versionResponse.json();
      
      if (!versionData.downloads?.server) {
        throw new Error(`Server download not available for version "${versionObj.id}"`);
      }

      return versionData;
    } catch (error) {
      throw new Error(`Error fetching server data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetches available Forge versions for a given Minecraft version
   * @param minecraftVersion The Minecraft version to get Forge versions for
   * @returns Promise<string[]> Array of available Forge versions
   */
  export async function getForgeVersions(minecraftVersion: string): Promise<string[]> {
    try {
      if (minecraftVersion === "latest") {
        const manifest = await getServerVersions();
        minecraftVersion = manifest.latest.release;
      }

      const url = `https://files.minecraftforge.net/net/minecraftforge/forge/index_${minecraftVersion}.html`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch Forge versions for ${minecraftVersion}: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const versionPattern = new RegExp(`forge-${minecraftVersion.replace(/\./g, '\\.')}-([\\d.]+)-installer\\.jar`, 'g');
      const versions = new Set<string>();
      let match;

      while ((match = versionPattern.exec(html)) !== null) {
        versions.add(match[1]);
      }

      return Array.from(versions).sort((a, b) => {
        // Sort versions in descending order (newest first)
        const aParts = a.split('.').map(n => parseInt(n));
        const bParts = b.split('.').map(n => parseInt(n));
        
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aNum = aParts[i] || 0;
          const bNum = bParts[i] || 0;
          if (aNum !== bNum) {
            return bNum - aNum;
          }
        }
        return 0;
      });
    } catch (error) {
      throw new Error(`Error fetching Forge versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets available server types that can be installed
   * @returns Array of supported server types
   */
  export function getAvailableServerTypes(): ServerType[] {
    return [
      {
        id: 'vanilla',
        name: 'Vanilla Minecraft',
        description: 'Official Minecraft server from Mojang',
        category: 'vanilla',
        supportsVersions: ['*'] // Supports all versions
      },
      {
        id: 'forge',
        name: 'Minecraft Forge',
        description: 'Modded Minecraft server with Forge mod support',
        category: 'modded',
        supportsVersions: ['1.7.10', '1.12.2', '1.16.5', '1.18.2', '1.19.2', '1.20.1'] // Common Forge versions
      },
      {
        id: 'fabric',
        name: 'Fabric',
        description: 'Lightweight modded Minecraft server',
        category: 'modded',
        supportsVersions: ['1.14+'] // Fabric supports 1.14 and newer
      },
      {
        id: 'paper',
        name: 'Paper',
        description: 'High-performance Minecraft server with plugin support',
        category: 'plugin',
        supportsVersions: ['1.8+'] // Paper supports 1.8 and newer
      },
      {
        id: 'spigot',
        name: 'Spigot',
        description: 'Popular Minecraft server with plugin support',
        category: 'plugin',
        supportsVersions: ['1.8+'] // Spigot supports 1.8 and newer
      }
    ];
  }

  /**
   * Validates if a version exists in the manifest
   * @param versionId The version ID to validate
   * @returns Promise<boolean> True if the version exists
   */
  export async function validateVersion(versionId: string): Promise<boolean> {
    try {
      const manifest = await getServerVersions();
      
      if (versionId === "latest" || versionId === "latest-snapshot") {
        return true;
      }
      
      return manifest.versions.some(v => v.id === versionId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets version information including type (release, snapshot, etc.)
   * @param versionId The version ID to get info for
   * @returns Promise<Version | null> Version object or null if not found
   */
  export async function getVersionInfo(versionId: string): Promise<Version | null> {
    try {
      const manifest = await getServerVersions();
      
      if (versionId === "latest") {
        versionId = manifest.latest.release;
      } else if (versionId === "latest-snapshot") {
        versionId = manifest.latest.snapshot;
      }
      
      return manifest.versions.find(v => v.id === versionId) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Gets the latest release and snapshot versions
   * @returns Promise<{release: string, snapshot: string}> Latest version IDs
   */
  export async function getLatestVersions(): Promise<{ release: string; snapshot: string }> {
    try {
      const manifest = await getServerVersions();
      return manifest.latest;
    } catch (error) {
      throw new Error(`Error fetching latest versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Filters versions by type (release, snapshot, etc.)
   * @param type The version type to filter by
   * @returns Promise<Version[]> Array of versions of the specified type
   */
  export async function getVersionsByType(type: string): Promise<Version[]> {
    try {
      const manifest = await getServerVersions();
      return manifest.versions.filter(v => v.type === type);
    } catch (error) {
      throw new Error(`Error filtering versions by type: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default MinecraftApi;