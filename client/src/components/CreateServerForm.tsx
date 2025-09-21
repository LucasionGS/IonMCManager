import { useState, useEffect } from 'react';
import minecraftApiService, { type MinecraftVersion, type ServerType, type ForgeVersion } from '../services/minecraftApi';
import './CreateServerForm.scss';

interface CreateServerFormProps {
  onClose: () => void;
  onServerCreated: (serverData: any) => void;
}

function CreateServerForm({ onClose, onServerCreated }: CreateServerFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    version: '',
    serverType: 'vanilla',
    memory: 1024,
    description: '',
    forgeVersion: ''
  });

  const [availableVersions, setAvailableVersions] = useState<MinecraftVersion[]>([]);
  const [serverTypes, setServerTypes] = useState<ServerType[]>([]);
  const [forgeVersions, setForgeVersions] = useState<ForgeVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoadingData(true);
        
        // Load server types and versions in parallel
        const [typesResponse, versionsResponse, latestResponse] = await Promise.all([
          minecraftApiService.getServerTypes(),
          minecraftApiService.getVersionsByType('release'), // Start with release versions
          minecraftApiService.getLatestVersions()
        ]);

        setServerTypes(typesResponse);
        setAvailableVersions(versionsResponse);
        
        // Set default version to latest release
        setFormData(prev => ({
          ...prev,
          version: latestResponse.release
        }));

      } catch (error) {
        console.error('Error loading initial data:', error);
        setError('Failed to load server creation data');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadInitialData();
  }, []);

  // Load Forge versions when Minecraft version or server type changes
  useEffect(() => {
    const loadForgeVersions = async () => {
      if (formData.serverType === 'forge' && formData.version) {
        try {
          const versions = await minecraftApiService.getForgeVersions(formData.version);
          setForgeVersions(versions);
          
          // Set default Forge version to the latest
          if (versions.length > 0) {
            setFormData(prev => ({
              ...prev,
              forgeVersion: versions[0].version
            }));
          }
        } catch (error) {
          console.error('Error loading Forge versions:', error);
          setForgeVersions([]);
        }
      } else {
        setForgeVersions([]);
      }
    };

    loadForgeVersions();
  }, [formData.version, formData.serverType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'memory' ? parseInt(value) || 1024 : value
    }));
    setError('');
  };

  const handleVersionTypeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const versionType = e.target.value;
    
    try {
      let versions: MinecraftVersion[];
      
      if (versionType === 'latest') {
        const latest = await minecraftApiService.getLatestVersions();
        setFormData(prev => ({ ...prev, version: latest.release }));
        return;
      } else if (versionType === 'latest-snapshot') {
        const latest = await minecraftApiService.getLatestVersions();
        setFormData(prev => ({ ...prev, version: latest.snapshot }));
        return;
      } else {
        versions = await minecraftApiService.getVersionsByType(versionType);
      }
      
      setAvailableVersions(versions);
      
      // Set first version as default
      if (versions.length > 0) {
        setFormData(prev => ({ ...prev, version: versions[0].id }));
      }
    } catch (error) {
      console.error('Error loading versions:', error);
      setError('Failed to load versions');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validation
      if (!formData.name.trim()) {
        throw new Error('Server name is required');
      }

      if (!formData.version) {
        throw new Error('Minecraft version is required');
      }

      if (formData.serverType === 'forge' && !formData.forgeVersion) {
        throw new Error('Forge version is required for Forge servers');
      }

      // Create server
      const serverData = await minecraftApiService.createServer({
        name: formData.name.trim(),
        version: formData.version,
        serverType: formData.serverType,
        forgeVersion: formData.serverType === 'forge' ? formData.forgeVersion : undefined,
        memory: formData.memory,
        description: formData.description.trim()
      });

      onServerCreated(serverData);

    } catch (error) {
      console.error('Error creating server:', error);
      setError(error instanceof Error ? error.message : 'Failed to create server');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="create-server-form">
        <div className="create-server-form__loading">
          <div className="loading-spinner"></div>
          <p>Loading server creation options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="create-server-form">
      <div className="create-server-form__header">
        <h2>Create New Minecraft Server</h2>
        <button 
          type="button" 
          className="create-server-form__close" 
          onClick={onClose}
          disabled={isLoading}
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="create-server-form__form">
        {error && (
          <div className="create-server-form__error">
            {error}
          </div>
        )}

        <div className="create-server-form__row">
          <div className="create-server-form__field">
            <label htmlFor="name" className="create-server-form__label">
              Server Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleInputChange}
              className="create-server-form__input"
              placeholder="My Awesome Server"
              disabled={isLoading}
            />
          </div>

          <div className="create-server-form__field">
            <label htmlFor="memory" className="create-server-form__label">
              Memory (MB)
            </label>
            <input
              id="memory"
              name="memory"
              type="number"
              min="512"
              max="16384"
              step="256"
              value={formData.memory}
              onChange={handleInputChange}
              className="create-server-form__input"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="create-server-form__row">
          <div className="create-server-form__field">
            <label htmlFor="serverType" className="create-server-form__label">
              Server Type *
            </label>
            <select
              id="serverType"
              name="serverType"
              value={formData.serverType}
              onChange={handleInputChange}
              className="create-server-form__select"
              disabled={isLoading}
              required
            >
              {serverTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name} - {type.description}
                </option>
              ))}
            </select>
          </div>

          <div className="create-server-form__field">
            <label htmlFor="versionType" className="create-server-form__label">
              Version Type
            </label>
            <select
              id="versionType"
              name="versionType"
              onChange={handleVersionTypeChange}
              className="create-server-form__select"
              disabled={isLoading}
            >
              <option value="release">Release</option>
              <option value="snapshot">Snapshot</option>
              <option value="latest">Latest Release</option>
              <option value="latest-snapshot">Latest Snapshot</option>
            </select>
          </div>
        </div>

        <div className="create-server-form__row">
          <div className="create-server-form__field">
            <label htmlFor="version" className="create-server-form__label">
              Minecraft Version *
            </label>
            <select
              id="version"
              name="version"
              value={formData.version}
              onChange={handleInputChange}
              className="create-server-form__select"
              disabled={isLoading}
              required
            >
              {availableVersions.map(version => (
                <option key={version.id} value={version.id}>
                  {version.id} ({version.type})
                </option>
              ))}
            </select>
          </div>

          {formData.serverType === 'forge' && (
            <div className="create-server-form__field">
              <label htmlFor="forgeVersion" className="create-server-form__label">
                Forge Version
              </label>
              <select
                id="forgeVersion"
                name="forgeVersion"
                value={formData.forgeVersion}
                onChange={handleInputChange}
                className="create-server-form__select"
                disabled={isLoading || forgeVersions.length === 0}
              >
                {forgeVersions.length === 0 ? (
                  <option value="">Loading Forge versions...</option>
                ) : (
                  forgeVersions.map(forge => (
                    <option key={forge.version} value={forge.version}>
                      {forge.version}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>

        <div className="create-server-form__field">
          <label htmlFor="description" className="create-server-form__label">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            className="create-server-form__textarea"
            placeholder="Optional description for your server..."
            rows={3}
            disabled={isLoading}
          />
        </div>

        <div className="create-server-form__actions">
          <button
            type="button"
            onClick={onClose}
            className="create-server-form__button create-server-form__button--secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="create-server-form__button create-server-form__button--primary"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Server...' : 'Create Server'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateServerForm;