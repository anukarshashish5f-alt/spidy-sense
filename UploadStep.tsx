import { UploadCloud, FileImage, FileVideo, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

interface UploadStepProps {
  onMediaSelected: (file: File, previewUrl: string, mediaType: 'image' | 'video') => void;
}

export default function UploadStep({ onMediaSelected }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [acceptedType, setAcceptedType] = useState<'image' | 'video'>('image');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      let type: 'image' | 'video' | null = null;
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      if (!type) {
        setError('Choose a supported image or video file.');
        return;
      }
      if (type !== acceptedType) {
        setError(`Please choose a ${acceptedType} file in the selected tab.`);
        return;
      }
      const maxBytes = type === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`File is too large. Maximum size: ${type === 'image' ? '10 MB' : '50 MB'}.`);
        return;
      }
      setError(null);

      const url = URL.createObjectURL(file);
      setPreview(url);
      setFileName(file.name);
      setMediaType(type);
      onMediaSelected(file, url, type);
    },
    [acceptedType, onMediaSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const clearMedia = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const switchType = (type: 'image' | 'video') => {
    setAcceptedType(type);
    clearMedia();
  };

  return (
    <div className="animate-fade-in">
      {/* Toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-xl glass p-1 gap-1">
          <button
            onClick={() => switchType('image')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
              acceptedType === 'image'
                ? 'gradient-spider text-white spider-glow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileImage className="w-4 h-4" />
            Image
          </button>
          <button
            onClick={() => switchType('video')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
              acceptedType === 'video'
                ? 'gradient-spider text-white spider-glow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileVideo className="w-4 h-4" />
            Video
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !preview && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-16 text-center transition-all duration-300 cursor-pointer ${
          isDragging
            ? 'dropzone-active'
            : 'border-white/10 hover:border-red-500/40 hover:bg-red-500/5'
        } ${preview ? 'cursor-default' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedType === 'image' ? 'image/*' : 'video/*'}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {!preview ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full glass flex items-center justify-center">
                {acceptedType === 'image' ? (
                  <UploadCloud className="w-10 h-10 text-red-400" />
                ) : (
                  <FileVideo className="w-10 h-10 text-red-400" />
                )}
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-red-500/30 animate-pulse-ring" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">
                {acceptedType === 'image'
                  ? 'Drop your image here'
                  : 'Drop your video here'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {acceptedType === 'image'
                  ? 'or click to browse — JPG, PNG, WebP supported'
                  : 'or click to browse — MP4, WebM, MOV supported'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
              {acceptedType === 'image' ? (
                <>
                  <FileImage className="w-4 h-4" />
                  <span>Max 10MB · Images only</span>
                </>
              ) : (
                <>
                  <FileVideo className="w-4 h-4" />
                  <span>Max 50MB · Videos only</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              {mediaType === 'image' ? (
                <img
                  src={preview}
                  alt="Uploaded preview"
                  className="max-h-64 rounded-xl object-contain"
                />
              ) : (
                <video
                  src={preview}
                  controls
                  className="max-h-64 rounded-xl object-contain"
                />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearMedia();
                }}
                className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors spider-glow"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {mediaType === 'image' ? (
                <FileImage className="w-4 h-4 text-red-400" />
              ) : (
                <FileVideo className="w-4 h-4 text-red-400" />
              )}
              <span>{fileName}</span>
            </div>
          </div>
        )}
      </div>

      {preview && (
        <div className="mt-6 text-center animate-fade-up">
          <p className="text-sm text-gray-400">
            {mediaType === 'image' ? 'Image' : 'Video'} loaded. Proceed to the next step to begin analysis.
          </p>
        </div>
      )}
    </div>
  );
}
