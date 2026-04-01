# CMS Field Mapping and Slug Validation System

This document explains how to use the CMS field mapping and slug validation system for The Corporate Blog.

## Overview

The CMS system provides a complete integration layer between the block-based editor and the PostgreSQL database, including:

- **Field Mapping**: Bidirectional transformation between CMS editor state and database models
- **Slug Validation**: Real-time uniqueness validation with automatic conflict resolution
- **Content Validation**: Comprehensive validation of CMS data structure
- **Transaction Safety**: Database operations wrapped in transactions for data integrity

## Architecture

```
CMS Editor (JSON) ←→ Field Mapping Layer ←→ Database (Prisma/PostgreSQL)
                           ↓
                    Slug Validation Layer
                           ↓
                    Content Validation Layer
```

## Key Components

### 1. Field Mapping (`lib/cms-mapping.ts`)

Handles transformation between CMS editor state and database models:

```typescript
// CMS to Database
const postData = mapCMSToPost(editorState);

// Database to CMS  
const editorState = mapPostToCMS(postWithRelations);

// Content transformation
const htmlContent = convertContentToHTML(contentBlocks);

// Relationship management
await updatePostCategories(tx, postId, categoryIds);
await updatePostTags(tx, postId, tagIds);
```

### 2. Slug Validation (`lib/slug-validation.ts`)

Ensures slug uniqueness across all content types:

```typescript
// Validate slug uniqueness
const result = await validatePostSlugUniqueness(slug, postId);

// Generate unique slug
const uniqueSlug = await generateUniquePostSlug(baseSlug);

// Auto-generate from title
const slug = await generateSlugFromTitle(title);

// Real-time validation
const availability = await checkSlugAvailability(slug, 'post');
```

### 3. CMS Service Layer (`lib/cms-service.ts`)

High-level operations combining mapping and validation:

```typescript
// Create post with full validation
const result = await createPostFromCMS({
  editorState,
  authorId,
  publishNow: false
});

// Update post with transaction safety
const result = await updatePostFromCMS({
  postId,
  editorState,
  publishNow: true
});

// Load post for editing
const result = await loadPostForCMS(postId);
```

## Field Mapping Guide

### Post Fields

| CMS Field | Database Field | Type | Notes |
|-----------|----------------|------|-------|
| `post.title` | `title` | `String` | Required, max 200 chars |
| `post.slug` | `slug` | `String` | Auto-generated if empty |
| `post.excerpt` | `excerpt` | `String?` | Optional, max 300 chars |
| `post.status` | `status` | `PostStatus` | DRAFT, PUBLISHED, SCHEDULED |
| `post.featuredImageUrl` | `featuredImageUrl` | `String?` | Optional URL |
| `post.scheduledFor` | `scheduledFor` | `DateTime?` | For SCHEDULED posts |
| `content` (blocks) | `content` | `Json` | Block editor JSON |
| `content` (converted) | `contentHtml` | `String` | HTML for display |
| `post.seo.metaTitle` | `metaTitle` | `String?` | SEO title |
| `post.seo.metaDescription` | `metaDescription` | `String?` | SEO description |
| `post.seo.canonicalUrl` | `canonicalUrl` | `String?` | SEO canonical |
| `post.seo.structuredData` | `structuredData` | `Json?` | JSON-LD data |

### Category Fields

| CMS Field | Database Field | Type | Notes |
|-----------|----------------|------|-------|
| `name` | `name` | `String` | Required, unique |
| `slug` | `slug` | `String` | Auto-generated, unique |
| `description` | `description` | `String` | Optional |
| `color` | `color` | `String` | Hex color code |
| `parentId` | `parentId` | `String?` | For hierarchical categories |

### Tag Fields

| CMS Field | Database Field | Type | Notes |
|-----------|----------------|------|-------|
| `name` | `name` | `String` | Required, unique |
| `slug` | `slug` | `String` | Auto-generated, unique |
| `description` | `description` | `String` | Optional |
| `color` | `color` | `String` | Hex color code |

## Slug Validation Rules

### Posts
- Minimum 3 characters
- Maximum 100 characters
- Lowercase alphanumeric + hyphens/underscores
- No leading/trailing hyphens
- No consecutive hyphens
- Reserved words blocked: `admin`, `api`, `blog`, etc.

### Categories
- Maximum 50 characters
- Same format rules as posts
- Reserved words: `all`, `uncategorized`, `general`, `misc`

### Tags
- Maximum 30 characters
- Same format rules as posts
- No reserved words (more flexible)

### Usernames
- 3-20 characters
- Letters, numbers, underscores only
- Reserved names blocked
- Automatic numbering: `username` → `username2`, `username3`

## Usage Examples

### Creating a Post

```typescript
import { useCMSPosts } from '@/hooks/useCMSPosts';

function CreatePostPage() {
  const { 
    createPost, 
    validateContent, 
    generateSlug,
    isSaving,
    error 
  } = useCMSPosts();

  const handleSave = async (editorState: EditorState) => {
    // Validate before saving
    const validation = await validateContent(editorState);
    
    if (!validation.isValid) {
      console.log('Validation errors:', validation.cmsValidation.errors);
      return;
    }

    // Create post
    const result = await createPost(editorState, false); // Save as draft
    
    if (result.success) {
      console.log('Post created:', result.data);
    } else {
      console.error('Failed to create:', result.error);
    }
  };

  const handleGenerateSlug = async (title: string) => {
    const { slug } = await generateSlug(title);
    return slug;
  };

  // Component JSX...
}
```

