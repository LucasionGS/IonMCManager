import React, { useState, useCallback } from 'react';
import './CurseForgeModBrowser.scss';

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
  latestFiles: Array<{
    id: number;
    displayName: string;
    fileName: string;
    fileDate: string;
    downloadUrl: string;
    gameVersions: string[];
  }>;
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

interface CurseForgeModBrowserProps {
  onInstallMod: (modId: number, fileId?: number) => Promise<void>;
  onSearchMods: (query: string, gameVersion?: string, pageSize?: number, index?: number) => Promise<CurseForgeSearchResult>;
  gameVersion?: string;
  loading?: boolean;
}

const CurseForgeModBrowser: React.FC<CurseForgeModBrowserProps> = ({
  onInstallMod,
  onSearchMods,
  gameVersion,
  loading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CurseForgeSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [installingMods, setInstallingMods] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>('');

  const pageSize = 20;

  const performSearch = useCallback(async (query: string, page: number = 0) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    setError('');

    try {
      const results = await onSearchMods(query, gameVersion, pageSize, page * pageSize);
      setSearchResults(results);
      setCurrentPage(page);
    } catch (error) {
      console.error('Search error:', error);
      setError(error instanceof Error ? error.message : 'Search failed');
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  }, [onSearchMods, gameVersion, pageSize]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery, 0);
  };

  const handleInstall = async (mod: CurseForgeMod, fileId?: number) => {
    setInstallingMods(prev => new Set([...prev, mod.id]));
    setError('');

    try {
      await onInstallMod(mod.id, fileId);
    } catch (error) {
      console.error('Install error:', error);
      setError(error instanceof Error ? error.message : 'Installation failed');
    } finally {
      setInstallingMods(prev => {
        const newSet = new Set(prev);
        newSet.delete(mod.id);
        return newSet;
      });
    }
  };

  const goToPage = (page: number) => {
    if (searchQuery.trim()) {
      performSearch(searchQuery, page);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const getCompatibleVersions = (mod: CurseForgeMod): string[] => {
    const versions = new Set<string>();
    mod.latestFiles.forEach(file => {
      file.gameVersions.forEach(version => versions.add(version));
    });
    return Array.from(versions).sort().reverse();
  };

  const totalPages = Math.ceil((searchResults?.pagination.totalCount || 0) / pageSize);

  return (
    <div className="curseforge-browser">
      <div className="curseforge-browser__header">
        <h3>Browse CurseForge Mods</h3>
        <form onSubmit={handleSearch} className="curseforge-browser__search">
          <div className="curseforge-browser__search-input">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for mods..."
              disabled={searching || loading}
              className="search-input"
            />
            <button 
              type="submit" 
              disabled={searching || loading || !searchQuery.trim()}
              className="btn btn--primary"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {gameVersion && (
            <div className="curseforge-browser__version-info">
              Searching for {gameVersion} compatible mods
            </div>
          )}
        </form>
      </div>

      {error && (
        <div className="curseforge-browser__error">
          {error}
        </div>
      )}

      {searching && (
        <div className="curseforge-browser__loading">
          <div className="spinner"></div>
          <p>Searching CurseForge...</p>
        </div>
      )}

      {searchResults && searchResults.data.length > 0 && (
        <div className="curseforge-browser__results">
          <div className="curseforge-browser__results-header">
            <span className="results-count">
              {formatNumber(searchResults.pagination.totalCount)} mods found
            </span>
            <span className="page-info">
              Page {currentPage + 1} of {totalPages}
            </span>
          </div>

          <div className="curseforge-browser__grid">
            {searchResults.data.map((mod) => (
              <div key={mod.id} className="mod-result">
                <div className="mod-result__header">
                  {mod.logo && (
                    <img 
                      src={mod.logo.url} 
                      alt={mod.name}
                      className="mod-result__logo"
                    />
                  )}
                  <div className="mod-result__info">
                    <h4 className="mod-result__name">{mod.name}</h4>
                    <p className="mod-result__authors">
                      by {mod.authors.map(a => a.name).join(', ')}
                    </p>
                    <div className="mod-result__stats">
                      <span>📥 {formatNumber(mod.downloadCount)}</span>
                      <span>📅 {formatDate(mod.dateModified)}</span>
                    </div>
                  </div>
                </div>

                <p className="mod-result__summary">{mod.summary}</p>

                <div className="mod-result__categories">
                  {mod.categories.slice(0, 3).map((category) => (
                    <span key={category.id} className="category-tag">
                      {category.name}
                    </span>
                  ))}
                </div>

                <div className="mod-result__versions">
                  <strong>Compatible versions:</strong>
                  <div className="version-tags">
                    {getCompatibleVersions(mod).slice(0, 4).map((version) => (
                      <span key={version} className="version-tag">
                        {version}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mod-result__actions">
                  <button
                    onClick={() => handleInstall(mod)}
                    disabled={installingMods.has(mod.id) || loading}
                    className="btn btn--primary btn--small"
                  >
                    {installingMods.has(mod.id) ? 'Installing...' : 'Install Latest'}
                  </button>
                  
                  {mod.latestFiles.length > 1 && (
                    <div className="mod-result__file-select">
                      <select
                        onChange={(e) => {
                          const fileId = parseInt(e.target.value);
                          if (fileId) {
                            handleInstall(mod, fileId);
                            e.target.value = '';
                          }
                        }}
                        disabled={installingMods.has(mod.id) || loading}
                        className="file-select"
                      >
                        <option value="">Choose version...</option>
                        {mod.latestFiles.map((file) => (
                          <option key={file.id} value={file.id}>
                            {file.displayName} ({file.gameVersions.join(', ')})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="curseforge-browser__pagination">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 0 || searching}
                className="btn btn--secondary"
              >
                Previous
              </button>
              
              <span className="pagination-info">
                {currentPage + 1} / {totalPages}
              </span>
              
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages - 1 || searching}
                className="btn btn--secondary"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {searchResults && searchResults.data.length === 0 && (
        <div className="curseforge-browser__no-results">
          <h4>No mods found</h4>
          <p>Try adjusting your search terms or check your spelling.</p>
        </div>
      )}
    </div>
  );
};

export default CurseForgeModBrowser;