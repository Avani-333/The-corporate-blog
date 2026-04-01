export function PostCardSkeleton() {
  return (
    <div className="card animate-pulse">
      {/* Image Skeleton */}
      <div className="aspect-[16/10] bg-gray-200 rounded-t-lg" />

      {/* Content Skeleton */}
      <div className="card-body space-y-4">
        {/* Meta info */}
        <div className="flex space-x-4">
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-16" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 rounded w-full" />
          <div className="h-6 bg-gray-200 rounded w-3/4" />
        </div>

        {/* Excerpt */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>

        {/* Author & CTA */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="h-4 bg-gray-200 rounded w-20" />
          </div>
          <div className="h-8 bg-gray-200 rounded w-20" />
        </div>
      </div>
    </div>
  );
}

export function PostListSkeleton() {
  return (
    <div className="space-y-6">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex space-x-6 p-6 bg-white rounded-lg shadow-sm">
          <div className="w-48 h-32 bg-gray-200 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="flex space-x-4">
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
            <div className="space-y-2">
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="h-6 bg-gray-200 rounded w-1/2" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-gray-200 rounded-full" />
                <div className="h-4 bg-gray-200 rounded w-20" />
              </div>
              <div className="h-8 bg-gray-200 rounded w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CategoryCardSkeleton() {
  return (
    <div className="p-6 bg-gray-200 rounded-xl animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-gray-300 rounded-lg" />
        <div className="w-4 h-4 bg-gray-300 rounded" />
      </div>
      <div className="space-y-3">
        <div className="h-6 bg-gray-300 rounded w-3/4" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-300 rounded w-full" />
          <div className="h-4 bg-gray-300 rounded w-2/3" />
        </div>
        <div className="flex justify-between pt-2">
          <div className="h-4 bg-gray-300 rounded w-20" />
          <div className="h-4 bg-gray-300 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

export function AuthorCardSkeleton() {
  return (
    <div className="p-6 bg-white rounded-lg shadow-sm animate-pulse">
      <div className="flex items-center space-x-4 mb-4">
        <div className="w-16 h-16 bg-gray-200 rounded-full" />
        <div className="space-y-2">
          <div className="h-5 bg-gray-200 rounded w-24" />
          <div className="h-4 bg-gray-200 rounded w-20" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>
      <div className="flex justify-between mt-4 pt-4 border-t border-gray-200">
        <div className="h-4 bg-gray-200 rounded w-20" />
        <div className="h-4 bg-gray-200 rounded w-16" />
      </div>
    </div>
  );
}