'use client';

import { useRef, useState } from 'react';
import { Upload, X, Settings, Move, Grid, Image as ImageIcon } from 'lucide-react';
import { GalleryBlockData, ContentBlock } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { BlockWrapper } from './BlockWrapper';

interface GalleryBlockProps {
  block: ContentBlock & { data: GalleryBlockData };
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

export function GalleryBlock({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: GalleryBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleFilesUpload = async (files: FileList) => {
    const newImages = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        // For demo purposes - in production, upload to Cloudinary
        const url = URL.createObjectURL(file);
        newImages.push({
          id: crypto.randomUUID(),
          src: url,
          alt: file.name.replace(/\.[^/.]+$/, ""),
          caption: ''
        });
      }
    }

    if (newImages.length > 0) {
      onAction({
        type: 'UPDATE_BLOCK',
        payload: {
          id: block.id,
          data: {
            ...block.data,
            images: [...(block.data.images || []), ...newImages]
          }
        }
      });
    }
  };

  const removeImage = (imageId: string) => {
    const newImages = block.data.images?.filter(img => img.id !== imageId) || [];
    
    if (newImages.length === 0) {
      onAction({ type: 'DELETE_BLOCK', payload: { id: block.id } });
      return;
    }

    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, images: newImages }
      }
    });
  };

  const updateImageCaption = (imageId: string, caption: string) => {
    const newImages = block.data.images?.map(img => 
      img.id === imageId ? { ...img, caption } : img
    ) || [];

    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, images: newImages }
      }
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...(block.data.images || [])];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);

    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, images: newImages }
      }
    });

    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const getLayoutClasses = () => {
    const layout = block.data.layout || 'grid';
    switch (layout) {
      case 'masonry':
        return 'columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4';
      case 'carousel':
        return 'flex gap-4 overflow-x-auto pb-4';
      default:
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    }
  };

  const getImageClasses = () => {
    const layout = block.data.layout || 'grid';
    return layout === 'carousel' ? 'flex-none w-64' : 'w-full';
  };

  if (readonly) {
    if (!block.data.images || block.data.images.length === 0) {
      return (
        <div className="prose prose-lg max-w-none">
          <div className="bg-gray-100 rounded-lg p-4 text-center text-gray-500">
            <Grid className="w-8 h-8 mx-auto mb-2" />
            <p>Gallery is empty</p>
          </div>
        </div>
      );
    }

    return (
      <div className="prose prose-lg max-w-none">
        <div className={getLayoutClasses()}>
          {block.data.images.map((image) => (
            <div key={image.id} className={`${getImageClasses()} break-inside-avoid`}>
              <img
                src={image.src}
                alt={image.alt || 'Gallery image'}
                className="w-full h-auto rounded-lg shadow-sm"
              />
              {image.caption && (
                <p className="text-sm text-gray-600 mt-2 text-center">
                  {image.caption}
                </p>
              )}
            </div>
          ))}
        </div>
        {block.data.caption && (
          <p className="text-center text-gray-600 mt-4">
            {block.data.caption}
          </p>
        )}
      </div>
    );
  }

  return (
    <BlockWrapper
      block={block}
      isSelected={isSelected}
      isFocused={isFocused}
      onAction={onAction}
    >
      <div className="space-y-4">
        {(!block.data.images || block.data.images.length === 0) ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 hover:bg-primary-50 transition-all duration-200">
            <Grid className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Create Image Gallery</h3>
            <p className="text-gray-500 mb-6">Upload multiple images to create a beautiful gallery</p>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload Images
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Gallery Grid */}
            <div className={getLayoutClasses()}>
              {block.data.images.map((image, index) => (
                <div
                  key={image.id}
                  className={`${getImageClasses()} break-inside-avoid group relative`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="relative rounded-lg overflow-hidden">
                    <img
                      src={image.src}
                      alt={image.alt || 'Gallery image'}
                      className="w-full h-auto"
                    />
                    
                    {/* Image Actions Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-2">
                        <button
                          className="p-2 bg-white text-gray-700 rounded-lg shadow-md hover:bg-gray-50 transition-colors cursor-move"
                          title="Drag to reorder"
                        >
                          <Move className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeImage(image.id)}
                          className="p-2 bg-white text-red-600 rounded-lg shadow-md hover:bg-red-50 transition-colors"
                          title="Remove image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Caption Input */}
                  <input
                    type="text"
                    value={image.caption || ''}
                    onChange={(e) => updateImageCaption(image.id, e.target.value)}
                    placeholder="Add caption..."
                    className="w-full mt-2 px-0 py-1 text-center text-sm text-gray-600 bg-transparent border-none outline-none placeholder-gray-400 focus:text-gray-900"
                  />
                </div>
              ))}
            </div>

            {/* Add More Images Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
            >
              <Upload className="w-4 h-4" />
              Add More Images
            </button>

            {/* Settings */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
              >
                <Settings className="w-3 h-3" />
                Gallery Settings
              </button>
            </div>

            {showSettings && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Layout
                  </label>
                  <select
                    value={block.data.layout || 'grid'}
                    onChange={(e) => onAction({
                      type: 'UPDATE_BLOCK',
                      payload: {
                        id: block.id,
                        data: { ...block.data, layout: e.target.value as any }
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="grid">Grid</option>
                    <option value="masonry">Masonry</option>
                    <option value="carousel">Carousel</option>
                  </select>
                </div>
              </div>
            )}

            {/* Gallery Caption */}
            <input
              type="text"
              value={block.data.caption || ''}
              onChange={(e) => onAction({
                type: 'UPDATE_BLOCK',
                payload: {
                  id: block.id,
                  data: { ...block.data, caption: e.target.value }
                }
              })}
              placeholder="Gallery caption (optional)"
              className="w-full text-center text-gray-600 bg-transparent border-none outline-none placeholder-gray-400 text-sm"
            />
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => {
            const files = e.target.files;
            if (files) {
              handleFilesUpload(files);
            }
          }}
          className="hidden"
        />
      </div>
    </BlockWrapper>
  );
}