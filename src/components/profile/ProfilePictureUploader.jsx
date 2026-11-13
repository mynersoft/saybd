import React, { useState, useRef, useEffect, useCallback } from 'react';
import { dbService } from '../../services/supabase/dbService.js';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import {
  Camera,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  X,
  Trash2,
  AlertCircle,
  Loader2,
  Move,
  Sparkles,
  ShieldAlert
} from 'lucide-react';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export function ProfilePictureUploader({
  user,
  onImageUpdated,
  size = 'lg', // 'sm' | 'md' | 'lg'
}) {
  const { addToast } = useNotification();
  const fileInputRef = useRef(null);

  // Modal & state
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
  const [sourceImage, setSourceImage] = useState(null);
  const [sourceImageUrl, setSourceImageUrl] = useState('');
  
  // Crop & Transform state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const previewCanvasRef = useRef(null);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    // 1. Validate File Size <= 5MB
    if (file.size > MAX_FILE_SIZE_BYTES) {
      addToast('Image exceeds maximum allowed size of 5 MB. Please select a smaller file.', 'error');
      return;
    }

    // 2. Validate MIME Type
    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      addToast('Invalid image format. Supported formats: JPG, JPEG, PNG, WebP.', 'error');
      return;
    }

    // Load image into memory
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        setSourceImageUrl(reader.result);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setIsCropModalOpen(true);
      };
      img.onerror = () => {
        addToast('Failed to load selected image file.', 'error');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  // Render crop preview canvas whenever image, zoom, or pan changes
  const renderPreview = useCallback(() => {
    if (!sourceImage || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width; // 320px
    ctx.clearRect(0, 0, size, size);

    // Save context
    ctx.save();

    // Clip to square with rounded corners / circle guide
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.clip();

    // Calculate scaled dimensions to cover the square
    const imgAspect = sourceImage.width / sourceImage.height;
    let drawWidth, drawHeight;

    if (imgAspect > 1) {
      drawHeight = size * zoom;
      drawWidth = size * imgAspect * zoom;
    } else {
      drawWidth = size * zoom;
      drawHeight = (size / imgAspect) * zoom;
    }

    const drawX = size / 2 - drawWidth / 2 + pan.x;
    const drawY = size / 2 - drawHeight / 2 + pan.y;

    ctx.drawImage(sourceImage, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    // Outer guide ring
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();
  }, [sourceImage, zoom, pan]);

  useEffect(() => {
    if (isCropModalOpen) {
      renderPreview();
    }
  }, [isCropModalOpen, renderPreview]);

  // Mouse / Touch Drag Handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Reset Crop Position and Zoom
  const handleResetCrop = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Save Cropped Image
  const handleSaveCrop = async () => {
    if (!sourceImage || !user?.id) return;

    setIsUploading(true);
    setUploadProgress(20);

    try {
      // Offscreen canvas at 400x400 for high DPI
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 400;
      exportCanvas.height = 400;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not create export canvas');

      const size = 400;
      const scale = size / 320; // Ratio of export canvas to preview canvas

      const imgAspect = sourceImage.width / sourceImage.height;
      let drawWidth, drawHeight;

      if (imgAspect > 1) {
        drawHeight = size * zoom;
        drawWidth = size * imgAspect * zoom;
      } else {
        drawWidth = size * zoom;
        drawHeight = (size / imgAspect) * zoom;
      }

      const drawX = size / 2 - drawWidth / 2 + pan.x * scale;
      const drawY = size / 2 - drawHeight / 2 + pan.y * scale;

      ctx.drawImage(sourceImage, drawX, drawY, drawWidth, drawHeight);

      setUploadProgress(50);

      // Convert to Blob (WebP / JPEG compression)
      const blob = await new Promise((resolve) => {
        exportCanvas.toBlob(
          (b) => resolve(b),
          'image/webp',
          0.92
        );
      });

      if (!blob) throw new Error('Failed to create image blob');

      setUploadProgress(75);

      // Upload to Supabase Storage / local database
      const newAvatarUrl = await dbService.uploadProfileImage(user.id, blob);

      setUploadProgress(100);
      addToast('Profile picture updated successfully!', 'success');
      setIsCropModalOpen(false);

      if (onImageUpdated) {
        onImageUpdated(newAvatarUrl);
      }
    } catch (err) {
      console.error('Error saving profile picture:', err);
      addToast('Failed to save profile picture. Please try again.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Remove Profile Picture and reset to default avatar
  const handleConfirmRemove = async () => {
    if (!user?.id) return;
    setIsUploading(true);
    try {
      const defaultAvatar = await dbService.deleteProfileImage(user.id);
      addToast('Profile picture removed. Default avatar restored.', 'info');
      setIsConfirmRemoveOpen(false);
      if (onImageUpdated) {
        onImageUpdated(defaultAvatar);
      }
    } catch (err) {
      addToast('Failed to remove profile picture.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Dimensions based on size prop
  const avatarDimension = size === 'sm' ? 'w-12 h-12' : size === 'md' ? 'w-20 h-20' : 'w-24 h-24 sm:w-28 sm:h-28';

  const isDefaultAvatar = user?.avatar_url && user.avatar_url.includes('dicebear.com');

  return (
    <>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
      />

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        
        {/* Avatar Display with Hover Overlay */}
        <div className="relative group shrink-0">
          <img
            src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
            alt={user?.full_name || 'Profile'}
            className={`${avatarDimension} rounded-3xl object-cover ring-4 ring-indigo-500/20 shadow-xl transition-transform group-hover:scale-102`}
          />

          {/* Camera Quick Action Badge */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1.5 -right-1.5 p-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-110 active:scale-95"
            title="Upload or Change Profile Picture"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons & Guidance */}
        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            
            {/* Upload / Replace Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all hover:scale-102 active:scale-95"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{user?.avatar_url && !isDefaultAvatar ? 'Replace Picture' : 'Upload Picture'}</span>
            </button>

            {/* Remove Picture Button (if custom avatar set) */}
            {user?.avatar_url && !isDefaultAvatar && (
              <button
                type="button"
                onClick={() => setIsConfirmRemoveOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors active:scale-95"
                title="Remove picture and use default avatar"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            JPG, PNG, or WebP. Max 5 MB. Crop and zoom supported with square aspect ratio.
          </p>
        </div>

      </div>

      {/* --- CROP & REPOSITION MODAL --- */}
      {isCropModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5">
            
            {/* Top Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <Move className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Crop & Position Profile Picture
                  </h3>
                  <p className="text-xs text-slate-400">Drag to reposition, use slider to zoom in/out.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCropModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Canvas Crop Area */}
            <div className="flex flex-col items-center justify-center">
              <div
                className="relative w-80 h-80 rounded-2xl bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing border-2 border-slate-800 shadow-inner select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <canvas
                  ref={previewCanvasRef}
                  width={320}
                  height={320}
                  className="w-full h-full pointer-events-none"
                />

                {/* Subtle reposition helper badge */}
                <div className="absolute top-2.5 left-2.5 pointer-events-none px-2 py-1 rounded-lg bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white/90 flex items-center gap-1.5">
                  <Move className="w-3 h-3 text-indigo-400" />
                  <span>Drag image to pan</span>
                </div>
              </div>
            </div>

            {/* Zoom Slider & Controls */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <ZoomIn className="w-4 h-4 text-indigo-500" />
                  <span>Zoom Level: {zoom.toFixed(1)}x</span>
                </span>

                <button
                  type="button"
                  onClick={handleResetCrop}
                  className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Crop</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(1, z - 0.2))}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Upload Progress Bar (when active) */}
            {isUploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span>Uploading to profile storage...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCropModalOpen(false)}
                disabled={isUploading}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveCrop}
                disabled={isUploading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all hover:scale-102"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Profile Picture</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- CONFIRM REMOVE PICTURE MODAL --- */}
      {isConfirmRemoveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Remove Profile Picture?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your profile picture will be reset to a clean default avatar. You can upload a new photo anytime.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmRemoveOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Keep Picture
              </button>

              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={isUploading}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition-all hover:scale-102"
              >
                {isUploading ? 'Removing...' : 'Confirm Removal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