### Real-time Slug Validation

```typescript
import { useState, useEffect } from 'react';
import { useCMSPosts } from '@/hooks/useCMSPosts';

function SlugInput({ value, onChange, postId }: SlugInputProps) {
  const { validateSlug } = useCMSPosts();
  const [validation, setValidation] = useState<SlugValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!value) return;

    setIsValidating(true);
    
    const timer = setTimeout(async () => {
      const result = await validateSlug(value, postId);
      setValidation(result);
      setIsValidating(false);
    }, 500); // Debounce

    return () => clearTimeout(timer);
  }, [value, postId, validateSlug]);

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={validation?.available === false ? 'error' : ''}
      />
      
      {isValidating && <span>Validating...</span>}
      
      {validation && !validation.available && (
        <div>
          <p>This slug is not available</p>
          {validation.suggestion && (
            <button onClick={() => onChange(validation.suggestion!)}>
              Use suggestion: {validation.suggestion}
            </button>
          )}
        </div>
      )}
      
      {validation?.errors.map((error, i) => (
        <p key={i} className="error">{error}</p>
      ))}
    </div>
  );
}
```

### Loading and Editing Posts

```typescript
import { useEditPost } from '@/hooks/useCMSPosts';

function EditPostPage({ postId }: { postId: string }) {
  const {
    editorState,
    isLoading,
    isSaving,
    isDirty,
    updateEditorState,
    save,
    error
  } = useEditPost(postId, true); // Enable auto-save

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!editorState) return <div>Post not found</div>;

  const handlePublish = async () => {
    const result = await save(true); // Publish now
    
    if (result.success) {
      console.log('Published successfully');
    }
  };

  return (
    <div>
      <div>
        {isDirty && <span>Unsaved changes</span>}
        {isSaving && <span>Saving...</span>}
      </div>
      
      <PostEditor
        editorState={editorState}
        onChange={updateEditorState}
      />
      
      <button onClick={handlePublish}>
        Publish Post
      </button>
    </div>
  );
}
```

## API Endpoints

### Posts
- `POST /api/cms/posts` - Create new post
- `GET /api/cms/posts/[postId]` - Load post for editing  
- `PUT /api/cms/posts/[postId]` - Update existing post
- `POST /api/cms/posts/validate-slug` - Validate slug availability
- `POST /api/cms/posts/generate-slug` - Generate slug from title
- `POST /api/cms/posts/validate-content` - Validate editor content

### Categories
- `POST /api/cms/categories` - Create category
- `PUT /api/cms/categories/[id]` - Update category
- `POST /api/cms/categories/validate-slug` - Validate category slug

### Tags
- `POST /api/cms/tags` - Create tag  
- `PUT /api/cms/tags/[id]` - Update tag
- `POST /api/cms/tags/validate-slug` - Validate tag slug
- `POST /api/cms/tags/bulk` - Create multiple tags

## Error Handling

The system provides comprehensive error handling at multiple levels:

### Validation Errors
```typescript
{
  success: false,
  errors: ['Slug is already in use'],
  validationErrors: {
    isValid: false,
    errors: ['Title is required'],
    fieldErrors: {
      'post.title': ['Title cannot be empty']
    }
  }
}
```

### Database Errors
All operations are wrapped in transactions to ensure data consistency:

```typescript
await prisma.$transaction(async (tx) => {
  const post = await tx.post.create({ data: postData });
  await updatePostCategories(tx, post.id, categories);
  await updatePostTags(tx, post.id, tags);
  return post;
});
```

## Performance Considerations

1. **Debounced Validation**: Real-time slug validation is debounced to avoid excessive API calls
2. **Selective Queries**: Database queries only fetch required fields using Prisma's `select`
3. **Transaction Batching**: Related operations are batched in database transactions
4. **Auto-save Throttling**: Auto-save operations are throttled to prevent conflicts

## Security Considerations

1. **Input Sanitization**: All user inputs are validated and sanitized
2. **SQL Injection Prevention**: Prisma provides type-safe queries
3. **Reserved Word Protection**: System prevents use of reserved slugs
4. **Access Control**: TODO - Add authentication middleware to API routes

## Testing

```typescript
// Test slug validation
const validation = await validatePostSlugUniqueness('test-post');
expect(validation.isValid).toBe(true);

// Test field mapping
const editorState = createMockEditorState();
const postData = mapCMSToPost(editorState);
expect(postData.title).toBe(editorState.post.title);

// Test content conversion
const html = convertContentToHTML(mockBlocks);
expect(html).toContain('<h1>Test Title</h1>');
```

## Troubleshooting

### Common Issues

1. **Slug Conflicts**: System automatically suggests alternatives
2. **Validation Failures**: Check `validationErrors` in response
3. **Transaction Rollbacks**: Check database constraints and foreign keys
4. **Auto-save Conflicts**: Disable auto-save during manual saves

### Debug Mode

Enable detailed logging by setting:
```typescript
const CMS_DEBUG = process.env.NODE_ENV === 'development';
```

This system provides a robust, type-safe foundation for content management with comprehensive validation and error handling.