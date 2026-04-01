'use client';

import { useRef, useState } from 'react';
import { Upload, Link, X, Image as ImageIcon, ExternalLink, Settings } from 'lucide-react';
import { ImageBlockData, ContentBlock } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { BlockWrapper } from './BlockWrapper';

interface ImageBlockProps {
  block: ContentBlock & { data: ImageBlockData };
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

export function ImageBlock({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: ImageBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [tempUrl, setTempUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setIsUploading(true);

    try {
      // For now, create a local URL - in production this would upload to Cloudinary
      const url = URL.createObjectURL(file);
      
      onAction({
        type: 'UPDATE_BLOCK',
        payload: {
          id: block.id,
          data: {
            ...block.data,
            src: url,
            alt: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension for alt text
            width: undefined, // Will be set when image loads
            height: undefined
          }
        }
      });
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (tempUrl) {
      onAction({
        type: 'UPDATE_BLOCK',
        payload: {
          id: block.id,
          data: {
            ...block.data,
            src: tempUrl,
            alt: block.data.alt || 'Image'
          }
        }
      });
      setTempUrl('');
      setShowUrlInput(false);
    }
  };

  const handleAltChange = (alt: string) => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, alt }
      }
    });
  };

  const handleCaptionChange = (caption: string) => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, caption }
      }
    });
  };

  const handleAlignmentChange = (alignment: 'left' | 'center' | 'right' | 'full') => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, alignment }
      }
    });
  };

  const getImageStyles = () => {
    const alignment = block.data.alignment || 'center';
    return {
      left: 'mr-auto',
      center: 'mx-auto',
      right: 'ml-auto',
      full: 'w-full'
    }[alignment];
  };

  if (readonly) {
    if (!block.data.src) {
      return (
        <div className="prose prose-lg max-w-none">
          <div className="bg-gray-100 rounded-lg p-4 text-center text-gray-500">
            <ImageIcon className="w-8 h-8 mx-auto mb-2" />
            <p>Image not loaded</p>
          </div>
        </div>
      );
    }

    return (
      <figure className={`prose prose-lg max-w-none ${getImageStyles()}`}>
        <img
          src={block.data.src}
          alt={block.data.alt || 'Image'}
          className="rounded-lg shadow-sm"
          style={{
            maxWidth: block.data.alignment === 'full' ? '100%' : '100%',
            height: 'auto'
          }}
        />
        {block.data.caption && (
          <figcaption className="text-center text-gray-600 mt-2">
            {block.data.caption}
          </figcaption>
        )}
      </figure>
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
        {/* Image Display or Upload Area */}
        {block.data.src ? (
          <div className="relative group">
            <div className={`relative ${getImageStyles()}`}>
              <img
                src={block.data.src}
                alt={block.data.alt || 'Image'}
                className="rounded-lg shadow-sm max-w-full h-auto"
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  onAction({
                    type: 'UPDATE_BLOCK',
                    payload: {
                      id: block.id,
                      data: {
                        ...block.data,
                        width: img.naturalWidth,
                        height: img.naturalHeight
                      }
                    }
                  });
                }}
              />
              
              {/* Image Actions Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-white text-gray-700 rounded-lg shadow-md hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Replace
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 bg-white text-gray-700 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Image Settings Panel */}
            {showSettings && (
              <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alt Text
                    </label>
                    <input
                      type="text"
                      value={block.data.alt || ''}
                      onChange={(e) => handleAltChange(e.target.value)}
                      placeholder="Describe the image..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alignment
                    </label>
                    <select
                      value={block.data.alignment || 'center'}
                      onChange={(e) => handleAlignmentChange(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                      <option value="full">Full Width</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 hover:bg-primary-50 transition-all duration-200">
            {isUploading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
                <p className="text-gray-600">Uploading image...</p>
              </div>
            ) : (
              <>
                <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Add an image</h3>
                <p className="text-gray-500 mb-6">Upload from your computer or add from a URL</p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Image
                  </button>
                  
                  <button
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Link className="w-4 h-4" />
                    Add from URL
                  </button>
                </div>

                {showUrlInput && (
                  <div className="mt-4 flex gap-2">
                    <input
                      type="url"
                      value={tempUrl}
                      onChange={(e) => setTempUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={handleUrlSubmit}
                      className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowUrlInput(false);
                        setTempUrl('');
                      }}
                      className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Caption Input */}
        {block.data.src && (
          <div>
            <input
              type="text"
              value={block.data.caption || ''}
              onChange={(e) => handleCaptionChange(e.target.value)}
              placeholder="Add a caption (optional)"
              className="w-full px-0 py-2 text-center text-gray-600 bg-transparent border-none outline-none placeholder-gray-400 text-sm focus:text-gray-900"
            />
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileUpload(file);
            }
          }}
          className="hidden"
        />
      </div>
    </BlockWrapper>
  );
}