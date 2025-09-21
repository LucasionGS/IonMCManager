import React, { useState } from 'react';
import './ModsList.scss';

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

interface ModsListProps {
  mods: {
    enabled: ModInfo[];
    disabled: ModInfo[];
  };
  onDeleteMod: (filename: string) => Promise<void>;
  onEnableMod: (filename: string) => Promise<void>;
  onDisableMod: (filename: string) => Promise<void>;
  loading?: boolean;
}

const ModsList: React.FC<ModsListProps> = ({
  mods,
  onDeleteMod,
  onEnableMod,
  onDisableMod,
  loading = false
}) => {
  const [loadingStates, setLoadingStates] = useState<Record<string, string>>({});

  const handleAction = async (action: () => Promise<void>, filename: string, actionType: string) => {
    setLoadingStates(prev => ({ ...prev, [filename]: actionType }));
    try {
      await action();
    } catch (error) {
      console.error(`Failed to ${actionType} mod:`, error);
    } finally {
      setLoadingStates(prev => {
        const newState = { ...prev };
        delete newState[filename];
        return newState;
      });
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (date?: Date): string => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="mods-list">
        <div className="mods-list__loading">
          <div className="spinner"></div>
          <p>Loading mods...</p>
        </div>
      </div>
    );
  }

  const allMods = [...mods.enabled, ...mods.disabled];

  if (allMods.length === 0) {
    return (
      <div className="mods-list">
        <div className="mods-list__empty">
          <h3>No mods installed</h3>
          <p>Upload some mods or browse CurseForge to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mods-list">
      {mods.enabled.length > 0 && (
        <div className="mods-list__section">
          <h3 className="mods-list__section-title">
            Enabled Mods ({mods.enabled.length})
          </h3>
          <div className="mods-list__grid">
            {mods.enabled.map((mod) => (
              <div key={mod.filename} className="mod-card mod-card--enabled">
                <div className="mod-card__header">
                  <div className="mod-card__info">
                    <h4 className="mod-card__name">{mod.name}</h4>
                    <p className="mod-card__version">{mod.version}</p>
                    {mod.authors && mod.authors.length > 0 && (
                      <p className="mod-card__authors">by {mod.authors.join(', ')}</p>
                    )}
                  </div>
                  <div className="mod-card__status mod-card__status--enabled">
                    Enabled
                  </div>
                </div>
                
                {mod.description && (
                  <p className="mod-card__description">{mod.description}</p>
                )}
                
                <div className="mod-card__meta">
                  <span className="mod-card__size">{formatFileSize(mod.size)}</span>
                  <span className="mod-card__date">{formatDate(mod.lastModified)}</span>
                </div>
                
                <div className="mod-card__actions">
                  <button
                    className="btn btn--secondary btn--small"
                    onClick={() => handleAction(() => onDisableMod(mod.filename), mod.filename, 'disabling')}
                    disabled={loadingStates[mod.filename] === 'disabling'}
                  >
                    {loadingStates[mod.filename] === 'disabling' ? 'Disabling...' : 'Disable'}
                  </button>
                  <button
                    className="btn btn--danger btn--small"
                    onClick={() => handleAction(() => onDeleteMod(mod.filename), mod.filename, 'deleting')}
                    disabled={loadingStates[mod.filename] === 'deleting'}
                  >
                    {loadingStates[mod.filename] === 'deleting' ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mods.disabled.length > 0 && (
        <div className="mods-list__section">
          <h3 className="mods-list__section-title">
            Disabled Mods ({mods.disabled.length})
          </h3>
          <div className="mods-list__grid">
            {mods.disabled.map((mod) => (
              <div key={mod.filename} className="mod-card mod-card--disabled">
                <div className="mod-card__header">
                  <div className="mod-card__info">
                    <h4 className="mod-card__name">{mod.name}</h4>
                    <p className="mod-card__version">{mod.version}</p>
                    {mod.authors && mod.authors.length > 0 && (
                      <p className="mod-card__authors">by {mod.authors.join(', ')}</p>
                    )}
                  </div>
                  <div className="mod-card__status mod-card__status--disabled">
                    Disabled
                  </div>
                </div>
                
                {mod.description && (
                  <p className="mod-card__description">{mod.description}</p>
                )}
                
                <div className="mod-card__meta">
                  <span className="mod-card__size">{formatFileSize(mod.size)}</span>
                  <span className="mod-card__date">{formatDate(mod.lastModified)}</span>
                </div>
                
                <div className="mod-card__actions">
                  <button
                    className="btn btn--primary btn--small"
                    onClick={() => handleAction(() => onEnableMod(mod.filename), mod.filename, 'enabling')}
                    disabled={loadingStates[mod.filename] === 'enabling'}
                  >
                    {loadingStates[mod.filename] === 'enabling' ? 'Enabling...' : 'Enable'}
                  </button>
                  <button
                    className="btn btn--danger btn--small"
                    onClick={() => handleAction(() => onDeleteMod(mod.filename), mod.filename, 'deleting')}
                    disabled={loadingStates[mod.filename] === 'deleting'}
                  >
                    {loadingStates[mod.filename] === 'deleting' ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModsList;