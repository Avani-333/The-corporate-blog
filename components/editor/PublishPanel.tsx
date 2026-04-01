'use client';

export interface PublishPanelProps {
  onPublish?: () => void;
  onSchedule?: () => void;
}

export function PublishPanel({ onPublish, onSchedule }: PublishPanelProps) {
  return (
    <div className="p-4 border-t border-gray-200">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Publish</h3>
      <div className="space-y-2">
        <button
          onClick={onPublish}
          className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          Publish Now
        </button>
        <button
          onClick={onSchedule}
          className="w-full px-4 py-2 bg-gray-200 text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-300"
        >
          Schedule Post
        </button>
      </div>
    </div>
  );
}
