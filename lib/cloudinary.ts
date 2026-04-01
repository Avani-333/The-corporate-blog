import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Upload configurations for different use cases
export const uploadConfigs = {
  // Blog post featured images
  featuredImage: {
    folder: 'blog/featured',
    transformation: [
      { width: 1200, height: 630, crop: 'fill', gravity: 'center' },
      { quality: 'auto:good' },
      { format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    max_file_size: 5000000, // 5MB
  },

  // Blog post content images
  contentImage: {
    folder: 'blog/content',
    transformation: [
      { width: 1000, crop: 'limit' },
      { quality: 'auto:good' },
      { format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    max_file_size: 3000000, // 3MB
  },

  // User avatars
  avatar: {
    folder: 'users/avatars',
    transformation: [
      { width: 200, height: 200, crop: 'fill', gravity: 'face' },
      { quality: 'auto:good' },
      { format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png'],
    max_file_size: 1000000, // 1MB
  },

  // Gallery images
  gallery: {
    folder: 'blog/gallery',
    transformation: [
      { width: 800, crop: 'limit' },
      { quality: 'auto:good' },
      { format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    max_file_size: 4000000, // 4MB
  }
};

// Utility functions
export const generateImageUrl = (
  publicId: string, 
  options: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string;
    format?: string;
  } = {}
) => {
  return cloudinary.url(publicId, {
    width: options.width || 'auto',
    height: options.height,
    crop: options.crop || 'scale',
    quality: options.quality || 'auto:good',
    format: options.format || 'auto',
    secure: true,
  });
};

export const generateResponsiveImageUrls = (publicId: string) => {
  const breakpoints = [320, 640, 768, 1024, 1280, 1920];
  
  return breakpoints.map(width => ({
    width,
    url: generateImageUrl(publicId, { width, quality: 'auto:good' })
  }));
};

export const optimizeImageForSEO = (publicId: string, alt: string) => {
  return {
    src: generateImageUrl(publicId, { width: 1200, quality: 'auto:good' }),
    alt,
    srcSet: generateResponsiveImageUrls(publicId)
      .map(img => `${img.url} ${img.width}w`)
      .join(', '),
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px'
  };
};

export const deleteImage = async (publicId: string) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Failed to delete image:', error);
    throw new Error('Failed to delete image from Cloudinary');
  }
};

export const uploadImage = async (
  file: Buffer | string,
  config: keyof typeof uploadConfigs,
  options: {
    public_id?: string;
    overwrite?: boolean;
  } = {}
) => {
  try {
    const uploadConfig = uploadConfigs[config];
    
    const result = await cloudinary.uploader.upload(file, {
      folder: uploadConfig.folder,
      transformation: uploadConfig.transformation,
      allowed_formats: uploadConfig.allowed_formats,
      max_bytes: uploadConfig.max_file_size,
      public_id: options.public_id,
      overwrite: options.overwrite || false,
      unique_filename: !options.public_id,
      use_filename: true,
    });

    return {
      publicId: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
    };
  } catch (error) {
    console.error('Failed to upload image:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
};

export default cloudinary;