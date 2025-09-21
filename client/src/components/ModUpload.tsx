import React, { useState, useRef } from 'react';
import './ModUpload.scss';

interface ModUploadProps {
  onUploadMod: (file: File) => Promise<void>;
  onInstallFromCurseForge: (modId: number, fileId?: number) => Promise<void>;
  onInstallFromManifest: (manifest: any) => Promise<void>;
  loading?: boolean;
}

const ModUpload: React.FC<ModUploadProps> = ({
  onUploadMod,
  onInstallFromCurseForge,
  onInstallFromManifest,
  loading = false
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'curseforge' | 'manifest'>('file');
  const [curseForgeId, setCurseForgeId] = useState('');
  const [fileId, setFileId] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manifestInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.jar')) {
      setError('Please select a .jar file');
      return;
    }

    setError('');
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev === null) return null;
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 100);

      await onUploadMod(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setUploadProgress(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 1000);
    } catch (error) {
      setUploadProgress(null);
      setError(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const handleCurseForgeInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const modId = parseInt(curseForgeId);
    if (isNaN(modId) || modId <= 0) {
      setError('Please enter a valid CurseForge mod ID');
      return;
    }

    const modFileId = fileId ? parseInt(fileId) : undefined;
    if (fileId && (isNaN(modFileId!) || modFileId! <= 0)) {
      setError('Please enter a valid file ID');
      return;
    }

    setError('');

    try {
      await onInstallFromCurseForge(modId, modFileId);
      setCurseForgeId('');
      setFileId('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Installation failed');
    }
  };

  const handleManifestUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setError('Please select a .json file');
      return;
    }

    setError('');

    try {
      const text = await file.text();
      const manifest = JSON.parse(text);
      
      await onInstallFromManifest(manifest);
      
      if (manifestInputRef.current) {
        manifestInputRef.current.value = '';
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        setError('Invalid JSON file');
      } else {
        setError(error instanceof Error ? error.message : 'Installation failed');
      }
    }
  };

  return (
    <div className="mod-upload">
      <div className="mod-upload__tabs">
        <button
          className={`mod-upload__tab ${activeTab === 'file' ? 'mod-upload__tab--active' : ''}`}
          onClick={() => setActiveTab('file')}
        >
          Upload File
        </button>
        <button
          className={`mod-upload__tab ${activeTab === 'curseforge' ? 'mod-upload__tab--active' : ''}`}
          onClick={() => setActiveTab('curseforge')}
        >
          CurseForge
        </button>
        <button
          className={`mod-upload__tab ${activeTab === 'manifest' ? 'mod-upload__tab--active' : ''}`}
          onClick={() => setActiveTab('manifest')}
        >
          Modpack Manifest
        </button>
      </div>

      {error && (
        <div className="mod-upload__error">
          {error}
        </div>
      )}

      <div className="mod-upload__content">
        {activeTab === 'file' && (
          <div className="mod-upload__panel">
            <h3>Upload Mod File</h3>
            <p>Select a .jar file to upload to your server.</p>
            
            <div className="mod-upload__file-area">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jar"
                onChange={handleFileUpload}
                disabled={loading || uploadProgress !== null}
                className="mod-upload__file-input"
                id="mod-file-input"
              />
              <label htmlFor="mod-file-input" className="mod-upload__file-label">
                <div className="mod-upload__file-icon">📁</div>
                <div className="mod-upload__file-text">
                  {uploadProgress !== null ? (
                    <>
                      <strong>Uploading... {Math.round(uploadProgress)}%</strong>
                      <div className="mod-upload__progress">
                        <div 
                          className="mod-upload__progress-bar"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>Choose a .jar file</strong>
                      <span>or drag and drop here</span>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'curseforge' && (
          <div className="mod-upload__panel">
            <h3>Install from CurseForge</h3>
            <p>Enter a CurseForge mod ID to install directly from CurseForge.</p>
            
            <form onSubmit={handleCurseForgeInstall} className="mod-upload__form">
              <div className="mod-upload__field">
                <label htmlFor="curseforge-id">Mod ID *</label>
                <input
                  id="curseforge-id"
                  type="number"
                  value={curseForgeId}
                  onChange={(e) => setCurseForgeId(e.target.value)}
                  placeholder="e.g. 238222"
                  required
                  disabled={loading}
                  className="mod-upload__input"
                />
                <small>You can find the mod ID in the CurseForge URL</small>
              </div>
              
              <div className="mod-upload__field">
                <label htmlFor="file-id">File ID (optional)</label>
                <input
                  id="file-id"
                  type="number"
                  value={fileId}
                  onChange={(e) => setFileId(e.target.value)}
                  placeholder="Leave empty for latest"
                  disabled={loading}
                  className="mod-upload__input"
                />
                <small>Specific file version to install</small>
              </div>
              
              <button
                type="submit"
                disabled={loading || !curseForgeId}
                className="btn btn--primary"
              >
                {loading ? 'Installing...' : 'Install Mod'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'manifest' && (
          <div className="mod-upload__panel">
            <h3>Install Modpack</h3>
            <p>Upload a CurseForge manifest.json file to install multiple mods at once.</p>
            
            <div className="mod-upload__file-area">
              <input
                ref={manifestInputRef}
                type="file"
                accept=".json"
                onChange={handleManifestUpload}
                disabled={loading}
                className="mod-upload__file-input"
                id="manifest-file-input"
              />
              <label htmlFor="manifest-file-input" className="mod-upload__file-label">
                <div className="mod-upload__file-icon">📋</div>
                <div className="mod-upload__file-text">
                  <strong>Choose manifest.json</strong>
                  <span>from a CurseForge modpack</span>
                </div>
              </label>
            </div>
            
            <div className="mod-upload__info">
              <h4>How to get a manifest file:</h4>
              <ol>
                <li>Download a modpack from CurseForge</li>
                <li>Extract the zip file</li>
                <li>Look for manifest.json in the root folder</li>
                <li>Upload that file here</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModUpload;